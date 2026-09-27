// Persistence adapters, all with the same get/set/delete/list interface:
//   1. Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set — see supabase/migrations/
//   2. Netlify Blobs on Netlify otherwise
//   3. A JSON-file store locally (tests, dev server) when CNM_LOCAL_STORE=1
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LOCAL = process.env.CNM_LOCAL_STORE === '1';
const LOCAL_DIR = process.env.CNM_DATA_DIR || path.resolve('.data');

function fsStore(name) {
  const dir = path.join(LOCAL_DIR, name);
  const file = (key) => path.join(dir, `${encodeURIComponent(key)}.json`);
  return {
    async get(key) {
      try { return JSON.parse(await readFile(file(key), 'utf8')); } catch { return null; }
    },
    async set(key, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(file(key), JSON.stringify(value));
    },
    async delete(key) { await rm(file(key), { force: true }); },
    async list(prefix = '') {
      try {
        return (await readdir(dir)).map((f) => decodeURIComponent(f.replace(/\.json$/, ''))).filter((k) => k.startsWith(prefix));
      } catch { return []; }
    },
  };
}

async function blobStore(name) {
  const { getStore } = await import('@netlify/blobs');
  const s = getStore({ name, consistency: 'strong' });
  return {
    get: (key) => s.get(key, { type: 'json' }),
    set: (key, value) => s.setJSON(key, value),
    delete: (key) => s.delete(key),
    async list(prefix = '') {
      const { blobs } = await s.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}

/**
 * Supabase adapter: one row per record in public.cnm_kv (store, key, value jsonb), accessed via PostgREST with the
 * server-only secret key. RLS is on with no policies, so the publishable/anon key cannot read or write it.
 */
export function supabaseStore(name, { url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl = fetch } = {}) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/cnm_kv`;
  // New sb_secret_ keys go in the apikey header only; legacy service_role JWTs also go in Authorization.
  const headers = { apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) };
  const q = (params) => `${base}?${new URLSearchParams(params).toString()}`;
  const request = async (u, init = {}) => {
    const res = await fetchImpl(u, { ...init, headers: { ...headers, ...(init.headers || {}) }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Supabase ${init.method || 'GET'} failed (${res.status}): ${await res.text().catch(() => '')}`);
    return res;
  };
  return {
    async get(k) {
      const rows = await (await request(q({ select: 'value', store: `eq.${name}`, key: `eq.${k}` }))).json();
      return rows[0]?.value ?? null;
    },
    async set(k, value) {
      await request(`${base}?on_conflict=store,key`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ store: name, key: k, value }) });
    },
    async delete(k) {
      await request(q({ store: `eq.${name}`, key: `eq.${k}` }), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    async list(prefix = '') {
      const keys = [];
      const pattern = `${prefix.replace(/[\\%_*]/g, (c) => `\\${c}`)}*`;
      for (let offset = 0; ; offset += 1000) {
        const rows = await (await request(q({ select: 'key', store: `eq.${name}`, key: `like.${pattern}`, order: 'key', limit: '1000', offset: String(offset) }))).json();
        keys.push(...rows.map((r) => r.key));
        if (rows.length < 1000) break;
      }
      return keys.filter((k) => k.startsWith(prefix));
    },
  };
}

export const storeBackend = () => (LOCAL ? 'local' : process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'netlify-blobs');

const cache = new Map();
/** @returns {Promise<{get(k:string):Promise<any>, set(k:string,v:any):Promise<void>, delete(k:string):Promise<void>, list(p?:string):Promise<string[]>}>} */
export async function store(name) {
  if (!cache.has(name)) {
    const backend = storeBackend();
    cache.set(name, backend === 'local' ? fsStore(name) : backend === 'supabase' ? supabaseStore(name) : await blobStore(name));
  }
  return cache.get(name);
}

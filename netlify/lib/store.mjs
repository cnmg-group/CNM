// Persistence adapters, all with the same get/set/delete/list interface:
//   1. Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set — see supabase/migrations/
//   2. Netlify Blobs on Netlify otherwise
//   3. Cloudflare D1 when the site runs on Cloudflare Pages with a D1 database bound as CNM_DB (see functions/api/)
//   4. A JSON-file store locally (tests, dev server) when CNM_LOCAL_STORE=1
// Node's fs is only loaded for the local store, so the same code runs on Cloudflare's Workers runtime.

async function fsStore(name) {
  const { mkdir, readdir, readFile, rm, writeFile } = await import('node:fs/promises');
  const path = (await import('node:path')).default;
  const dir = path.join(process.env.CNM_DATA_DIR || path.resolve('.data'), name);
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

/**
 * Cloudflare D1 adapter: the same one-row-per-record table as Supabase (store, key, value), created on first use.
 * D1 reads see the latest write, which sign-in codes, rate limits and idempotency rely on.
 */
export function d1Store(name, db = globalThis.__CNM_D1) {
  let ready = d1Store.ready?.get(db);
  if (!ready) {
    ready = db.prepare('CREATE TABLE IF NOT EXISTS cnm_kv (store TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (store, key))').run();
    (d1Store.ready ||= new WeakMap()).set(db, ready);
  }
  return {
    async get(k) {
      await ready;
      const row = await db.prepare('SELECT value FROM cnm_kv WHERE store = ?1 AND key = ?2').bind(name, k).first();
      return row ? JSON.parse(row.value) : null;
    },
    async set(k, value) {
      await ready;
      await db.prepare('INSERT INTO cnm_kv (store, key, value, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (store, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .bind(name, k, JSON.stringify(value), new Date().toISOString()).run();
    },
    async delete(k) {
      await ready;
      await db.prepare('DELETE FROM cnm_kv WHERE store = ?1 AND key = ?2').bind(name, k).run();
    },
    async list(prefix = '') {
      await ready;
      const { results } = await db.prepare("SELECT key FROM cnm_kv WHERE store = ?1 AND substr(key, 1, length(?2)) = ?2 ORDER BY key").bind(name, prefix).all();
      return results.map((r) => r.key);
    },
  };
}

export const storeBackend = () => (process.env.CNM_LOCAL_STORE === '1' ? 'local'
  : process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase'
    : globalThis.__CNM_D1 ? 'cloudflare-d1' : 'netlify-blobs');

const cache = new Map();
/** @returns {Promise<{get(k:string):Promise<any>, set(k:string,v:any):Promise<void>, delete(k:string):Promise<void>, list(p?:string):Promise<string[]>}>} */
export async function store(name) {
  if (!cache.has(name)) {
    const backend = storeBackend();
    cache.set(name, backend === 'local' ? await fsStore(name) : backend === 'supabase' ? supabaseStore(name) : backend === 'cloudflare-d1' ? d1Store(name) : await blobStore(name));
  }
  return cache.get(name);
}

// Persistence: Netlify Blobs in production/staging; a JSON-file store locally (tests, dev server).
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

const cache = new Map();
/** @returns {Promise<{get(k:string):Promise<any>, set(k:string,v:any):Promise<void>, delete(k:string):Promise<void>, list(p?:string):Promise<string[]>}>} */
export async function store(name) {
  if (!cache.has(name)) cache.set(name, LOCAL ? fsStore(name) : await blobStore(name));
  return cache.get(name);
}

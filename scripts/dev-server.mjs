// Local server that mirrors Netlify: serves dist/, applies _redirects rewrites, and routes /api/* to the functions.
// Usage: npm run dev  (build + serve on http://localhost:8888)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.CNM_LOCAL_STORE ||= '1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.CNM_DATA_DIR ||= path.join(ROOT, '.data');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8888);
const LATENCY = Number(process.env.CNM_API_LATENCY || 0); // simulate slow networks in tests

const FUNCTIONS = ['auth', 'account', 'checkout', 'payments', 'orders', 'catalogue-live', 'leads', 'events', 'admin', 'media', 'recommend'];
const routes = [];
for (const name of FUNCTIONS) {
  const mod = await import(pathToFileURL(path.join(ROOT, 'netlify/functions', `${name}.mjs`)).href);
  for (const p of [].concat(mod.config.path)) {
    const re = new RegExp(`^${p.replace(/:[a-zA-Z]+/g, '([^/]+)')}/?$`);
    routes.push({ re, fn: mod.default, specificity: p.split('/').filter((s) => !s.startsWith(':')).length });
  }
}
routes.sort((a, b) => b.specificity - a.specificity);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };

// Path-based 301/302 rules from dist/_redirects (host-based rules only apply on Netlify).
const REDIRECTS = (await readFile(path.join(DIST, '_redirects'), 'utf8').catch(() => '')).split('\n')
  .map((l) => l.trim().split(/\s+/)).filter(([from, , st]) => from?.startsWith('/') && /^30[12]$/.test(st))
  .map(([from, to, st]) => ({ from, to, status: Number(st) }));
const redirectFor = (p) => REDIRECTS.find((r) => (r.from.endsWith('/*') ? p.startsWith(r.from.slice(0, -1)) : p === r.from));

async function file(p) {
  try { const s = await stat(p); if (s.isFile()) return p; if (s.isDirectory()) { const i = path.join(p, 'index.html'); await stat(i); return i; } } catch { /* not found */ }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find((x) => x.re.test(url.pathname));
      if (!r) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"not_found"}'); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      if (LATENCY) await new Promise((r2) => setTimeout(r2, LATENCY));
      const response = await r.fn(request, { ip: req.socket.remoteAddress });
      const headers = {};
      response.headers.forEach((v, k) => { headers[k] = k === 'set-cookie' ? response.headers.getSetCookie() : v; });
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    const rd = redirectFor(pathname);
    if (rd) { res.writeHead(rd.status, { Location: rd.to }); res.end(); return; }
    const m = pathname.match(/^\/account\/orders\/(CNM-[^/]+)\/?$/);
    if (m) pathname = '/account/orders/view/';
    let f = await file(path.join(DIST, pathname));
    let status = 200;
    if (!f) { f = path.join(DIST, '404.html'); status = 404; }
    const ext = path.extname(f);
    res.writeHead(status, { 'Content-Type': TYPES[ext] || (f.includes('apple-app-site-association') ? 'application/json' : 'application/octet-stream'), 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60' });
    res.end(await readFile(f));
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Server error');
  }
});
server.listen(PORT, () => console.log(`CNM Essentials running at http://localhost:${PORT}  (admin: /admin/ — admin@cnm.local / cnm-local-admin)`));

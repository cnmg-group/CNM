// Loads repository content (the CMS source of truth) and, on Netlify, merges admin edits stored in Netlify Blobs.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

function parseFrontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

async function blobOverrides() {
  // Admin content edits live in Netlify Blobs. They are merged at build time so published pages stay static.
  if (!process.env.NETLIFY || process.env.CNM_SKIP_BLOBS === '1') return {};
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('config');
    const [inventory, homepage, redirects, stores, seo, announcements] = await Promise.all(
      ['inventory', 'content/homepage', 'content/redirects', 'content/stores', 'content/seo', 'content/announcements'].map((k) => store.get(k, { type: 'json' }).catch(() => null)),
    );
    return { inventory, homepage, redirects, stores, seo, announcements };
  } catch (err) {
    console.warn('[content] Blobs overrides unavailable at build time:', err.message);
    return {};
  }
}

export async function loadContent(root) {
  const dir = path.join(root, 'content');
  const [site, commerce, categories, collections, products, stores, services, story, redirects] = await Promise.all(
    ['site', 'commerce', 'categories', 'collections', 'products', 'stores', 'services', 'story', 'redirects'].map((n) => readJson(path.join(dir, `${n}.json`))),
  );
  const articles = [];
  for (const f of (await readdir(path.join(dir, 'articles'))).filter((f) => f.endsWith('.md'))) {
    const { data, body } = parseFrontMatter(await readFile(path.join(dir, 'articles', f), 'utf8'));
    articles.push({ ...data, html: marked.parse(body) });
  }
  articles.sort((a, b) => b.date.localeCompare(a.date));

  const o = await blobOverrides();
  const inv = o.inventory?.products || {};
  const mergedProducts = products.map((p) => {
    const x = inv[p.id];
    if (!x) return p;
    return {
      ...p,
      price: { ...p.price, amount: x.price ?? p.price.amount, compareAt: x.compareAt ?? p.price.compareAt, demo: x.priceApproved ? false : p.price.demo },
      stock: { ...p.stock, quantity: x.stock ?? p.stock.quantity },
      available: x.available ?? p.available,
      ...(x.description ? { description: x.description } : {}),
      ...(x.images?.length ? { images: x.images } : {}),
      seo: { ...p.seo, ...(x.seo || {}) },
    };
  });

  const h = o.homepage || {};
  const siteMerged = { ...site };
  for (const k of ['tagline', 'heroHeadline', 'heroLead']) if (h[k]) siteMerged[k] = { ...site[k], value: h[k], status: 'APPROVED_IN_ADMIN' };
  let ordered = mergedProducts;
  if (h.featured?.length) ordered = [...h.featured.map((id) => mergedProducts.find((p) => p.id === id)).filter(Boolean), ...mergedProducts.filter((p) => !h.featured.includes(p.id))];

  return {
    site: siteMerged, commerce, seo: o.seo?.pages || {}, announcement: o.announcements?.message ? o.announcements : null, heroVideo: h.heroVideo || null, categories: [...categories].sort((a, b) => a.order - b.order), collections,
    products: ordered, stores: o.stores?.stores || stores, services, story, articles,
    redirects: [...redirects, ...(o.redirects?.redirects || [])],
    homepage: o.homepage || null,
  };
}

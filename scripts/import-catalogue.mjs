#!/usr/bin/env node
// Import CNM's ORIGINAL catalogue, photography and logo so the site uses real items instead of placeholders.
//
//   node scripts/import-catalogue.mjs --shopify https://cnmessentials.com      # Shopify storefront (public products.json)
//   node scripts/import-catalogue.mjs --woo https://cnmessentials.com          # WooCommerce Store API
//   node scripts/import-catalogue.mjs --csv ./products_export.csv              # Shopify / generic CSV export
//   node scripts/import-catalogue.mjs --logo https://…/logo.svg                # original logo (or a local file path)
//   add --dry-run to preview without writing
//
// Imported names, descriptions, prices, variants and images come from CNM's own store, so they are marked
// IMPORTED_FROM_CNM (not demo). Stock levels are only imported when the source provides quantities.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry-run');

const CATEGORY_RULES = [
  ['smart-scent-machines', /machine|diffuser device|nebuli|scent system/i],
  ['car-fragrance', /\bcar\b|vent/i],
  ['refill-oils', /refill/i],
  ['diffuser-oils', /diffuser oil|fragrance oil|essential oil|\boil\b/i],
  ['body-care', /body|butter|lotion|wash|soap|scrub|hand|skin/i],
  ['home-fragrance', /reed|candle|room spray|home|linen|stoneglow|diffuser/i],
];
export const categorise = (text) => CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] || null;

const stripHtml = (h) => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-');

async function download(url, dest) {
  if (DRY) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function localImages(handle, images) {
  const out = [];
  for (const [i, img] of images.slice(0, 8).entries()) {
    const ext = (new URL(img.src, 'https://x').pathname.match(/\.(jpe?g|png|webp|avif|gif)$/i)?.[1] || 'jpg').toLowerCase();
    const file = `/assets/products/${handle}-${i + 1}.${ext}`;
    try { await download(img.src, path.join(ROOT, 'public', file)); out.push({ src: file, alt: img.alt || img.fallbackAlt }); } catch (e) { console.warn(`  ! ${e.message}`); }
  }
  return out;
}

function baseProduct({ handle, title, description, type, tags, price, compareAt, variants, stock, images, available }) {
  const category = categorise(`${type} ${title} ${tags.join(' ')}`);
  return {
    id: handle, slug: handle, name: title, brand: 'CNM Essentials', category, collections: tags.filter((t) => /stoneglow|collection/i.test(t)).map(slug),
    productType: type || 'Home fragrance', nameStatus: 'IMPORTED_FROM_CNM',
    description: description || null, scentFamily: null, scentNotes: null, ingredients: null, howToUse: null, size: null, care: null, faqs: [],
    variants, price: { amount: price, compareAt: compareAt && compareAt > price ? compareAt : null, status: 'IMPORTED_FROM_CNM', demo: false },
    stock: { quantity: stock ?? null, status: stock == null ? 'NOT_PROVIDED_BY_SOURCE' : 'IMPORTED_FROM_CNM', demo: false },
    available: available !== false, images, video: null, badges: [], isNew: false, isBestSeller: false, flagsStatus: 'NEEDS_CNM_APPROVAL', related: [],
    seo: { title: null, description: null }, gtin: null, mpn: null, contentStatus: category ? 'IMPORTED_FROM_CNM' : 'NEEDS_CATEGORY',
  };
}

async function fromShopify(site) {
  const all = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(`${site.replace(/\/$/, '')}/products.json?limit=250&page=${page}`);
    if (!res.ok) throw new Error(`Shopify products.json returned ${res.status}`);
    const { products } = await res.json();
    if (!products.length) break;
    all.push(...products);
  }
  const out = [];
  for (const p of all) {
    console.log(`  • ${p.title}`);
    const v = p.variants || [];
    const prices = v.map((x) => Number(x.price));
    out.push(baseProduct({
      handle: p.handle, title: p.title, description: stripHtml(p.body_html), type: p.product_type, tags: Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',').map((t) => t.trim()),
      price: Math.round(Math.min(...prices)), compareAt: Math.round(Number(v[0]?.compare_at_price) || 0),
      variants: v.length > 1 ? v.map((x) => ({ id: String(x.id), name: x.title, price: Math.round(Number(x.price)), sku: x.sku || null, available: x.available })) : [],
      available: v.some((x) => x.available), images: await localImages(p.handle, (p.images || []).map((i) => ({ src: i.src, alt: i.alt, fallbackAlt: p.title }))),
    }));
  }
  return out;
}

async function fromWoo(site) {
  const res = await fetch(`${site.replace(/\/$/, '')}/wp-json/wc/store/v1/products?per_page=100`);
  if (!res.ok) throw new Error(`WooCommerce Store API returned ${res.status}`);
  const out = [];
  for (const p of await res.json()) {
    console.log(`  • ${p.name}`);
    const minor = 10 ** (p.prices?.currency_minor_unit ?? 2);
    out.push(baseProduct({
      handle: p.slug, title: stripHtml(p.name), description: stripHtml(p.description || p.short_description), type: p.categories?.[0]?.name, tags: (p.categories || []).map((c) => c.name),
      price: Math.round(Number(p.prices.price) / minor), compareAt: Math.round(Number(p.prices.regular_price) / minor), variants: [],
      stock: p.low_stock_remaining ?? null, available: p.is_in_stock, images: await localImages(p.slug, (p.images || []).map((i) => ({ src: i.src, alt: i.alt, fallbackAlt: p.name }))),
    }));
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

async function fromCsv(file) {
  const rows = parseCsv(await readFile(file, 'utf8'));
  const g = (r, ...keys) => keys.map((k) => r[k]).find((v) => v != null && v !== '') ?? '';
  const byHandle = new Map();
  for (const r of rows) {
    const handle = g(r, 'Handle', 'handle', 'Slug') || slug(g(r, 'Title', 'Name'));
    if (!byHandle.has(handle)) byHandle.set(handle, []);
    byHandle.get(handle).push(r);
  }
  const out = [];
  for (const [handle, rs] of byHandle) {
    const first = rs.find((r) => g(r, 'Title', 'Name')) || rs[0];
    const title = g(first, 'Title', 'Name');
    if (!title) continue;
    console.log(`  • ${title}`);
    const prices = rs.map((r) => Number(g(r, 'Variant Price', 'Price', 'Regular price'))).filter((n) => n > 0);
    const qty = rs.map((r) => g(r, 'Variant Inventory Qty', 'Stock', 'Inventory')).filter((x) => x !== '').map(Number);
    const imgs = [...new Set(rs.map((r) => g(r, 'Image Src', 'Images', 'Image')).flatMap((s) => s.split(',').map((x) => x.trim())).filter(Boolean))];
    out.push(baseProduct({
      handle, title, description: stripHtml(g(first, 'Body (HTML)', 'Description', 'Short description')), type: g(first, 'Type', 'Product Type', 'Categories'), tags: g(first, 'Tags').split(',').map((t) => t.trim()).filter(Boolean),
      price: prices.length ? Math.round(Math.min(...prices)) : null, compareAt: Math.round(Number(g(first, 'Variant Compare At Price', 'Sale price')) || 0),
      variants: rs.length > 1 ? rs.filter((r) => g(r, 'Option1 Value')).map((r, i) => ({ id: `${handle}-${i + 1}`, name: g(r, 'Option1 Value'), price: Math.round(Number(g(r, 'Variant Price')) || 0), sku: g(r, 'Variant SKU') || null })) : [],
      stock: qty.length ? qty.reduce((a, b) => a + b, 0) : null,
      images: await localImages(handle, imgs.map((src) => ({ src: /^https?:/.test(src) ? src : pathToUrl(src), alt: g(rs.find((r) => g(r, 'Image Src') === src) || {}, 'Image Alt Text'), fallbackAlt: title }))),
    }));
  }
  return out;
}
const pathToUrl = (p) => new URL(p, 'file://').href;

async function importLogo(src) {
  const ext = (src.match(/\.(svg|png|webp)(\?|$)/i)?.[1] || 'png').toLowerCase();
  const dest = path.join(ROOT, 'public/assets/brand', `cnm-logo.${ext}`);
  if (/^https?:/.test(src)) await download(src, dest);
  else if (!DRY) await copyFile(src, dest);
  console.log(`Logo saved to ${path.relative(ROOT, dest)} — it now appears in the header, footer, admin and structured data on every page.`);
}

async function main() {
  if (opt('logo')) await importLogo(opt('logo'));
  let products = null;
  if (opt('shopify')) products = await fromShopify(opt('shopify'));
  else if (opt('woo')) products = await fromWoo(opt('woo'));
  else if (opt('csv')) products = await fromCsv(opt('csv'));
  if (!products) { if (!opt('logo')) console.log('Nothing to import. See usage at the top of this file.'); return; }

  const uncategorised = products.filter((p) => !p.category);
  products.forEach((p) => { if (!p.category) p.category = 'home-fragrance'; });
  const file = path.join(ROOT, 'content/products.json');
  if (!DRY) {
    if (existsSync(file)) await copyFile(file, path.join(ROOT, 'content/products.placeholder-backup.json'));
    await writeFile(file, JSON.stringify(products, null, 2) + '\n');
    const colsFile = path.join(ROOT, 'content/collections.json');
    const cols = JSON.parse(await readFile(colsFile, 'utf8'));
    for (const c of new Set(products.flatMap((p) => p.collections))) if (!cols.find((x) => x.slug === c)) cols.push({ slug: c, name: c.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), intro: null, introStatus: 'NEEDS_CNM_APPROVAL' });
    await writeFile(colsFile, JSON.stringify(cols, null, 2) + '\n');
  }
  console.log(`\nImported ${products.length} original CNM products${DRY ? ' (dry run)' : ' into content/products.json'}.`);
  if (uncategorised.length) console.log(`Review category for: ${uncategorised.map((p) => p.name).join(', ')} (defaulted to Home Fragrance, contentStatus NEEDS_CATEGORY).`);
  console.log('Next: npm run build && npm test');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1); });

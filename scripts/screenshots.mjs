// Visual QA: captures desktop + mobile screenshots of every major page and state, then writes docs/visual-review/index.html.
// Requires the dev server:  npm run dev  (in another terminal)   then:  npm run screenshots
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/visual-review');
const BASE = process.env.BASE_URL || 'http://localhost:8888';
const H = { 'X-CNM-Request': '1', 'Content-Type': 'application/json' };

const VIEWPORTS = [
  { key: 'desktop', width: 1440, height: 900, mobile: false },
  { key: 'mobile', width: 390, height: 844, mobile: true },
];

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

const SHOTS = [
  { id: 'home', title: 'Homepage', path: '/', full: true },
  { id: 'shop', title: 'Shop — all', path: '/shop/', full: true },
  { id: 'category', title: 'Category — Home Fragrance', path: '/shop/home-fragrance/', full: true },
  { id: 'filters', title: 'Filters (mobile bottom sheet)', path: '/shop/?category=body-care', act: async (p, vp) => { if (vp.mobile) await p.click('[data-filters-open]'); } },
  { id: 'search', title: 'Predictive search (typo: "difuser")', path: '/', act: async (p) => { await p.click('[data-open="search"]'); await p.fill('[data-search-input]', 'difuser'); await p.waitForTimeout(400); } },
  { id: 'search-results', title: 'Search results page', path: '/search/?q=oil', full: true },
  { id: 'pdp', title: 'Product detail', path: '/products/stoneglow-reed-diffuser/', full: true },
  { id: 'pdp-oos', title: 'Product — out of stock / back in stock', path: '/products/car-diffuser/' },
  { id: 'bag-drawer', title: 'Bag drawer', path: '/products/refill-oil/', act: async (p) => { await p.locator('.buy-actions [data-add]').click(); await p.waitForTimeout(700); } },
  { id: 'bag', title: 'Bag page', path: '/bag/', full: true, seedBag: true },
  { id: 'wishlist', title: 'Wishlist', path: '/wishlist/', full: true, seedWish: true },
  { id: 'checkout-contact', title: 'Checkout — contact', path: '/checkout/', seedBag: true },
  { id: 'checkout-delivery', title: 'Checkout — delivery', path: '/checkout/', seedBag: true, act: async (p) => { await p.fill('#c-email', 'ada@example.com'); await p.fill('#c-first', 'Ada'); await p.fill('#c-last', 'Obi'); await p.fill('#c-phone', '+2348012345678'); await p.click('[data-step="contact"] button[type="submit"]'); await p.waitForTimeout(500); } },
  { id: 'checkout-pay', title: 'Checkout — payment (staging simulator)', path: '/checkout/', seedBag: true, act: async (p) => {
    await p.fill('#c-email', 'ada@example.com'); await p.fill('#c-first', 'Ada'); await p.fill('#c-last', 'Obi'); await p.fill('#c-phone', '+2348012345678'); await p.click('[data-step="contact"] button[type="submit"]');
    await p.fill('#a-line1', '1 Bourdillon Road'); await p.fill('#a-city', 'Ikoyi'); await p.selectOption('#a-state', 'Lagos'); await p.click('[data-step="delivery"] button[type="submit"]');
    await p.click('[data-step="payment"] button[type="submit"]'); await p.check('[data-terms]'); await p.click('[data-place-order]'); await p.waitForSelector('[data-sim-pay]:visible');
  } },
  { id: 'confirmation', title: 'Order confirmation', full: true, confirm: true },
  { id: 'login', title: 'Sign in', path: '/account/login/' },
  { id: 'register', title: 'Create account', path: '/account/register/' },
  { id: 'account', title: 'Account overview', path: '/account/', auth: true, full: true },
  { id: 'orders', title: 'Orders', path: '/account/orders/', auth: true },
  { id: 'order-detail', title: 'Order detail & tracking', auth: true, orderDetail: true, full: true },
  { id: 'preferences', title: 'Communication preferences', path: '/account/preferences/', auth: true, full: true },
  { id: 'story', title: 'Our story', path: '/our-story/', full: true },
  { id: 'stores', title: 'Stores', path: '/stores/', full: true },
  { id: 'store-lagos', title: 'Store — Lagos', path: '/stores/lagos/', full: true },
  { id: 'services', title: 'Fragrance as a Service', path: '/fragrance-as-a-service/', full: true },
  { id: 'journal', title: 'Journal', path: '/journal/', full: true },
  { id: 'article', title: 'Journal article', path: '/journal/choosing-fragrance-by-room/', full: true },
  { id: 'group', title: 'CNM Group — Energy · Retail · Impact', path: '/cnm-group/', full: true },
  { id: 'mobile-nav', title: 'Mobile navigation', path: '/', mobileOnly: true, act: async (p) => { await p.click('.menu-toggle'); await p.waitForTimeout(600); } },
  { id: 'loader', title: 'Loading state — butterfly loader', path: '/styleguide/', act: async (p) => { await p.click('[data-demo-loader]'); await p.waitForTimeout(900); } },
  { id: 'styleguide', title: 'Design system', path: '/styleguide/', full: true },
  { id: 'admin', title: 'Admin — dashboard', path: '/admin/', admin: true, full: true },
  { id: 'admin-inventory', title: 'Admin — products & inventory', path: '/admin/#inventory', admin: true },
  { id: 'not-found', title: '404', path: '/this-page-does-not-exist' },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
await mkdir(OUT, { recursive: true });

// Seed: one customer with a paid order
const api = await (await browser.newContext()).request;
const email = `review${Date.now()}@example.com`;
const reg = await api.post(`${BASE}/api/auth/register`, { headers: H, data: { email, password: 'review-password', firstName: 'Amara', lastName: 'Okafor' } });
const cookie = reg.headers()['set-cookie'].split(';')[0];
const order = await (await api.post(`${BASE}/api/checkout`, { headers: { ...H, Cookie: cookie }, data: { items: [{ id: 'stoneglow-reed-diffuser', qty: 1 }, { id: 'refill-oil', qty: 2 }], contact: { email, phone: '+2348012345678', firstName: 'Amara', lastName: 'Okafor' }, delivery: { method: 'lagos-standard', address: { line1: '1 Bourdillon Road', city: 'Ikoyi', state: 'Lagos' } } } })).json();
await api.post(`${BASE}/api/payments/simulate`, { headers: H, data: { number: order.order.number, accessToken: order.order.accessToken, outcome: 'success' } });

const results = [];
for (const vp of VIEWPORTS) {
  for (const s of SHOTS) {
    if (s.mobileOnly && !vp.mobile) continue;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile });
    await ctx.addInitScript(({ bag, wish }) => {
      try {
        localStorage.setItem('cnm.consent', 'denied');
        if (bag) localStorage.setItem('cnm.bag', JSON.stringify([{ id: 'stoneglow-reed-diffuser', qty: 1 }, { id: 'refill-oil', qty: 2 }]));
        if (wish) localStorage.setItem('cnm.wish', JSON.stringify(['smart-scent-machine', 'body-butter', 'car-diffuser']));
      } catch { /* ignore */ }
    }, { bag: !!s.seedBag, wish: !!s.seedWish });
    if (s.auth) {
      const [name, value] = cookie.split('=');
      await ctx.addCookies([{ name, value, url: BASE }]);
      await ctx.addInitScript(() => localStorage.setItem('cnm.user', JSON.stringify({ firstName: 'Amara' })));
    }
    const page = await ctx.newPage();
    let url = s.path;
    if (s.confirm) url = `/checkout/confirmation/?n=${order.order.number}&t=${order.order.accessToken}`;
    if (s.orderDetail) url = `/account/orders/view/?n=${order.order.number}`;
    if (s.admin) {
      await page.goto(`${BASE}/admin/`);
      await page.fill('#ae', 'admin@cnm.local');
      await page.fill('#ap', 'cnm-local-admin');
      await page.click('[data-login] button');
      await page.waitForSelector('.admin__main h1');
    }
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
    if (s.full) await scrollThrough(page);
    if (s.act) await s.act(page, vp);
    await page.waitForTimeout(400);
    if (s.full) await page.addStyleTag({ content: '[data-sticky-buy]{display:none!important}' });
    const file = `${s.id}-${vp.key}.jpg`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: !!s.full, type: 'jpeg', quality: 72 });
    results.push({ ...s, vp: vp.key, file });
    console.log(`  ✓ ${vp.key.padEnd(7)} ${s.title}`);
    await ctx.close();
  }
}
await browser.close();

// Review board
const groups = SHOTS.map((s) => ({ s, shots: results.filter((r) => r.id === s.id) }));
await writeFile(path.join(OUT, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CNM Visual Review</title>
<style>:root{--g:#153f32;--c:#f5f1e8;--ink:#111;--line:#e4dfd4}body{margin:0;font-family:-apple-system,Helvetica,Arial,sans-serif;background:var(--c);color:var(--ink)}header{background:var(--g);color:var(--c);padding:32px 24px}h1{margin:0;font-family:Georgia,serif;font-weight:400;font-size:40px}header p{opacity:.8;max-width:760px}nav{display:flex;flex-wrap:wrap;gap:6px;padding:16px 24px;background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:2}nav a{font-size:12px;padding:6px 10px;border:1px solid var(--line);color:inherit;text-decoration:none}section{padding:32px 24px;border-bottom:1px solid var(--line)}h2{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px}.row{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr);gap:24px;align-items:start}figure{margin:0;background:#fff;border:1px solid var(--line)}figure img{width:100%;height:auto;display:block;max-height:1600px;object-fit:cover;object-position:top}figcaption{font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid var(--line)}@media(max-width:800px){.row{grid-template-columns:1fr}}</style></head>
<body><header><h1>CNM Essentials — visual review board</h1><p>Staging build · ${new Date().toISOString().slice(0, 10)} · ${results.length} screenshots across desktop (1440px) and mobile (390px). Product imagery, logo and copy marked "Needs CNM approval" are placeholders awaiting CNM's original assets.</p></header>
<nav>${groups.map(({ s }) => `<a href="#${s.id}">${s.title}</a>`).join('')}</nav>
${groups.map(({ s, shots }) => `<section id="${s.id}"><h2>${s.title}</h2><div class="row">${['desktop', 'mobile'].map((k) => shots.find((x) => x.vp === k)).filter(Boolean).map((x) => `<figure><figcaption>${x.vp}</figcaption><a href="${x.file}"><img src="${x.file}" alt="${s.title} — ${x.vp}" loading="lazy"></a></figure>`).join('')}</div></section>`).join('')}
</body></html>`);
console.log(`\nReview board: docs/visual-review/index.html (${results.length} screenshots)`);

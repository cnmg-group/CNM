// Static build: renders every indexable page to HTML, bundles client code, and emits SEO infrastructure.
// Run: node scripts/build.mjs   (Netlify runs this as the build command)
import { cp, mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { marked } from 'marked';

import { productUrl, productImages, stockState } from '../src/shared/product.mjs';
import { renderPage, approval } from '../src/templates/layout.mjs';
import { homePage } from '../src/templates/home.mjs';
import { listingPage } from '../src/templates/shop.mjs';
import { productPage } from '../src/templates/product.mjs';
import { bagPage, wishlistPage, searchPage, checkoutPage, confirmationPage } from '../src/templates/commerce.mjs';
import { ACCOUNT_VIEWS, accountPage, loginPage, registerPage, resetPage } from '../src/templates/account.mjs';
import { storyPage, storesIndex, storePage, servicesPage, journalIndex, articlePage, infoPage, notFoundPage, styleguidePage, adminPage } from '../src/templates/content.mjs';
import { groupAbout, groupContactPage, groupHome } from '../src/templates/group.mjs';
import { labelFor, nextPage, SITES } from '../src/templates/company.mjs';
import { spectraPages } from '../src/templates/sites/spectra.mjs';
import { cnmworxPages } from '../src/templates/sites/cnmworx.mjs';
import { foundationPages } from '../src/templates/sites/foundation.mjs';
import { scentFinderPage } from '../src/templates/scent-finder.mjs';
import { productPlaceholder, PLACEHOLDER_KEYS, atmosphere, heroVessel } from './placeholders.mjs';
import { loadContent } from './content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const t0 = Date.now();


// ---------- environment ----------
const isProductionContext = process.env.CONTEXT === 'production';
// Indexing is only allowed when CNM has approved launch AND this is the production deploy.
const staging = !(isProductionContext && process.env.CNM_LAUNCH_APPROVED === 'true');
const siteUrl = (process.env.SITE_URL || (isProductionContext ? process.env.URL : process.env.DEPLOY_PRIME_URL) || 'http://localhost:8888').replace(/\/$/, '');
const ga = process.env.GA_MEASUREMENT_ID || '';

// ---------- content ----------
const content = await loadContent(ROOT);
const logoFile = ['cnm-logo.svg', 'cnm-logo.png', 'cnm-logo.webp'].find((f) => existsSync(path.join(ROOT, 'public/assets/brand', f)));

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// ---------- assets ----------
await cp(path.join(ROOT, 'public'), DIST, { recursive: true });
await mkdir(path.join(DIST, 'assets/fonts'), { recursive: true });
const fontSrc = path.join(ROOT, 'node_modules');
await cp(path.join(fontSrc, '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2'), path.join(DIST, 'assets/fonts/instrument-serif-400.woff2'));
await cp(path.join(fontSrc, '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2'), path.join(DIST, 'assets/fonts/instrument-serif-400-italic.woff2'));
await cp(path.join(fontSrc, '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2'), path.join(DIST, 'assets/fonts/hanken-grotesk-var.woff2'));

await mkdir(path.join(DIST, 'assets/placeholders'), { recursive: true });
for (const key of PLACEHOLDER_KEYS) {
  await writeFile(path.join(DIST, `assets/placeholders/${key}.svg`), productPlaceholder(key));
  await writeFile(path.join(DIST, `assets/placeholders/${key}-alt.svg`), productPlaceholder(key, true));
}
await mkdir(path.join(DIST, 'assets/art'), { recursive: true });
await writeFile(path.join(DIST, 'assets/art/tile-green.svg'), atmosphere(3, { tone: 'green' }));
await writeFile(path.join(DIST, 'assets/art/tile-cream.svg'), atmosphere(5, { tone: 'cream' }));
await writeFile(path.join(DIST, 'assets/art/tile-stone.svg'), atmosphere(8, { tone: 'stone' }));
await writeFile(path.join(DIST, 'assets/art/hero-vessel.svg'), heroVessel());

// Client bundles (code-split per page, hashed for immutable caching)
const bundle = await esbuild.build({
  entryPoints: { main: path.join(ROOT, 'src/client/main.js'), admin: path.join(ROOT, 'src/client/admin/admin.js'), site: path.join(ROOT, 'src/styles/site.css'), 'admin-ui': path.join(ROOT, 'src/styles/admin.css') },
  bundle: true, splitting: true, format: 'esm', minify: true, sourcemap: false, target: ['es2020', 'safari15'],
  outdir: path.join(DIST, 'assets/build'), entryNames: '[name]-[hash]', chunkNames: 'chunks/[name]-[hash]', assetNames: '[name]-[hash]',
  external: ['/assets/fonts/*'], metafile: true, legalComments: 'none',
  define: { __STAGING__: JSON.stringify(staging) },
});
const outputs = Object.entries(bundle.metafile.outputs);
const findOut = (entry) => '/' + path.relative(DIST, outputs.find(([, o]) => o.entryPoint && o.entryPoint.endsWith(entry))[0]).split(path.sep).join('/');
const assets = { js: findOut('src/client/main.js'), css: findOut('src/styles/site.css'), adminJs: findOut('src/client/admin/admin.js'), adminCss: findOut('src/styles/admin.css') };

// Only expose categories the catalogue actually supports
content.categories = content.categories.filter((c) => c.showWhenEmpty || content.products.some((p) => p.category === c.slug));
content.brands = [...new Set(content.products.map((p) => p.brand))].sort((a, b) => content.products.filter((p) => p.brand === b).length - content.products.filter((p) => p.brand === a).length);
content.collections = content.collections.filter((c) => content.products.some((p) => p.collections.includes(c.slug)));
const ctx = { ...content, siteUrl, staging, ga, assets, logoFile: logoFile ? `/assets/brand/${logoFile}` : null };

// ---------- page writer ----------
const pages = []; // for sitemap
async function write(route, html, { sitemap = true, priority = 0.5, changefreq = 'weekly' } = {}) {
  const file = route.endsWith('.html') ? path.join(DIST, route) : path.join(DIST, route, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  if (sitemap) pages.push({ route, priority, changefreq });
}
const page = (o) => renderPage(ctx, o);

// Home
await write('/essentials/', page({
  page: 'home', path: '/essentials/', header: 'overlay', body: homePage(ctx),
  description: 'CNM Essentials — home fragrance, diffuser oils, smart scent machines and body care. Shop online or visit us in Lagos and Abuja.',
  jsonld: [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'CNM Essentials', url: `${siteUrl}/essentials/`, ...(ctx.logoFile ? { logo: `${siteUrl}/assets/brand/cnm-logo.png` } : {}), parentOrganization: { '@type': 'Organization', name: 'CNM Group', url: content.site.groupUrl }, sameAs: content.site.social.filter((s) => s.url).map((s) => s.url) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CNM Essentials', url: siteUrl, potentialAction: { '@type': 'SearchAction', target: `${siteUrl}/search/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
  ],
}), { priority: 1, changefreq: 'daily' });

// Listing pages
const { products, categories, collections } = content;
const listings = [
  { route: '/shop/', title: 'Shop now', intro: content.site.shopIntro.value, products, trail: [{ name: 'Shop', path: '/shop/' }], list: 'shop_all', current: 'all' },
  ...categories.map((c) => ({ route: `/shop/${c.slug}/`, title: c.name, intro: c.intro, introStatus: c.introStatus, products: products.filter((p) => p.category === c.slug), trail: [{ name: 'Shop', path: '/shop/' }, { name: c.name, path: `/shop/${c.slug}/` }], list: `category_${c.slug}`, showCategoryFacet: false, current: c.slug, seo: c.seo, extraHead: c.banner ? `<img src="${c.banner}" alt="${c.name} — CNM Essentials campaign" width="1094" height="1092" style="width:min(100%,420px);aspect-ratio:1;object-fit:cover;margin-top:8px">` : '' })),
  ...collections.map((c) => ({ route: `/collections/${c.slug}/`, title: c.name, intro: c.intro, introStatus: c.introStatus, products: products.filter((p) => p.collections.includes(c.slug)), trail: [{ name: 'Collections', path: '/shop/' }, { name: c.name, path: `/collections/${c.slug}/` }], list: `collection_${c.slug}`, current: c.slug })),
];
for (const l of listings) {
  const { body, jsonld } = listingPage(ctx, l);
  const pageKey = l.route === '/shop/' ? 'shop' : 'plp';
  await write(l.route, page({ page: 'plp', path: l.route, title: l.title, description: `${l.title} at CNM Essentials. ${l.intro || ''}`.trim(), body, jsonld, current: 'shop' }), { priority: pageKey === 'shop' ? 0.9 : 0.8, changefreq: 'daily' });
}

// Gift options (no gift products verified yet)
{
  const { body, jsonld } = listingPage(ctx, {
    title: 'Gift options', intro: 'Gifting at CNM Essentials.', introStatus: 'NEEDS_CNM_APPROVAL', products: [], trail: [{ name: 'Gift options', path: '/gifts/' }], list: 'gifts', tabs: false,
    extra: `<div style="max-width:640px;margin-bottom:32px">${approval('Gift sets, gift wrapping and gift cards.', 'No gift products are listed until CNM confirms what is offered.')}</div>`,
  });
  await write('/gifts/', page({ page: 'plp', path: '/gifts/', title: 'Gift options', body, jsonld, noindex: true }), { sitemap: false });
}

// Product pages
for (const p of products) {
  const { body, jsonld } = productPage(ctx, p);
  const cat = categories.find((c) => c.slug === p.category);
  await write(productUrl(p), page({
    page: 'pdp', path: productUrl(p), ogType: 'product',
    title: p.seo?.title || `${p.name}${cat ? ` — ${cat.name}` : ''}`,
    description: p.seo?.description || (p.description ? p.description.slice(0, 155) : `${p.name} by CNM Essentials. ${cat ? `Shop ${cat.name.toLowerCase()} online` : 'Shop online'} with delivery across Nigeria or collect in Lagos and Abuja.`),
    body, jsonld,
    head: `<meta property="product:price:currency" content="NGN">`,
  }), { priority: 0.8 });
}

// Scent finder (AI-assisted recommendations; rules fallback when no AI gateway is configured)
{ const r = scentFinderPage(ctx); await write('/scent-finder/', page({ page: 'scent-finder', path: '/scent-finder/', title: 'Scent finder — find your home fragrance', current: 'finder', body: r.body, jsonld: r.jsonld, description: 'Tell us the scents you love, the room and the mood you want. The CNM Essentials scent finder suggests room sprays, Wallflowers refills and more.' }), { priority: 0.7, changefreq: 'monthly' }); }

// Commerce shells (noindex)
await write('/bag/', page({ page: 'bag', path: '/bag/', title: 'Bag', body: bagPage(ctx), noindex: true }), { sitemap: false });
await write('/wishlist/', page({ page: 'wishlist', path: '/wishlist/', title: 'Wishlist', body: wishlistPage(ctx), noindex: true }), { sitemap: false });
await write('/search/', page({ page: 'search', path: '/search/', title: 'Search', body: searchPage(ctx), noindex: true }), { sitemap: false });
await write('/checkout/', page({ page: 'checkout', path: '/checkout/', title: 'Checkout', header: 'checkout', body: checkoutPage(ctx), noindex: true }), { sitemap: false });
await write('/checkout/confirmation/', page({ page: 'confirmation', path: '/checkout/confirmation/', title: 'Order confirmation', header: 'checkout', body: confirmationPage(ctx), noindex: true }), { sitemap: false });

// Account
await write('/account/login/', page({ page: 'auth', path: '/account/login/', title: 'Sign in', body: loginPage(), noindex: true }), { sitemap: false });
await write('/account/register/', page({ page: 'auth', path: '/account/register/', title: 'Create account', body: registerPage(), noindex: true }), { sitemap: false });
await write('/account/reset/', page({ page: 'auth', path: '/account/reset/', title: 'Reset password', body: resetPage(), noindex: true }), { sitemap: false });
for (const v of ACCOUNT_VIEWS) await write(v.path, page({ page: 'account', path: v.path, title: v.title, body: accountPage(v.view), noindex: true }), { sitemap: false });

// Brand & content
{ const r = storyPage(ctx); await write('/our-story/', page({ page: 'story', path: '/our-story/', header: 'overlay', title: 'Our story', current: 'story', body: r.body, jsonld: r.jsonld }), { priority: 0.7, changefreq: 'monthly' }); }
{ const r = storesIndex(ctx); await write('/stores/', page({ page: 'stores', path: '/stores/', title: 'Stores — Lagos & Abuja', current: 'stores', body: r.body, jsonld: r.jsonld, description: 'Visit CNM Essentials in Lagos and Abuja. Store addresses, opening hours, directions and in-store services.' }), { priority: 0.8, changefreq: 'monthly' }); }
for (const s of content.stores) {
  const r = storePage(ctx, s);
  await write(`/stores/${s.slug}/`, page({ page: 'store', path: `/stores/${s.slug}/`, title: `CNM Essentials ${s.city} — store, hours & directions`, current: 'stores', body: r.body, jsonld: r.jsonld, description: `CNM Essentials ${s.city}: address, opening hours, phone, directions and in-store services including collect in store.` }), { priority: 0.8, changefreq: 'monthly' });
}
{ const r = servicesPage(ctx); await write('/fragrance-as-a-service/', page({ page: 'services', path: '/fragrance-as-a-service/', header: 'overlay', title: 'Fragrance as a Service — scenting for events, hospitality & business', current: 'services', body: r.body, jsonld: r.jsonld, description: 'Scenting for events, weddings, hospitality, offices and retail spaces from CNM Essentials. Enquire about Fragrance as a Service.' }), { priority: 0.8, changefreq: 'monthly' }); }
{ const r = journalIndex(ctx); await write('/journal/', page({ page: 'journal', path: '/journal/', title: 'Journal', body: r.body, jsonld: r.jsonld, description: 'Scent education, home fragrance guides and stories from CNM Essentials.' }), { priority: 0.6 }); }
for (const a of content.articles) {
  const r = articlePage(ctx, a);
  await write(`/journal/${a.slug}/`, page({ page: 'article', path: `/journal/${a.slug}/`, title: a.title, description: a.excerpt, ogType: 'article', body: r.body, jsonld: r.jsonld, noindex: a.status?.startsWith('DRAFT') }), { sitemap: !a.status?.startsWith('DRAFT'), priority: 0.6 });
}
// CNMGroup.com hub (group chrome): Home, About, Contact.
{ const r = groupHome(ctx); await write('/', page({ page: 'group', chrome: 'group', current: 'home', path: '/', title: 'CNM Group — Energy, Retail, Impact', description: content.site.group.intro, body: r.body, jsonld: r.jsonld }), { priority: 1, changefreq: 'weekly' }); }
{ const r = groupAbout(ctx); await write('/about/', page({ page: 'group', chrome: 'group', current: 'about', path: '/about/', title: 'About CNM Group', description: content.site.group.about, body: r.body + nextPage({ href: '/contact/', label: 'Contact CNM Group', eyebrow: 'Continue' }), jsonld: r.jsonld }), { priority: 0.8, changefreq: 'monthly' }); }
{ const r = groupContactPage(ctx); await write('/contact/', page({ page: 'group', chrome: 'group', current: 'contact', path: '/contact/', title: 'Contact CNM Group', description: 'Contact CNM Group about partnerships, investment, collaboration or any of our companies.', body: r.body + nextPage({ href: '/essentials/', label: 'Shop CNM Essentials', eyebrow: 'Explore our companies' }), jsonld: r.jsonld }), { priority: 0.6, changefreq: 'monthly' }); }

// Company websites: each with its own identity and a "Back to CNM Group" button.
for (const [site, pagesOf] of [['spectra', spectraPages], ['cnmworx', cnmworxPages], ['foundation', foundationPages]]) {
  const list = pagesOf(ctx);
  for (const [i, pg] of list.entries()) {
    const next = list[(i + 1) % list.length];
    const body = pg.body + nextPage({ href: next.path, label: labelFor(site, next.current), eyebrow: `Continue exploring ${SITES[site].name}` });
    await write(pg.path, page({ page: 'site', chrome: 'company', site, current: pg.current, path: pg.path, title: pg.title, description: pg.description, body, jsonld: pg.jsonld }), { priority: pg.current === 'home' ? 0.9 : 0.6, changefreq: 'monthly' });
  }
}

// Info pages
const pendingSection = (title, what) => `<section class="stack"><h2 class="h3">${title}</h2>${approval(what)}</section>`;
const info = [
  { path: '/delivery-returns/', title: 'Delivery & returns', sections: [
    `<section class="stack"><h2 class="h3">Delivery options</h2><table class="table"><thead><tr><th>Method</th><th>Timing</th><th>Fee</th></tr></thead><tbody>${content.commerce.deliveryMethods.map((d) => `<tr><td>${d.label}</td><td>${d.eta}</td><td>${d.fee ? `₦${d.fee.toLocaleString('en-NG')}` : 'Free'}${d.freeOver ? ` · free over ₦${d.freeOver.toLocaleString('en-NG')}` : ''}</td></tr>`).join('')}</tbody></table>${approval('Delivery methods, fees and timings above are staging values.')}</section>`,
    pendingSection('Returns', 'Returns and exchanges policy.'),
  ] },
  { path: '/faqs/', title: 'FAQs', sections: [pendingSection('Orders & delivery', 'Customer FAQs.'), pendingSection('Products', 'Product FAQs (usage, safety, refills).')] },
  { path: '/essentials/contact/', title: 'Contact', intro: 'We’re here to help with orders, products and services.', sections: [
    `<section class="stack"><h2 class="h3">Customer care</h2>${content.site.contact.email.value ? `<p><a class="textlink" href="mailto:${content.site.contact.email.value}">${content.site.contact.email.value}</a></p>` : approval('Customer care email, phone and WhatsApp.')}</section>`,
    `<section class="stack"><h2 class="h3">Stores</h2><p><a class="textlink" href="/stores/">Find a CNM store</a></p></section>`,
    `<section class="stack"><h2 class="h3">Business &amp; events</h2><p><a class="textlink" href="/fragrance-as-a-service/#enquire">Enquire about Fragrance as a Service</a></p></section>`,
  ] },
  { path: '/privacy/', title: 'Privacy notice', sections: [
    `<section class="stack prose"><p>This staging notice summarises how the platform is built to handle personal data. The final notice must be approved by CNM's legal counsel and comply with the Nigeria Data Protection Act 2023.</p><ul style="list-style:disc;padding-left:20px"><li>We collect only what is needed to fulfil orders, provide accounts and respond to enquiries.</li><li>Card details are handled by the payment provider and never stored by CNM.</li><li>Analytics cookies are only set with your consent.</li><li>Marketing messages are opt-in and every message includes an unsubscribe option.</li></ul></section>`,
    pendingSection('Full privacy notice', 'Legal privacy notice, data controller details and data subject request process.'),
  ] },
  { path: '/terms/', title: 'Terms of sale', sections: [pendingSection('Terms', 'Terms of sale and website terms of use.')] },
];
for (const i of info) { const r = infoPage(ctx, i); await write(i.path, page({ page: 'info', path: i.path, title: i.title, body: r.body, jsonld: r.jsonld, noindex: i.path === '/terms/' }), { priority: 0.3, changefreq: 'monthly' }); }

// Utility pages
await write('/404.html', page({ page: '404', path: '/404', title: 'Page not found', body: notFoundPage(ctx), noindex: true }), { sitemap: false });
await write('/styleguide/', page({ page: 'styleguide', path: '/styleguide/', title: 'Design system', body: styleguidePage(ctx), noindex: true }), { sitemap: false });
await write('/admin/', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>CNM Admin</title><link rel="icon" href="/assets/brand/cnm-mark.png"><link rel="stylesheet" href="${assets.css}"><link rel="stylesheet" href="${assets.adminCss}"><script type="module" src="${assets.adminJs}"></script></head><body data-page="admin"${ctx.logoFile ? ` data-logo="/assets/brand/cnm-logo-on-light.svg"` : ''}>${adminPage()}</body></html>`, { sitemap: false });

// ---------- data files ----------
const catalogue = {
  generatedAt: new Date().toISOString(), currency: 'NGN',
  products: products.map((p) => ({ ...p, url: productUrl(p), images: productImages(p), stockState: stockState(p).key })),
  categories, collections,
  commerce: { deliveryMethods: content.commerce.deliveryMethods, maxQtyPerLine: content.commerce.maxQtyPerLine, currency: 'NGN' },
};
await writeFile(path.join(DIST, 'catalogue.json'), JSON.stringify(catalogue));

const searchDocs = [
  ...products.map((p) => ({ type: 'product', id: p.id, title: p.name, url: productUrl(p), text: [p.productType, categories.find((c) => c.slug === p.category)?.name, p.description, p.scentFamily, p.scentNotes].filter(Boolean).join(' '), keywords: [...p.collections, p.category.replace(/-/g, ' '), p.brand, 'wallflowers'].filter((k) => k !== 'wallflowers' || /wallflower/i.test(p.productType)), image: productImages(p)[0].src, price: p.price.amount })),
  ...categories.map((c) => ({ type: 'category', title: c.name, url: `/shop/${c.slug}/`, text: c.intro, keywords: [c.slug.replace(/-/g, ' ')] })),
  ...collections.map((c) => ({ type: 'collection', title: c.name, url: `/collections/${c.slug}/`, text: c.intro, keywords: ['collection'] })),
  ...content.articles.map((a) => ({ type: 'article', title: a.title, url: `/journal/${a.slug}/`, text: `${a.excerpt} ${a.category}`, keywords: [] })),
  { type: 'service', title: 'Scent finder', url: '/scent-finder/', text: 'Find your scent by room, mood and budget. Personal fragrance recommendations.', keywords: ['scent finder', 'quiz', 'recommend', 'recommendation', 'which scent', 'gift ideas'] },
  { type: 'service', title: 'Fragrance as a Service', url: '/fragrance-as-a-service/', text: content.services.lead.value, keywords: content.services.sectors.map((s) => s.name).concat(['scenting', 'commercial', 'event', 'wedding', 'hotel', 'office']) },
  ...content.stores.map((s) => ({ type: 'store', title: `${s.city} store`, url: `/stores/${s.slug}/`, text: `CNM Essentials ${s.city} store opening hours directions`, keywords: ['store', 'shop', 'location', s.region] })),
];
await writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(searchDocs));

// ---------- SEO infrastructure ----------
const today = new Date().toISOString().slice(0, 10);
await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${siteUrl}${p.route}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`);
await writeFile(path.join(DIST, 'robots.txt'), staging
  ? '# Staging build — not for indexing\nUser-agent: *\nDisallow: /\n'
  : `User-agent: *\nDisallow: /admin/\nDisallow: /account/\nDisallow: /checkout/\nDisallow: /bag/\nDisallow: /api/\nDisallow: /search/\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

// Google Merchant Center feed — only products with approved prices and real imagery are eligible.
const eligible = products.filter((p) => !p.price.demo && p.price.amount != null && p.images.length && p.description);
await mkdir(path.join(DIST, 'feeds'), { recursive: true });
await writeFile(path.join(DIST, 'feeds/google-merchant.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>CNM Essentials</title><link>${siteUrl}</link><description>CNM Essentials product feed</description>
${eligible.map((p) => `<item><g:id>${p.id}</g:id><g:title><![CDATA[${p.name}]]></g:title><g:description><![CDATA[${p.description}]]></g:description><g:link>${siteUrl}${productUrl(p)}</g:link><g:image_link>${siteUrl}${p.images[0].src}</g:image_link><g:availability>${stockState(p).key === 'out' ? 'out_of_stock' : 'in_stock'}</g:availability><g:price>${p.price.amount} NGN</g:price><g:brand>${p.brand}</g:brand><g:condition>new</g:condition>${p.gtin ? `<g:gtin>${p.gtin}</g:gtin>` : '<g:identifier_exists>no</g:identifier_exists>'}</item>`).join('\n')}
</channel></rss>
`);

// Netlify redirects (admin-managed redirects are merged from content/redirects.json)
const redirects = content.redirects.map((r) => `${r.from} ${r.to} ${r.status || 301}`).join('\n');
await writeFile(path.join(DIST, '_redirects'), `${redirects}
/account/orders/:number  /account/orders/view/?n=:number  200
/cnm-group/  /  301
/cnm-group/contact/  /contact/  301
/cnm-group/spectra/  /spectra/  301
/cnm-group/cnmworx/  /cnmworx/  301
/cnm-group/foundation/  /foundation/  301
/cnm-group/*  /  301
# CNM Essentials' own domain opens the shop home (the shop's other paths are shared with CNMGroup.com).
https://cnmessentials.com/  /essentials/  200!
https://www.cnmessentials.com/  /essentials/  200!
`);

// Security & caching headers
const csp = [
  "default-src 'self'",
  "script-src 'self' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  'frame-src https://www.google.com https://checkout.paystack.com',
  "form-action 'self' https://checkout.paystack.com",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');
await writeFile(path.join(DIST, '_headers'), `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
${staging ? '  X-Robots-Tag: noindex, nofollow\n' : ''}
/assets/build/*
  Cache-Control: public, max-age=31536000, immutable
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/placeholders/*
  Cache-Control: public, max-age=86400
/*.json
  Cache-Control: public, max-age=60, must-revalidate
/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
/account/*
  Cache-Control: no-store
/.well-known/apple-app-site-association
  Content-Type: application/json
`);

// ---------- report ----------
const files = await countFiles(DIST);
console.log(`CNM build complete in ${Date.now() - t0}ms — ${pages.length} indexable pages, ${files} files. staging=${staging} site=${siteUrl}`);
for (const [f, o] of outputs) if (o.entryPoint) console.log(`  ${path.relative(DIST, f)}  ${(o.bytes / 1024).toFixed(1)} KB`);

async function countFiles(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) n += e.isDirectory() ? await countFiles(path.join(dir, e.name)) : 1;
  return n;
}

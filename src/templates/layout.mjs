import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';

export const approval = (what, detail = '') =>
  `<div class="approval" role="note"><strong>Needs CNM approval</strong>${escapeHtml(what)}${detail ? ` <span>${escapeHtml(detail)}</span>` : ''}</div>`;

export function logo(ctx, { footer = false } = {}) {
  const inner = ctx.logoFile
    ? `<img src="${ctx.logoFile}" alt="CNM Essentials" width="160" height="28">`
    : `<span><span class="logo__wordmark">CNM Essentials</span>${footer ? '' : '<span class="logo__flag">Logo placeholder · original file pending</span>'}</span>`;
  return `<a class="logo" href="/" aria-label="CNM Essentials — home">${inner}</a>`;
}

function megaMenu(ctx) {
  const cats = ctx.categories.map((c) => `<li><a href="/shop/${c.slug}/">${escapeHtml(c.name)}</a></li>`).join('');
  const cols = ctx.collections.map((c) => `<li><a href="/collections/${c.slug}/">${escapeHtml(c.name)}</a></li>`).join('');
  return `<div class="mega" id="mega-shop" data-mega>
  <div class="container mega__grid">
    <div><h3 class="label">Shop</h3><ul><li><a href="/shop/new-in/">New in</a></li><li><a href="/shop/">Shop all</a></li><li><a href="/shop/best-sellers/">Best sellers</a></li><li><a href="/gifts/">Gift options</a></li></ul></div>
    <div><h3 class="label">Categories</h3><ul>${cats}</ul></div>
    <div><h3 class="label">Collections &amp; services</h3><ul>${cols}<li><a href="/fragrance-as-a-service/">Fragrance as a Service</a></li><li><a href="/stores/">Stores</a></li></ul></div>
    <a class="mega__feature" href="/shop/smart-scent-machines/"><span class="label">Smart scent technology</span><span class="h2" style="font-size:2rem">Scent, on schedule.</span></a>
  </div>
</div>`;
}

function header(ctx, mode, current) {
  if (mode === 'checkout') {
    return `<header class="site-header checkout-header"><div class="container site-header__row">
      <div><a class="link" href="/bag/">${icon('arrowLeft')} Back to bag</a></div>${logo(ctx)}
      <div class="site-header__right"><span class="label muted" style="display:inline-flex;gap:6px;align-items:center">${icon('lock', 'sr-lock')} Secure checkout</span></div>
    </div></header>`;
  }
  const cur = (k) => (current === k ? ' aria-current="page"' : '');
  return `<header class="site-header${mode === 'overlay' ? ' site-header--overlay' : ''}" data-header>
  <div class="container site-header__row">
    <div class="site-header__left">
      <button class="icon-btn menu-toggle" type="button" data-open="mobile-menu" aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu">${icon('menu')}</button>
      <nav aria-label="Primary"><ul class="primary-nav">
        <li><button type="button" data-mega-toggle aria-expanded="false" aria-controls="mega-shop"${cur('shop')}>Shop</button></li>
        <li><a href="/shop/new-in/"${cur('new')}>New in</a></li>
        <li><a href="/fragrance-as-a-service/"${cur('services')}>Fragrance as a Service</a></li>
        <li><a href="/our-story/"${cur('story')}>Our story</a></li>
        <li><a href="/stores/"${cur('stores')}>Stores</a></li>
      </ul></nav>
    </div>
    ${logo(ctx)}
    <div class="site-header__right">
      <button class="icon-btn" type="button" data-open="search" aria-label="Search" aria-controls="search-overlay" aria-expanded="false">${icon('search')}</button>
      <a class="icon-btn hide-sm" href="/account/" aria-label="Account" data-account-link>${icon('user')}</a>
      <a class="icon-btn" href="/wishlist/" aria-label="Wishlist">${icon('heart')}<span class="badge-count" data-wish-count></span></a>
      <button class="icon-btn" type="button" data-open="bag" aria-controls="bag-drawer" aria-expanded="false" aria-label="Bag">${icon('bag')}<span class="badge-count" data-bag-count></span></button>
    </div>
  </div>
  ${megaMenu(ctx)}
</header>`;
}

function mobileMenu(ctx) {
  const cats = ctx.categories.map((c) => `<li><a href="/shop/${c.slug}/">${escapeHtml(c.name)}</a></li>`).join('');
  return `<div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" data-panel="mobile-menu" hidden>
  <div class="mobile-menu__top">${logo(ctx)}<button class="icon-btn" type="button" data-close aria-label="Close menu">${icon('close')}</button></div>
  <nav aria-label="Mobile"><ul>
    <li><details open><summary>Shop ${icon('plus', 'sr-only')}</summary><ul><li><a href="/shop/new-in/">New in</a></li><li><a href="/shop/">Shop all</a></li>${cats}<li><a href="/collections/stoneglow/">Stoneglow</a></li><li><a href="/gifts/">Gift options</a></li></ul></details></li>
    <li><a href="/fragrance-as-a-service/">Fragrance as a Service</a></li>
    <li><a href="/our-story/">Our story</a></li>
    <li><a href="/stores/">Stores</a></li>
    <li><a href="/journal/">Journal</a></li>
  </ul></nav>
  <div class="mobile-menu__foot">
    <a href="/account/" class="link">${icon('user')} Account</a>
    <a href="/wishlist/" class="link">${icon('heart')} Wishlist</a>
    <a href="/cnm-group/" class="muted">CNM Group — Energy · Retail · Impact</a>
  </div>
</div>`;
}

function overlays() {
  return `<div class="scrim" data-scrim></div>
<aside class="drawer" id="bag-drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title" data-panel="bag" hidden>
  <div class="drawer__head"><h2 id="bag-title" class="label">Your bag <span data-bag-count-text></span></h2><button class="icon-btn" type="button" data-close aria-label="Close bag">${icon('close')}</button></div>
  <div class="drawer__body" data-bag-lines><p class="muted">Your bag is empty.</p></div>
  <div class="drawer__foot" data-bag-foot hidden>
    <div class="totals"><div><span>Subtotal</span><strong data-bag-subtotal></strong></div><div class="muted" style="font-size:.8125rem"><span>Delivery and discounts calculated at checkout</span></div></div>
    <a class="btn btn--green btn--block" href="/checkout/" data-begin-checkout>Checkout</a>
    <a class="btn btn--ghost btn--block" href="/bag/">View bag</a>
  </div>
</aside>
<div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="Search" data-panel="search" hidden>
  <div class="container">
    <form class="search-bar" action="/search/" role="search" data-search-form>
      ${icon('search')}
      <label for="q" class="sr-only">Search CNM Essentials</label>
      <input id="q" name="q" type="search" placeholder="Search products, scents, services…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="search-suggest" aria-autocomplete="list" data-search-input>
      <button class="icon-btn" type="button" data-close aria-label="Close search">${icon('close')}</button>
    </form>
    <div class="search-panel" data-search-panel>
      <div data-search-aside></div>
      <div id="search-suggest" role="listbox" aria-label="Suggestions" data-search-results></div>
    </div>
  </div>
</div>
<div class="toast-region" aria-live="polite" data-toasts></div>
<div class="cnm-loader" data-loader role="status" aria-live="polite" aria-hidden="true">
  <div>${butterflySVG()}<div class="cnm-loader__label">Loading</div></div>
</div>
<div class="consent" data-consent hidden></div>`;
}

export const butterflySVG = () => `<svg class="butterfly" viewBox="0 0 72 56" aria-hidden="true">
  <path class="wing wing--l" d="M34 30 C 26 8, 6 2, 3 14 C 1 24, 14 34, 34 32 C 18 36, 10 48, 18 52 C 26 55, 32 42, 34 32 Z"/>
  <path class="wing wing--r" d="M38 30 C 46 8, 66 2, 69 14 C 71 24, 58 34, 38 32 C 54 36, 62 48, 54 52 C 46 55, 40 42, 38 32 Z"/>
  <path class="drop" d="M36 14 C 42 24, 46 30, 46 36 A 10 10 0 0 1 26 36 C 26 30, 30 24, 36 14 Z"/>
</svg>`;

function footer(ctx) {
  const cats = ctx.categories.map((c) => `<li><a href="/shop/${c.slug}/">${escapeHtml(c.name)}</a></li>`).join('');
  const social = ctx.site.social.filter((s) => s.url).map((s) => `<li><a href="${escapeHtml(s.url)}" rel="me noopener" target="_blank">${escapeHtml(s.network)}</a></li>`).join('');
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="stack">
        ${logo(ctx, { footer: true })}
        <p style="max-width:28rem">New arrivals, rituals and stories from CNM — sent sparingly.</p>
        <form class="inline-form" data-newsletter="footer" novalidate>
          <label for="nl-footer" class="sr-only">Email address</label>
          <input id="nl-footer" type="email" name="email" placeholder="Email address" autocomplete="email" required>
          <input type="hidden" name="consent" value="true">
          <button type="submit">Subscribe</button>
        </form>
        <p class="muted" style="font-size:.75rem">By subscribing you agree to receive marketing emails. Unsubscribe any time. See our <a class="textlink" href="/privacy/">privacy notice</a>.</p>
      </div>
      <div><h2>Shop</h2><ul><li><a href="/shop/new-in/">New in</a></li>${cats}<li><a href="/collections/stoneglow/">Stoneglow</a></li></ul></div>
      <div><h2>Help</h2><ul><li><a href="/delivery-returns/">Delivery &amp; returns</a></li><li><a href="/faqs/">FAQs</a></li><li><a href="/contact/">Contact</a></li><li><a href="/account/orders/">Track an order</a></li></ul></div>
      <div><h2>CNM</h2><ul><li><a href="/our-story/">Our story</a></li><li><a href="/stores/">Stores</a></li><li><a href="/fragrance-as-a-service/">Fragrance as a Service</a></li><li><a href="/journal/">Journal</a></li><li><a href="/cnm-group/">CNM Group</a></li></ul></div>
      <div><h2>Follow</h2><ul>${social || '<li class="muted">Social links pending CNM approval</li>'}</ul></div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} CNM Essentials. Part of CNM Group.</span>
      <span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <button type="button" data-consent-open class="textlink" style="font-size:inherit;color:inherit">Cookie settings</button></span>
    </div>
  </div>
</footer>`;
}

export function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

/**
 * @param {object} ctx build context
 * @param {object} o page options
 */
export function renderPage(ctx, o) {
  const url = `${ctx.siteUrl}${o.path}`;
  const ov = ctx.seo?.[o.path];
  if (ov?.title) o = { ...o, title: ov.title };
  if (ov?.description) o = { ...o, description: ov.description };
  const title = o.title ? `${o.title} | CNM Essentials` : 'CNM Essentials — Home fragrance, body care & smart scenting';
  const description = o.description || 'CNM Essentials: home fragrance, diffuser oils, body care and smart scent technology from Nigeria, with stores in Lagos and Abuja.';
  const noindex = ctx.staging || o.noindex;
  const og = o.ogImage ? `${ctx.siteUrl}${o.ogImage}` : `${ctx.siteUrl}/assets/og-default.png`;
  const mode = o.header || 'solid';
  const ld = (o.jsonld || []).map(jsonLd).join('\n');
  return `<!doctype html>
<html lang="en-NG" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="#153f32">
<meta property="og:site_name" content="CNM Essentials">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${escapeHtml(o.title || 'CNM Essentials')}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="en_NG">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/hanken-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-serif-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ctx.assets.css}">
${o.head || ''}
${ld}
<script type="module" src="${ctx.assets.js}"></script>
</head>
<body data-page="${o.page}"${ctx.ga ? ` data-ga="${escapeHtml(ctx.ga)}"` : ''}>
<a class="skip-link" href="#main">Skip to content</a>
${ctx.staging ? `<div class="staging-bar">Staging preview — prices, stock and imagery are demo values awaiting CNM approval. No real payments are taken. <a href="/styleguide/">Design system</a></div>` : ''}
${ctx.announcement && mode !== 'checkout' ? `<div class="announce-bar">${ctx.announcement.href ? `<a href="${escapeHtml(ctx.announcement.href)}">${escapeHtml(ctx.announcement.message)}</a>` : escapeHtml(ctx.announcement.message)}</div>` : ''}
${header(ctx, mode, o.current)}
${mode === 'checkout' ? '' : mobileMenu(ctx)}
<main id="main" tabindex="-1">
${o.body}
</main>
${mode === 'checkout' ? '' : footer(ctx)}
${overlays()}
</body>
</html>`;
}

export function breadcrumbs(ctx, trail) {
  const items = [{ name: 'Home', path: '/' }, ...trail];
  const html = `<nav aria-label="Breadcrumb"><ol class="breadcrumbs">${items
    .map((c, i) => (i === items.length - 1 ? `<li aria-current="page">${escapeHtml(c.name)}</li>` : `<li><a href="${c.path}">${escapeHtml(c.name)}</a></li>`))
    .join('')}</ol></nav>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${ctx.siteUrl}${c.path}` })),
  };
  return { html, ld };
}

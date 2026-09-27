import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { groupFooter, groupHeader } from './group.mjs';
import { companyFooter, companyHeader, SITES } from './company.mjs';
import { cnmNav, themeToggle } from './kit.mjs';

export const approval = (what, detail = '') =>
  `<div class="approval" role="note"><strong>Needs CNM approval</strong>${escapeHtml(what)}${detail ? ` <span>${escapeHtml(detail)}</span>` : ''}</div>`;

export function logo(ctx, { footer = false } = {}) {
  // Background-free logo: charcoal "CNM" on light surfaces, the original light "CNM" on dark ones (footer, transparent hero header).
  const alt = 'CNM Essentials — crafting serenity, pioneering comfort';
  const inner = ctx.logoFile
    ? (footer
      ? `<img src="/assets/brand/cnm-logo-on-dark.svg" alt="${alt}" width="581" height="447">`
      : `<img class="logo__on-light" src="/assets/brand/cnm-logo-on-light.svg" alt="${alt}" width="581" height="447"><img class="logo__on-dark" src="/assets/brand/cnm-logo-on-dark.svg" alt="" width="581" height="447" aria-hidden="true">`)
    : `<span><span class="logo__wordmark">CNM Essentials</span>${footer ? '' : '<span class="logo__flag">Logo placeholder · original file pending</span>'}</span>`;
  return `<a class="logo" href="/essentials/" aria-label="CNM Essentials — home">${inner}</a>`;
}

function megaMenu(ctx) {
  const cats = ctx.categories.map((c) => `<li><a href="/shop/${c.slug}/">${escapeHtml(c.name)}</a></li>`).join('');
  const brands = ctx.brands.map((b) => `<li><a href="/shop/?brand=${encodeURIComponent(b)}">${escapeHtml(b)}</a></li>`).join('');
  const feature = ctx.categories.find((c) => c.banner);
  return `<div class="mega" id="mega-shop" data-mega>
  <div class="container mega__grid">
    <div><h3 class="label">Shop</h3><ul><li><a href="/shop/">Shop all</a></li><li><a href="/gifts/">Gift options</a></li><li><a href="/scent-finder/">Scent finder</a></li><li><a href="/fragrance-as-a-service/">Lease-to-Own diffusers</a></li><li><a href="/stores/">Stores</a></li></ul></div>
    <div><h3 class="label">Categories</h3><ul>${cats}</ul></div>
    <div><h3 class="label">Brands</h3><ul>${brands}</ul></div>
    ${feature ? `<a class="mega__feature" href="/shop/${feature.slug}/" style="padding:0;position:relative;overflow:hidden"><img src="${feature.banner}" alt="${escapeHtml(feature.name)}" loading="lazy" style="width:100%;height:100%;object-fit:contain;position:absolute;inset:0"></a>` : ''}
  </div>
</div>`;
}

function header(ctx, mode, current) {
  if (mode === 'checkout') {
    return `<header class="site-header checkout-header"><div class="container site-header__row">
      <div><a class="link" href="/bag/">${icon('arrowLeft')} Back to bag</a></div>${logo(ctx)}
      <div class="site-header__right">${themeToggle()}<span class="label muted" style="display:inline-flex;gap:6px;align-items:center">${icon('lock', 'sr-lock')} Secure checkout</span></div>
    </div></header>`;
  }
  const cur = (k) => (current === k ? ' aria-current="page"' : '');
  return `<header class="site-header${mode === 'overlay' ? ' site-header--overlay' : ''}" data-header>
  <div class="container site-header__row">
    <div class="site-header__left">
      <button class="icon-btn menu-toggle" type="button" data-open="mobile-menu" aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu">${icon('menu')}</button>
      <nav aria-label="Primary"><ul class="primary-nav">
        <li><button type="button" data-mega-toggle aria-expanded="false" aria-controls="mega-shop"${cur('shop')}>Shop</button></li>
        <li><a href="/scent-finder/"${cur('finder')}>Scent finder</a></li>
        <li><a href="/fragrance-as-a-service/"${cur('services')}>For business</a></li>
        <li><a href="/our-story/"${cur('story')}>Our story</a></li>
        <li><a href="/stores/"${cur('stores')}>Stores</a></li>
      </ul></nav>
    </div>
    ${logo(ctx)}
    <div class="site-header__right">
      ${themeToggle()}
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
    <li><details open><summary>Shop ${icon('plus', 'sr-only')}</summary><ul><li><a href="/shop/">Shop all</a></li>${cats}<li><a href="/gifts/">Gift options</a></li></ul></details></li>
    <li><a href="/scent-finder/">Scent finder</a></li>
    <li><a href="/fragrance-as-a-service/">For business</a></li>
    <li><a href="/our-story/">Our story</a></li>
    <li><a href="/stores/">Stores</a></li>
    <li><a href="/journal/">Journal</a></li>
  </ul></nav>
  <div class="mobile-menu__foot">
    <div class="mobile-menu__auth" data-signed-out><button class="btn btn--block" type="button" data-auth-open="signin">Sign in</button><button class="btn btn--ghost btn--block" type="button" data-auth-open="signup">Create account</button></div>
    <a href="/account/" class="link" data-signed-in hidden>${icon('user')} My account</a>
    <a href="/wishlist/" class="link">${icon('heart')} Wishlist</a>
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
<div class="auth-dialog" id="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" data-panel="auth" hidden>
  <div class="auth-dialog__head"><h2 id="auth-title" class="h3" data-auth-title>Sign in</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button></div>
  <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-auth-mode="signin">Sign in</button><button type="button" role="tab" aria-selected="false" data-auth-mode="signup">Create account</button></div>
  <p class="muted auth-dialog__reason" data-auth-reason hidden></p>
  <div class="alert alert--err" role="alert" data-auth-dialog-error hidden></div>
  <form class="form" data-auth-dialog-form novalidate>
    <div class="form-row" data-signup-only hidden><div class="field"><label for="ad-first">First name</label><input id="ad-first" name="firstName" autocomplete="given-name"></div><div class="field"><label for="ad-last">Last name</label><input id="ad-last" name="lastName" autocomplete="family-name"></div></div>
    <div class="field"><label for="ad-email">Email</label><input id="ad-email" name="email" type="email" autocomplete="email" required></div>
    <div class="field" data-ad-password hidden><label for="ad-pass">Password</label><input id="ad-pass" name="password" type="password" autocomplete="current-password"></div>
    <div class="field" data-ad-code hidden><label for="ad-code">6-digit code</label><input id="ad-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="otp-input"></div>
    <label class="check" data-signup-only hidden><input type="checkbox" name="marketingOptIn"> Email me about new arrivals and events (optional)</label>
    <button class="btn btn--green btn--block" type="submit" data-ad-submit>Email me a code</button>
    <p class="muted auth-dialog__note" data-ad-note aria-live="polite"></p>
    <div class="auth-dialog__links">
      <button class="textlink muted" type="button" data-ad-toggle-password>Use a password instead</button>
      <button class="textlink muted" type="button" data-ad-resend hidden disabled>Resend code</button>
    </div>
    <p class="muted auth-dialog__small" data-signup-only hidden>By creating an account you agree to our <a class="textlink" href="/terms/">terms</a> and <a class="textlink" href="/privacy/">privacy notice</a>.</p>
  </form>
</div>
<div class="modal modal--quickview" id="quickview" role="dialog" aria-modal="true" aria-labelledby="qv-title" data-panel="quickview" hidden>
  <button class="icon-btn modal__close" type="button" data-close aria-label="Close quick view">${icon('close')}</button>
  <div class="qv" data-qv-body></div>
</div>
<div class="modal modal--newsletter" id="newsletter-pop" role="dialog" aria-modal="true" aria-labelledby="nlp-title" data-panel="newsletter-pop" hidden>
  <button class="icon-btn modal__close" type="button" data-close aria-label="Close">${icon('close')}</button>
  <div class="nlp">
    <div class="nlp__art" aria-hidden="true"><img src="/assets/campaign/room-home-fragrance.webp" alt="" loading="lazy" width="1094" height="1090"></div>
    <div class="nlp__copy">
      <span class="label muted">CNM Essentials</span>
      <h2 id="nlp-title" class="nlp__title">Be first to know</h2>
      <p class="muted">New arrivals, restocks and in-store events in Lagos and Abuja. Unsubscribe any time.</p>
      <form class="inline-form inline-form--pop" data-newsletter="popup" novalidate>
        <label for="nl-pop" class="sr-only">Email address</label>
        <input id="nl-pop" type="email" name="email" placeholder="Your email address" autocomplete="email" required>
        <input type="hidden" name="consent" value="true">
        <button type="submit">Subscribe</button>
      </form>
      <p class="nlp__fine">By subscribing you agree to receive marketing emails. See our <a class="textlink" href="/privacy/">privacy notice</a>.</p>
      <button class="textlink muted nlp__no" type="button" data-close>No, thank you</button>
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
  const { site } = ctx;
  const cats = ctx.categories.map((c) => `<li><a href="/shop/${c.slug}/">${escapeHtml(c.name)}</a></li>`).join('');
  const social = site.social.filter((s) => s.url).map((s) => `<li><a href="${escapeHtml(s.url)}" rel="me noopener" target="_blank">${escapeHtml(s.network)}</a></li>`).join('');
  const nl = site.newsletter.value;
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="stack">
        ${logo(ctx, { footer: true })}
        <p style="max-width:28rem">${escapeHtml(site.motto.value)}</p>
        <p style="max-width:28rem" class="muted">${escapeHtml(nl.text)}</p>
        <form class="inline-form" data-newsletter="footer" novalidate>
          <label for="nl-footer" class="sr-only">Email address</label>
          <input id="nl-footer" type="email" name="email" placeholder="Enter your email" autocomplete="email" required>
          <input type="hidden" name="consent" value="true">
          <button type="submit">Subscribe</button>
        </form>
        <p style="font-size:.75rem;opacity:.7">By subscribing you agree to receive marketing emails. Unsubscribe any time. See our <a class="textlink" href="/privacy/">privacy notice</a>.</p>
      </div>
      <div><h2>Shop</h2><ul><li><a href="/shop/">Shop all</a></li>${cats}<li><a href="/scent-finder/">Scent finder</a></li></ul></div>
      <div><h2>Customer service</h2><ul><li><a href="/privacy/">Privacy policy</a></li><li><a href="/terms/">Terms &amp; conditions</a></li><li><a href="/delivery-returns/">Return policy</a></li><li><a href="/faqs/">FAQ</a></li><li><a href="/account/orders/">Track an order</a></li></ul></div>
      <div><h2>CNM</h2><ul><li><a href="/our-story/">About us</a></li><li><a href="/stores/">Stores</a></li><li><a href="/fragrance-as-a-service/">For business</a></li><li><a href="/journal/">Journal</a></li><li><a href="/">CNM Group</a></li>${social}</ul></div>
      <div><h2>Contact us</h2><ul>
        ${ctx.stores.map((s) => `<li style="display:flex;gap:8px">${icon('pin')}<a href="/stores/${s.slug}/">${escapeHtml(s.address || s.city)}, ${escapeHtml(s.region === 'FCT' ? 'FCT' : `${s.region} State`)}.</a></li>`).join('')}
        ${site.contact.phone.value ? `<li style="display:flex;gap:8px">${icon('phone')}<a href="tel:${site.contact.phone.value.replace(/\s/g, '')}">${escapeHtml(site.contact.phone.value)}</a></li>` : ''}
        ${site.contact.email.value ? `<li style="display:flex;gap:8px">${icon('mail')}<a href="mailto:${site.contact.email.value}">${escapeHtml(site.contact.email.value)}</a></li>` : ''}
      </ul></div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} CNM Essentials. All rights reserved. Part of <a class="textlink" href="/">CNM Group</a>.</span>
      <span class="pay-methods">We accept: ${site.acceptedPayments.value.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</span>
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
  const group = o.chrome === 'group';
  const company = o.chrome === 'company' ? SITES[o.site] : null;
  const brand = group ? 'CNM Group' : company ? company.name : 'CNM Essentials';
  const title = o.title ? `${o.title} | ${brand}` : 'CNM Essentials — Refresh your space. Indulge your senses.';
  const description = o.description || 'CNM Essentials — luxury room sprays, Wallflowers diffusers and refills, body care and home fragrance. Shop online or visit us in Lekki, Lagos and Garki, Abuja.';
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
<meta name="theme-color" content="#23221e">
<meta property="og:site_name" content="${brand}">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${escapeHtml(o.title || 'CNM Essentials')}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="en_NG">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/brand/cnm-mark.svg" type="image/svg+xml">
<link rel="icon" href="/assets/brand/cnm-mark.png" type="image/png" sizes="1024x1024">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/hanken-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-serif-400.woff2" as="font" type="font/woff2" crossorigin>
<script src="/assets/theme.js"></script>
<link rel="stylesheet" href="${ctx.assets.css}">
${o.head || ''}
${ld}
<script type="module" src="${ctx.assets.js}"></script>
</head>
<body data-page="${o.page}"${group ? ' data-chrome="group"' : ''}${company ? ` data-chrome="company" data-site="${o.site}"` : ''}${ctx.ga ? ` data-ga="${escapeHtml(ctx.ga)}"` : ''}>
<a class="skip-link" href="#main">Skip to content</a>
${ctx.staging ? `<div class="staging-bar">Staging preview — products, prices and imagery from cnmessentials.com; stock, delivery fees and policies await CNM approval. No real payments are taken.</div>` : ''}
${ctx.announcement && mode !== 'checkout' && !group && !company ? `<div class="announce-bar">${ctx.announcement.href ? `<a href="${escapeHtml(ctx.announcement.href)}">${escapeHtml(ctx.announcement.message)}</a>` : escapeHtml(ctx.announcement.message)}</div>` : ''}
${group ? groupHeader(ctx, o.current) : company ? companyHeader(ctx, o.site, o.current) : header(ctx, mode, o.current)}
${mode === 'checkout' || group || company ? '' : mobileMenu(ctx)}
<main id="main" tabindex="-1">
${o.body}
</main>
${mode === 'checkout' ? '' : group ? groupFooter(ctx) : company ? companyFooter(ctx, o.site) : footer(ctx)}
${overlays()}
${cnmNav(group ? 'group' : company ? o.site : 'essentials')}
</body>
</html>`;
}

export function breadcrumbs(ctx, trail, home = { name: 'Home', path: '/essentials/' }) {
  const items = [home, ...trail];
  const html = `<nav aria-label="Breadcrumb"><ol class="breadcrumbs">${items
    .map((c, i) => (i === items.length - 1 ? `<li aria-current="page">${escapeHtml(c.name)}</li>` : `<li><a href="${c.path}">${escapeHtml(c.name)}</a></li>`))
    .join('')}</ol></nav>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${ctx.siteUrl}${c.path}` })),
  };
  return { html, ld };
}

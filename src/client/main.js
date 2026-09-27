import { escapeHtml, formatMoney } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { productImages, productUrl, stockState } from '../shared/product.mjs';
import { initConsent, item, track } from './analytics.js';
import { api } from './api.js';
import { demoLoader } from './loader.js';
import * as S from './store.js';
import { close, formData, initUI, open, setBusy, toast } from './ui.js';
import { lineHTML, paintWish } from './render.js';
import { initMotion } from './motion.js';
import { priceHTML } from '../shared/card.mjs';

document.documentElement.classList.remove('no-js');
initUI();
initConsent();

// ---------- counts & wishlist state ----------
function paintCounts() {
  const bag = S.bagCount();
  const wish = S.getWish().length;
  document.querySelectorAll('[data-bag-count]').forEach((n) => { n.textContent = bag || ''; n.dataset.count = bag; });
  document.querySelectorAll('[data-wish-count]').forEach((n) => { n.textContent = wish || ''; n.dataset.count = wish; });
  document.querySelectorAll('[data-bag-count-text]').forEach((n) => { n.textContent = bag ? `(${bag})` : ''; });
}
S.on('bag', () => { paintCounts(); renderDrawer(); });
S.on('wish', () => { paintCounts(); paintWish(); });
paintCounts();
paintWish();

// ---------- live price/stock overrides onto server-rendered cards ----------
S.catalogue().then(({ byId }) => {
  document.querySelectorAll('[data-price]').forEach((n) => {
    const p = byId.get(n.dataset.price);
    if (p && p.price.amount != null) n.textContent = formatMoney(p.price.amount);
  });
}).catch(() => {});

// ---------- bag drawer ----------
async function renderDrawer() {
  const box = document.querySelector('[data-bag-lines]');
  if (!box) return;
  const lines = S.getBag();
  const foot = document.querySelector('[data-bag-foot]');
  if (!lines.length) {
    box.innerHTML = `<div class="empty-state" style="padding:48px 0"><p class="h3">Your bag is empty.</p><a class="btn" href="/shop/new-in/">Shop new in</a></div>`;
    foot.hidden = true;
    return;
  }
  const { byId } = await S.catalogue();
  let subtotal = 0;
  box.innerHTML = lines.map((l) => { const p = byId.get(l.id); if (!p) return ''; subtotal += (p.price.amount || 0) * l.qty; return lineHTML(p, l, { compact: true }); }).join('');
  foot.hidden = false;
  document.querySelector('[data-bag-subtotal]').textContent = formatMoney(subtotal);
}
document.querySelector('[data-panel="bag"]')?.addEventListener('panel:open', renderDrawer);

// ---------- global delegated actions ----------
document.addEventListener('click', async (e) => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const id = add.dataset.add;
    const qtyInput = add.hasAttribute('data-add-qty') ? document.querySelector('[data-qty-input]') : null;
    const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10));
    const { byId } = await S.catalogue();
    const p = byId.get(id);
    if (!p) return;
    const st = stockState(p);
    if (!st.orderable) { toast('This product is out of stock.'); return; }
    S.addToBag(id, qty, Math.min(10, p.stock?.quantity ?? 10));
    track('add_to_cart', { currency: 'NGN', value: (p.price.amount || 0) * qty, items: [item(p, { quantity: qty })] });
    if (add.closest('[data-panel]')) return;
    open('bag');
    return;
  }
  const buyNow = e.target.closest('[data-buy-now]');
  if (buyNow) {
    const qty = Math.max(1, parseInt(document.querySelector('[data-qty-input]')?.value || '1', 10));
    const { byId } = await S.catalogue();
    const p = byId.get(buyNow.dataset.buyNow);
    S.addToBag(p.id, qty, Math.min(10, p.stock?.quantity ?? 10));
    track('add_to_cart', { currency: 'NGN', value: (p.price.amount || 0) * qty, items: [item(p, { quantity: qty })] });
    location.href = '/checkout/';
    return;
  }
  const wish = e.target.closest('[data-wish]');
  if (wish) {
    e.preventDefault();
    const added = S.toggleWish(wish.dataset.wish);
    const { byId } = await S.catalogue();
    const p = byId.get(wish.dataset.wish);
    if (added) { track('add_to_wishlist', { currency: 'NGN', value: p?.price.amount, items: p ? [item(p)] : [] }); toast('Saved to your wishlist', { action: 'View', href: '/wishlist/' }); }
    return;
  }
  const lineRemove = e.target.closest('[data-line-remove]');
  if (lineRemove) {
    const id = lineRemove.dataset.lineRemove;
    const { byId } = await S.catalogue();
    const p = byId.get(id);
    const line = S.getBag().find((l) => l.id === id);
    S.removeFromBag(id);
    if (p && line) track('remove_from_cart', { currency: 'NGN', value: (p.price.amount || 0) * line.qty, items: [item(p, { quantity: line.qty })] });
    return;
  }
  const lineWish = e.target.closest('[data-line-wish]');
  if (lineWish) {
    const id = lineWish.dataset.lineWish;
    if (!S.inWish(id)) S.toggleWish(id);
    S.removeFromBag(id);
    toast('Moved to your wishlist', { action: 'View', href: '/wishlist/' });
    return;
  }
  const dec = e.target.closest('[data-line-dec]');
  const inc = e.target.closest('[data-line-inc]');
  if (dec || inc) {
    const id = (dec || inc).dataset[dec ? 'lineDec' : 'lineInc'];
    const line = S.getBag().find((l) => l.id === id);
    if (!line) return;
    const { byId } = await S.catalogue();
    const max = Math.min(10, byId.get(id)?.stock?.quantity ?? 10);
    const next = Math.min(max, line.qty + (inc ? 1 : -1));
    if (next <= 0) S.removeFromBag(id); else S.setQty(id, next);
    return;
  }
  if (e.target.closest('[data-begin-checkout]')) {
    const { byId } = await S.catalogue();
    const items = S.getBag().map((l) => byId.get(l.id) && item(byId.get(l.id), { quantity: l.qty })).filter(Boolean);
    track('begin_checkout', { currency: 'NGN', items });
  }
  if (e.target.closest('[data-demo-loader]')) demoLoader(2000);
  const card = e.target.closest('[data-product-card] a');
  if (card) {
    const c = card.closest('[data-product-card]');
    track('select_item', { item_list_name: c.dataset.list, items: [{ item_id: c.dataset.id, index: Number(c.dataset.position) }] });
  }
  const tracked = e.target.closest('[data-track]');
  if (tracked) track(tracked.dataset.track, { ...tracked.dataset });
});

document.addEventListener('change', (e) => {
  const q = e.target.closest('[data-line-qty]');
  if (!q) return;
  const v = Math.max(0, Math.min(Number(q.max) || 10, parseInt(q.value || '0', 10)));
  if (v <= 0) S.removeFromBag(q.dataset.lineQty); else S.setQty(q.dataset.lineQty, v);
});

// ---------- newsletter ----------
document.querySelectorAll('[data-newsletter]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    if (!input.checkValidity()) { input.setAttribute('aria-invalid', 'true'); toast('Please enter a valid email address.'); input.focus(); return; }
    const btn = form.querySelector('button');
    setBusy(btn, true, '');
    try {
      await api('/api/newsletter', { method: 'POST', body: { ...formData(form), consent: true, source: form.dataset.newsletter } });
      track('sign_up', { method: 'newsletter', location: form.dataset.newsletter });
      form.innerHTML = '<p style="padding:14px 0;margin:0">Thank you — you’re on the list.</p>';
    } catch (err) {
      toast(err.message || 'Something went wrong. Please try again.');
      setBusy(btn, false);
    }
  });
});

// ---------- product impressions ----------
if ('IntersectionObserver' in window) {
  const seen = new Set();
  const io = new IntersectionObserver((entries) => {
    const batch = {};
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const c = en.target;
      const key = `${c.dataset.list}:${c.dataset.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      (batch[c.dataset.list] ||= []).push({ item_id: c.dataset.id, index: Number(c.dataset.position) });
      io.unobserve(c);
    }
    for (const [list, items] of Object.entries(batch)) track('view_item_list', { item_list_name: list, items });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-product-card]').forEach((c) => io.observe(c));
}

// ---------- account: optional sign in / create account, never required to shop ----------
function paintAuth() {
  const u = S.getUser();
  document.querySelectorAll('[data-account-link]').forEach((a) => a.setAttribute('aria-label', u ? `Account — ${u.firstName || u.email}` : 'Sign in or create an account'));
  document.querySelectorAll('[data-signed-in]').forEach((n) => { n.hidden = !u; });
  document.querySelectorAll('[data-signed-out]').forEach((n) => { n.hidden = !!u; });
}
paintAuth();
S.on('user', paintAuth);
const openAuth = (mode, opts) => import('./auth-dialog.js').then((m) => m.openAuth(mode, opts));
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-auth-open]');
  if (trigger) { e.preventDefault(); openAuth(trigger.dataset.authOpen, { reason: trigger.dataset.authReason, email: trigger.dataset.authEmail }); return; }
  const account = e.target.closest('[data-account-link]');
  if (account && !S.getUser()) { e.preventDefault(); openAuth('signin', { reason: 'Optional: track orders, save addresses and keep your wishlist on web and app.' }); }
});

// ---------- search overlay (lazy) ----------
const searchPanel = document.querySelector('[data-panel="search"]');
searchPanel?.addEventListener('panel:open', () => import('./search-ui.js').then((m) => m.initOverlay(searchPanel)), { once: true });

// ---------- page modules (code-split) ----------
const PAGES = {
  plp: () => import('./pages/plp.js'),
  pdp: () => import('./pages/pdp.js'),
  bag: () => import('./pages/bag.js'),
  wishlist: () => import('./pages/wishlist.js'),
  search: () => import('./pages/search.js'),
  checkout: () => import('./pages/checkout.js'),
  confirmation: () => import('./pages/confirmation.js'),
  account: () => import('./pages/account.js'),
  auth: () => import('./pages/auth.js'),
  services: () => import('./pages/services.js'),
  group: () => import('./pages/services.js'),
  site: () => import('./pages/services.js'),
  'scent-finder': () => import('./pages/scent-finder.js'),
};
const pageKey = document.body.dataset.page;
PAGES[pageKey]?.().then((m) => m.init?.()).catch((err) => console.error('[cnm] page init failed', err));


// ---------- CNM Group and company-site menus: full-screen on phones, lock scroll while open, Escape closes ----------
document.querySelectorAll('[data-group-menu], [data-co-menu]').forEach((menu) => {
  const header = menu.closest('header');
  const panel = menu.querySelector('.gmenu, .co-menu__panel');
  const summary = menu.querySelector('summary');
  menu.addEventListener('toggle', () => {
    document.documentElement.style.overflow = menu.open ? 'hidden' : '';
    if (menu.open) panel.style.top = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
    summary.setAttribute('aria-label', menu.open ? 'Close menu' : 'Menu');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); } });
});

// ---------- Quick view pop-up (shop grids): see a product without leaving the page ----------
document.addEventListener('click', async (e) => {
  const qv = e.target.closest('[data-quickview]');
  if (!qv) return;
  e.preventDefault();
  const { byId } = await S.catalogue();
  const p = byId.get(qv.dataset.quickview);
  if (!p) return;
  const imgs = productImages(p);
  const st = stockState(p);
  const max = Math.min(10, p.stock?.quantity ?? 10);
  document.querySelector('[data-qv-body]').innerHTML = `
    <div class="qv__media">${imgs.slice(0, 3).map((im, i) => `<img src="${im.src}" alt="${i ? '' : escapeHtml(im.alt || p.name)}" width="800" height="1000"${i ? ' loading="lazy"' : ''}>`).join('')}</div>
    <div class="qv__info">
      <span class="label muted">${escapeHtml(p.brand)} · ${escapeHtml(p.productType)}</span>
      <h2 id="qv-title" class="qv__title">${escapeHtml(p.name)}</h2>
      <div class="qv__price">${priceHTML(p)}</div>
      <p class="qv__stock ${st.key === 'out' ? 'stock-out' : st.key === 'low' ? 'stock-low' : ''}">${escapeHtml(st.label || 'In stock')}</p>
      ${p.description ? `<p class="muted">${escapeHtml(p.description)}</p>` : ''}
      ${st.orderable ? `<div class="qv__buy"><div class="qty" role="group" aria-label="Quantity"><button type="button" data-qv-dec aria-label="Decrease">${icon('minus')}</button><input type="number" value="1" min="1" max="${max}" aria-label="Quantity" data-qv-qty><button type="button" data-qv-inc aria-label="Increase">${icon('plus')}</button></div><button class="btn btn--green" type="button" data-qv-add="${escapeHtml(p.id)}">Add to bag</button></div>` : ''}
      <a class="textlink" href="${productUrl(p)}">View full details</a>
    </div>`;
  open('quickview');
  track('view_item', { currency: 'NGN', value: p.price.amount, items: [item(p)], source: 'quick_view' });
});
document.querySelector('[data-panel="quickview"]')?.addEventListener('click', async (e) => {
  const input = e.currentTarget.querySelector('[data-qv-qty]');
  if (e.target.closest('[data-qv-dec]')) input.value = Math.max(1, Number(input.value) - 1);
  if (e.target.closest('[data-qv-inc]')) input.value = Math.min(Number(input.max) || 10, Number(input.value) + 1);
  const add = e.target.closest('[data-qv-add]');
  if (!add) return;
  const { byId } = await S.catalogue();
  const p = byId.get(add.dataset.qvAdd);
  const qty = Math.max(1, parseInt(input.value || '1', 10));
  S.addToBag(p.id, qty, Math.min(10, p.stock?.quantity ?? 10));
  track('add_to_cart', { currency: 'NGN', value: (p.price.amount || 0) * qty, items: [item(p, { quantity: qty })] });
  close();
  setTimeout(() => open('bag'), 420);
});

// ---------- Newsletter pop-up (CNM Essentials only): once per visitor, after real interest, never during checkout ----------
(() => {
  const pop = document.querySelector('[data-panel="newsletter-pop"]');
  const quiet = ['checkout', 'confirmation', 'auth', 'account', 'bag', '404'];
  const force = new URLSearchParams(location.search).has('nlpop'); // review/testing: show immediately
  if (!pop || document.body.dataset.chrome || quiet.includes(document.body.dataset.page) || (navigator.webdriver && !force)) return;
  const KEY = 'cnm.nlpop';
  let seen;
  try { seen = Number(localStorage.getItem(KEY) || 0); } catch { return; }
  if (!force && Date.now() - seen < 30 * 864e5) return;
  let shown = false;
  const show = () => {
    if (shown || document.querySelector('[data-panel].is-open')) return;
    shown = true;
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ }
    open('newsletter-pop');
    track('popup_view', { popup: 'newsletter' });
  };
  const timer = setTimeout(show, force ? 300 : 25000);
  const onScroll = () => { if (scrollY > (document.documentElement.scrollHeight - innerHeight) * 0.6) { removeEventListener('scroll', onScroll); clearTimeout(timer); show(); } };
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY < 8 && scrollY > 400) show(); });
})();

initMotion();

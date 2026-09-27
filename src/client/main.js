import { escapeHtml, formatMoney } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { productImages, productUrl, stockState } from '../shared/product.mjs';
import { initConsent, item, track } from './analytics.js';
import { api } from './api.js';
import { demoLoader } from './loader.js';
import * as S from './store.js';
import { close, formData, initUI, open, setBusy, toast } from './ui.js';
import { lineHTML, paintWish } from './render.js';

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

// ---------- account link reflects sign-in ----------
if (S.getUser()) document.querySelectorAll('[data-account-link]').forEach((a) => a.setAttribute('aria-label', `Account — ${S.getUser().firstName}`));

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
  'scent-finder': () => import('./pages/scent-finder.js'),
};
const pageKey = document.body.dataset.page;
PAGES[pageKey]?.().then((m) => m.init?.()).catch((err) => console.error('[cnm] page init failed', err));


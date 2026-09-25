import { productCardHTML } from '../../shared/card.mjs';
import { item, track } from '../analytics.js';
import { api } from '../api.js';
import { paintWish } from '../render.js';
import * as S from '../store.js';
import { setBusy, toast } from '../ui.js';

export async function init() {
  const root = document.querySelector('[data-product]');
  const meta = JSON.parse(root.dataset.product);
  const { byId } = await S.catalogue();
  const p = byId.get(meta.id);
  if (p) track('view_item', { currency: 'NGN', value: p.price.amount, items: [item(p)] });

  // Recently viewed (excluding the current product)
  const recent = S.getRecent().filter((id) => id !== meta.id).map((id) => byId.get(id)).filter(Boolean).slice(0, 4);
  S.pushRecent(meta.id);
  if (recent.length) {
    const sec = document.querySelector('[data-recently-viewed]');
    sec.querySelector('[data-recent-grid]').innerHTML = recent.map((x, i) => productCardHTML(x, { position: i + 1, list: 'recently_viewed' })).join('');
    sec.hidden = false;
    paintWish(sec);
  }

  // Quantity stepper
  const qty = document.querySelector('[data-qty-input]');
  if (qty) {
    const clamp = (v) => Math.max(1, Math.min(Number(qty.max) || 10, v || 1));
    document.querySelector('[data-qty-dec]').addEventListener('click', () => { qty.value = clamp(Number(qty.value) - 1); });
    document.querySelector('[data-qty-inc]').addEventListener('click', () => { qty.value = clamp(Number(qty.value) + 1); });
    qty.addEventListener('change', () => { qty.value = clamp(parseInt(qty.value, 10)); });
  }

  // Gallery: thumbs, zoom (desktop), swipe dots (mobile)
  const gallery = document.querySelector('[data-gallery]');
  const main = gallery.querySelector('[data-zoom]');
  const slides = [...main.querySelectorAll('[data-slide]')];
  const desktop = matchMedia('(min-width: 961px)');
  const show = (i) => {
    if (desktop.matches) slides.forEach((s, j) => { s.hidden = j !== i; });
    gallery.querySelectorAll('[data-thumb]').forEach((t, j) => t.setAttribute('aria-current', String(j === i)));
  };
  const syncMode = () => { if (desktop.matches) show(0); else slides.forEach((s) => { s.hidden = false; }); };
  syncMode();
  desktop.addEventListener('change', syncMode);
  gallery.querySelectorAll('[data-thumb]').forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.thumb))));
  main.addEventListener('click', (e) => {
    if (!desktop.matches) return;
    main.classList.toggle('is-zoomed');
    zoomAt(e);
  });
  const zoomAt = (e) => {
    if (!main.classList.contains('is-zoomed')) return;
    const r = main.getBoundingClientRect();
    const img = slides.find((s) => !s.hidden)?.querySelector('img');
    if (img) img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  };
  main.addEventListener('mousemove', zoomAt);
  main.addEventListener('mouseleave', () => main.classList.remove('is-zoomed'));
  const dots = [...gallery.querySelectorAll('.gallery__dots span')];
  main.addEventListener('scroll', () => {
    const i = Math.round(main.scrollLeft / main.clientWidth);
    dots.forEach((d, j) => d.classList.toggle('is-on', i === j));
  }, { passive: true });

  // Sticky add-to-bag on mobile once the main button scrolls away
  const sticky = document.querySelector('[data-sticky-buy]');
  const mainBtn = document.querySelector('.buy-actions [data-add]');
  if (sticky && mainBtn && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => sticky.classList.toggle('is-on', !en.isIntersecting && en.boundingClientRect.top < 0)).observe(mainBtn);
  }

  // Share
  document.querySelector('[data-share]')?.addEventListener('click', async () => {
    const data = { title: meta.name, text: `${meta.name} — CNM Essentials`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
      track('share', { content_type: 'product', item_id: meta.id });
    } catch { /* user cancelled */ }
  });

  // Back in stock
  document.querySelector('[data-back-in-stock]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const email = f.email.value.trim();
    if (!f.email.checkValidity()) { f.email.setAttribute('aria-invalid', 'true'); f.email.focus(); return; }
    const btn = f.querySelector('button');
    setBusy(btn, true, '');
    try {
      await api('/api/back-in-stock', { method: 'POST', body: { email, productId: meta.id } });
      f.innerHTML = '<p class="alert alert--ok">We’ll email you when it’s back.</p>';
      track('back_in_stock_signup', { item_id: meta.id });
    } catch (err) { toast(err.message); setBusy(btn, false); }
  });
}

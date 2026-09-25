import { item, track } from '../analytics.js';
import { lineHTML } from '../render.js';
import * as S from '../store.js';
import { fetchQuote, totalsHTML } from './quote.js';

export async function init() {
  const linesBox = document.querySelector('[data-bag-page-lines]');
  const totals = document.querySelector('[data-totals]');
  const promoForm = document.querySelector('[data-promo-form]');
  const promoMsg = document.querySelector('[data-promo-msg]');
  const delivery = document.querySelector('[data-est-delivery]');
  const summary = document.querySelector('.summary-card');
  let promoCode = sessionStorage.getItem('cnm.promo') || '';
  promoForm.code.value = promoCode;
  const { byId } = await S.catalogue();

  const render = async () => {
    const lines = S.getBag().filter((l) => byId.has(l.id));
    if (!lines.length) {
      linesBox.innerHTML = '<div class="empty-state"><p class="h3">Your bag is empty.</p><p class="muted">Discover home fragrance, oils and body care.</p><a class="btn" href="/shop/">Explore the shop</a></div>';
      summary.hidden = true;
      return;
    }
    summary.hidden = false;
    linesBox.innerHTML = lines.map((l) => lineHTML(byId.get(l.id), l)).join('');
    try {
      const q = await fetchQuote({ items: lines.map(({ id, qty }) => ({ id, qty })), promoCode, deliveryMethod: delivery.value });
      totals.innerHTML = totalsHTML(q);
      if (promoCode) { promoMsg.textContent = q.promo?.message || ''; promoMsg.className = `msg ${q.promo?.valid ? 'msg--ok' : 'msg--err'}`; }
      for (const err of q.errors) {
        if (err.code === 'qty_reduced') S.setQty(err.id, q.lines.find((x) => x.id === err.id)?.qty || 0);
        if (err.code === 'out_of_stock' || err.code === 'not_found') linesBox.insertAdjacentHTML('afterbegin', `<p class="alert alert--err">${err.message}</p>`);
      }
    } catch {
      totals.innerHTML = '<p class="msg msg--err">We couldn’t calculate totals. Please refresh.</p>';
    }
  };

  promoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    promoCode = promoForm.code.value.trim().toUpperCase();
    sessionStorage.setItem('cnm.promo', promoCode);
    render();
  });
  delivery.addEventListener('change', render);
  S.on('bag', render);
  await render();
  const lines = S.getBag().filter((l) => byId.has(l.id));
  track('view_cart', { currency: 'NGN', items: lines.map((l) => item(byId.get(l.id), { quantity: l.qty })) });
}

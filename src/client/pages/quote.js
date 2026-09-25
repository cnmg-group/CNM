// Server quote with instant local estimate. The server response always wins.
import { formatMoney } from '../../shared/format.mjs';
import { api } from '../api.js';

export async function fetchQuote({ items, promoCode, deliveryMethod }) {
  return api('/api/checkout/quote', { method: 'POST', body: { items, promoCode, deliveryMethod }, loader: false });
}

export function totalsHTML(q, { showDelivery = true } = {}) {
  return `<div><span>Subtotal</span><span>${formatMoney(q.subtotal)}</span></div>
  ${q.discount ? `<div class="discount"><span>Discount${q.promo?.code ? ` (${q.promo.code})` : ''}</span><span>−${formatMoney(q.discount)}</span></div>` : ''}
  ${showDelivery ? `<div><span>Delivery</span><span>${q.deliveryMethod ? (q.delivery ? formatMoney(q.delivery) : 'Free') : 'Calculated next'}</span></div>` : ''}
  <div class="muted" style="font-size:.8125rem"><span>VAT ${q.vatIncluded ? '(included)' : ''}</span><span>${formatMoney(q.vat)}</span></div>
  <div class="grand"><span>Total</span><span>${formatMoney(q.total)}</span></div>`;
}

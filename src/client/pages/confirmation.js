import { escapeHtml, formatDate, formatMoney } from '../../shared/format.mjs';
import { track } from '../analytics.js';
import { api } from '../api.js';
import * as S from '../store.js';

export const STATUS_STEPS = ['paid', 'processing', 'dispatched', 'delivered'];
export function trackHTML(status) {
  const labels = ['Placed', 'Paid', 'Processing', 'Dispatched', 'Delivered'];
  const idx = status === 'pending_payment' ? 0 : STATUS_STEPS.indexOf(status) + 1;
  return `<ol class="status-track" aria-label="Order progress">${labels.map((l, i) => `<li class="${i <= idx ? 'is-done' : ''}"${i === idx ? ' aria-current="step"' : ''}>${l}</li>`).join('')}</ol>`;
}

export function orderDetailHTML(o) {
  return `<div class="stack">
    ${['payment_failed', 'cancelled', 'refunded'].includes(o.status) ? `<p class="alert alert--err">Status: ${o.status.replace('_', ' ')}</p>` : trackHTML(o.status)}
    <div class="mini-lines">${o.lines.map((l) => `<div class="mini-line" style="grid-template-columns:1fr auto"><span>${escapeHtml(l.name)} × ${l.qty}</span><span>${formatMoney(l.lineTotal)}</span></div>`).join('')}</div>
    <div class="totals">
      <div><span>Subtotal</span><span>${formatMoney(o.totals.subtotal)}</span></div>
      ${o.totals.discount ? `<div class="discount"><span>Discount</span><span>−${formatMoney(o.totals.discount)}</span></div>` : ''}
      <div><span>Delivery</span><span>${o.totals.delivery ? formatMoney(o.totals.delivery) : 'Free'}</span></div>
      <div class="muted" style="font-size:.8125rem"><span>VAT (included)</span><span>${formatMoney(o.totals.vat)}</span></div>
      <div class="grand"><span>Total</span><span>${formatMoney(o.totals.total)}</span></div>
    </div>
    <div class="cards-2">
      <div class="box"><span class="label">Delivery</span><span>${escapeHtml(o.delivery.label)}</span><span class="muted">${o.delivery.address ? `${escapeHtml(o.delivery.address.line1)}, ${escapeHtml(o.delivery.address.city)}, ${escapeHtml(o.delivery.address.state)}` : `Collect from ${escapeHtml(o.delivery.storeSlug)}`}</span></div>
      <div class="box"><span class="label">Contact</span><span>${escapeHtml(o.contact.firstName)} ${escapeHtml(o.contact.lastName)}</span><span class="muted">${escapeHtml(o.contact.email)}</span></div>
    </div>
  </div>`;
}

export async function init() {
  const params = new URLSearchParams(location.search);
  let n = params.get('n');
  let t = params.get('t');
  const ref = params.get('reference') || params.get('trxref');
  if (!n) { const last = JSON.parse(sessionStorage.getItem('cnm.lastOrder') || 'null'); n = last?.number; t = last?.token; }
  const body = document.querySelector('[data-confirm-body]');
  const loader = document.querySelector('[data-inline-loader]');
  const slow = setTimeout(() => { loader.hidden = false; }, 250); // only for genuine latency
  try {
    if (ref) await api(`/api/payments/verify?reference=${encodeURIComponent(ref)}`, { loader: false });
    const { order: o } = await api(`/api/orders/${encodeURIComponent(n)}?token=${encodeURIComponent(t)}`, { loader: false });
    if (o.status === 'paid' || o.status === 'processing') {
      S.clearBag();
      const key = `cnm.purchase.${o.number}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        track('purchase', { transaction_id: o.number, currency: 'NGN', value: o.totals.total, shipping: o.totals.delivery, tax: o.totals.vat, coupon: o.promoCode || undefined, items: o.lines.map((l) => ({ item_id: l.id, item_name: l.name, price: l.unitPrice, quantity: l.qty })) });
      }
    }
    const ok = o.status !== 'payment_failed' && o.status !== 'pending_payment';
    body.innerHTML = `<div class="confirm-hero">
      <span class="label muted">${ok ? 'Thank you' : 'Payment pending'}</span>
      <h1 class="h1">${ok ? `Thank you, ${escapeHtml(o.contact.firstName)}.` : 'We haven’t received payment yet.'}</h1>
      <p class="muted">Order number</p><p class="order-num">${escapeHtml(o.number)}</p>
      <p class="lead">${ok ? `A confirmation has been sent to ${escapeHtml(o.contact.email)}. Placed ${formatDate(o.createdAt)}.` : 'If you completed payment, this page will update shortly. Otherwise, return to checkout to try again.'}</p>
      <div class="hero__cta" style="justify-content:center">${ok ? '<a class="btn" href="/shop/">Continue shopping</a>' : '<a class="btn" href="/checkout/">Return to checkout</a>'}${S.getUser() ? `<a class="btn btn--ghost" href="/account/orders/view/?n=${encodeURIComponent(o.number)}">View in account</a>` : `<button class="btn btn--ghost" type="button" data-auth-open="signup" data-auth-email="${escapeHtml(o.contact.email)}" data-auth-reason="Optional: an account makes your next order faster and lets you save addresses and your wishlist.">Create an account (optional)</button>`}</div>
    </div>${orderDetailHTML(o)}<div style="height:96px"></div>`;
  } catch (e) {
    body.innerHTML = `<div class="confirm-hero"><h1 class="h2">We couldn’t find that order.</h1><p class="muted">${escapeHtml(e.message)}</p><a class="btn" href="/">Back to home</a></div>`;
  }
  clearTimeout(slow);
  loader.remove();
  body.hidden = false;
}

import { escapeHtml, formatDate, formatMoney } from '../../shared/format.mjs';
import { track } from '../analytics.js';
import { api } from '../api.js';
import * as S from '../store.js';
import { PAYMENT_METHODS } from '../../shared/payment-methods.mjs';

export const STATUS_STEPS = ['paid', 'processing', 'dispatched', 'delivered'];
export function trackHTML(status) {
  const labels = ['Placed', 'Paid', 'Processing', 'Dispatched', 'Delivered'];
  const idx = status === 'pending_payment' ? 0 : STATUS_STEPS.indexOf(status) + 1;
  return `<ol class="status-track" aria-label="Order progress">${labels.map((l, i) => `<li class="${i <= idx ? 'is-done' : ''}"${i === idx ? ' aria-current="step"' : ''}>${l}</li>`).join('')}</ol>`;
}

const readJSON = (sel) => { try { return JSON.parse(document.querySelector(sel)?.textContent || '{}'); } catch { return {}; } };
const PAID = ['paid', 'processing', 'dispatched', 'delivered'];
const STATUS_LABEL = { pending_payment: 'Awaiting payment', paid: 'Paid', processing: 'Paid · Processing', dispatched: 'Paid · Dispatched', delivered: 'Paid · Delivered', payment_failed: 'Payment failed', cancelled: 'Cancelled', refunded: 'Refunded' };
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/** Printable receipt / order slip: company logo and details, customer, delivery, every line, totals and payment. */
export function receiptHTML(o) {
  const head = document.querySelector('[data-receipt-head]')?.innerHTML || '';
  const stores = readJSON('[data-receipt-stores]');
  const co = readJSON('[data-receipt-contact]');
  const paid = PAID.includes(o.status);
  const method = PAYMENT_METHODS.find((m) => m.id === o.payment?.method);
  const paidAt = o.payment?.paidAt || o.history?.find((h) => h.status === 'paid')?.at;
  const a = o.delivery.address;
  const store = !a && stores[o.delivery.storeSlug];
  const units = o.lines.reduce((n, l) => n + l.qty, 0);
  return `<article class="receipt" aria-label="Receipt for order ${escapeHtml(o.number)}">
  <header class="receipt__head">${head}
    <div class="receipt__doc">
      <span class="receipt__type">${paid ? 'Receipt' : 'Order summary'}</span>
      <dl>
        <div><dt>Order no.</dt><dd><strong>${escapeHtml(o.number)}</strong></dd></div>
        <div><dt>Date</dt><dd>${dateTime(o.createdAt)}</dd></div>
        <div><dt>Status</dt><dd>${STATUS_LABEL[o.status] || escapeHtml(o.status)}</dd></div>
      </dl>
    </div>
  </header>
  <section class="receipt__parties">
    <div><h3>Customer</h3><p><strong>${escapeHtml(o.contact.firstName)} ${escapeHtml(o.contact.lastName)}</strong><br>${escapeHtml(o.contact.email)}${o.contact.phone ? `<br>${escapeHtml(o.contact.phone)}` : ''}</p></div>
    <div><h3>${a ? 'Deliver to' : 'Collect from'}</h3><p><strong>${escapeHtml(o.delivery.label)}</strong><br>${a
      ? `${escapeHtml(a.line1)}${a.line2 ? `, ${escapeHtml(a.line2)}` : ''}<br>${escapeHtml(a.city)}, ${escapeHtml(a.state)}${a.postcode ? ` ${escapeHtml(a.postcode)}` : ''}`
      : store ? `${escapeHtml(store.name)}<br>${escapeHtml(store.address)}` : escapeHtml(o.delivery.storeSlug || '')}</p></div>
    <div><h3>Payment</h3><p><strong>${escapeHtml(method?.label || o.payment?.method || '—')}</strong><br>${paid ? `Paid ${dateTime(paidAt)}` : STATUS_LABEL[o.status] || ''}${o.payment?.reference ? `<br><span class="receipt__ref">Ref. ${escapeHtml(o.payment.reference)}</span>` : ''}${o.payment?.test ? '<br><em>Test payment: no money was taken</em>' : ''}</p></div>
  </section>
  <table class="receipt__lines">
    <thead><tr><th scope="col">Item</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Unit price</th><th scope="col" class="num">Amount</th></tr></thead>
    <tbody>${o.lines.map((l) => `<tr><td>${escapeHtml(l.name)}</td><td class="num">${l.qty}</td><td class="num">${formatMoney(l.unitPrice)}</td><td class="num">${formatMoney(l.lineTotal)}</td></tr>`).join('')}</tbody>
  </table>
  <div class="receipt__foot">
    <p class="receipt__count">${units} item${units === 1 ? '' : 's'}${o.notes ? `<br><span>Note: ${escapeHtml(o.notes)}</span>` : ''}</p>
    <dl class="receipt__totals">
      <div><dt>Subtotal</dt><dd>${formatMoney(o.totals.subtotal)}</dd></div>
      ${o.totals.discount ? `<div><dt>Discount${o.promoCode ? ` (${escapeHtml(o.promoCode)})` : ''}</dt><dd>−${formatMoney(o.totals.discount)}</dd></div>` : ''}
      <div><dt>Delivery</dt><dd>${o.totals.delivery ? formatMoney(o.totals.delivery) : 'Free'}</dd></div>
      <div class="receipt__vat"><dt>VAT (included)</dt><dd>${formatMoney(o.totals.vat)}</dd></div>
      <div class="receipt__grand"><dt>Total</dt><dd>${formatMoney(o.totals.total)}</dd></div>
      <div><dt>${paid ? 'Amount paid' : 'Amount due'}</dt><dd>${formatMoney(o.totals.total)}</dd></div>
    </dl>
  </div>
  <footer class="receipt__thanks">
    <p><strong>Thank you for shopping with CNM Essentials.</strong> Keep this receipt for returns and warranty.</p>
    <p>Questions about this order? ${co.email ? escapeHtml(co.email) : ''}${co.phone ? ` · ${escapeHtml(co.phone)}` : ''} — please quote ${escapeHtml(o.number)}.</p>
    <p class="receipt__group">CNM Essentials is part of CNM Group${co.group ? ` · ${escapeHtml(co.group)}` : ''}</p>
  </footer>
</article>
<div class="receipt-actions no-print"><button class="btn btn--ghost" type="button" data-print-receipt>Print receipt</button><button class="btn btn--ghost" type="button" data-print-receipt data-pdf>Save as PDF</button></div>`;
}

export function bindReceipt(root = document) {
  root.querySelectorAll('[data-print-receipt]').forEach((b) => b.addEventListener('click', () => {
    track('print_receipt', { pdf: b.hasAttribute('data-pdf') });
    window.print(); // the print stylesheet prints only the receipt; "Save as PDF" is the browser's print destination
  }));
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
    </div>${['payment_failed', 'cancelled', 'refunded'].includes(o.status) ? '' : trackHTML(o.status)}${receiptHTML(o)}<div style="height:96px"></div>`;
    bindReceipt(body);
  } catch (e) {
    body.innerHTML = `<div class="confirm-hero"><h1 class="h2">We couldn’t find that order.</h1><p class="muted">${escapeHtml(e.message)}</p><a class="btn" href="/">Back to home</a></div>`;
  }
  clearTimeout(slow);
  loader.remove();
  body.hidden = false;
}

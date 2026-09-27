// Checkout: Contact → Delivery → Payment → Review → (Pay) → Confirmation.
import { escapeHtml, formatMoney } from '../../shared/format.mjs';
import { productImages } from '../../shared/product.mjs';
import { item, track } from '../analytics.js';
import { api } from '../api.js';
import * as S from '../store.js';
import { formData, setBusy, validate } from '../ui.js';
import { fetchQuote, totalsHTML } from './quote.js';
import { PAYMENT_METHODS } from '../../shared/payment-methods.mjs';

const STEPS = ['contact', 'delivery', 'payment', 'review'];
const SAVE_KEY = 'cnm.checkout';

export async function init() {
  const root = document.querySelector('[data-checkout]');
  const errBox = root.querySelector('[data-checkout-error]');
  const state = { step: 'contact', contact: {}, delivery: {}, payment: { method: 'card' }, promoCode: sessionStorage.getItem('cnm.promo') || '', quote: null, ...JSON.parse(sessionStorage.getItem(SAVE_KEY) || '{}') };
  const save = () => sessionStorage.setItem(SAVE_KEY, JSON.stringify({ contact: state.contact, delivery: state.delivery, payment: state.payment, promoCode: state.promoCode }));
  const { byId } = await S.catalogue();
  const items = () => S.getBag().filter((l) => byId.has(l.id)).map(({ id, qty }) => ({ id, qty }));

  if (!items().length) {
    root.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p class="h3">Your bag is empty.</p><a class="btn" href="/shop/">Continue shopping</a></div>';
    return;
  }

  // Prefill for signed-in customers
  if (S.getUser()) {
    root.querySelector('[data-signin-hint]').hidden = true;
    try {
      const [{ user }, { addresses }] = await Promise.all([api('/api/auth/me', { loader: false }), api('/api/account/addresses', { loader: false })]);
      state.contact = { email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone || '', ...state.contact };
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      if (def && !state.delivery.line1) Object.assign(state.delivery, { line1: def.line1, line2: def.line2, city: def.city, state: def.state });
    } catch { S.setUser(null); }
  }

  const fill = (form, data) => Object.entries(data || {}).forEach(([k, v]) => { const f = form.elements[k]; if (f && typeof v === 'string') f.value = v; });
  fill(root.querySelector('[data-step="contact"]'), state.contact);
  fill(root.querySelector('[data-step="delivery"]'), state.delivery);
  const payRadio = root.querySelector(`[name="paymentMethod"][value="${state.payment?.method}"]`);
  if (payRadio) payRadio.checked = true;

  // Mobile: collapsible order summary above the steps
  const summary = root.querySelector('[data-co-summary]');
  const summaryToggle = root.querySelector('[data-summary-toggle]');
  summaryToggle.addEventListener('click', () => {
    const open = summary.classList.toggle('is-open');
    summaryToggle.setAttribute('aria-expanded', String(open));
    root.querySelector('[data-summary-toggle-label]').textContent = open ? 'Hide order summary' : 'Show order summary';
  });

  const promoForm = root.querySelector('[data-promo-form]');
  const promoMsg = root.querySelector('[data-promo-msg]');
  promoForm.code.value = state.promoCode;

  async function refreshQuote() {
    try {
      state.quote = await fetchQuote({ items: items(), promoCode: state.promoCode, deliveryMethod: state.delivery.method });
    } catch (e) { showError(e.message); return; }
    const q = state.quote;
    root.querySelector('[data-co-lines]').innerHTML = q.lines.map((l) => {
      const p = byId.get(l.id);
      return `<div class="mini-line"><div class="mini-line__media"><img src="${productImages(p)[0].src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><span class="mini-line__qty">${l.qty}</span></div><span>${escapeHtml(l.name)}</span><span>${formatMoney(l.lineTotal)}</span></div>`;
    }).join('');
    root.querySelector('[data-totals]').innerHTML = totalsHTML(q);
    root.querySelector('[data-summary-total]').textContent = formatMoney(q.total);
    const note = root.querySelector('[data-pay-mode-note]');
    if (q.payment?.testMode) {
      note.hidden = false;
      root.querySelector('[data-pay-mode-text]').textContent = q.payment.provider === 'simulated'
        ? 'This preview uses a payment simulator. After you place the order you can choose a successful or failed payment. No money is taken.'
        : 'Paystack is in test mode. Use Paystack test cards or accounts. No real money is taken.';
    }
    if (state.promoCode) { promoMsg.textContent = q.promo?.message || ''; promoMsg.className = `msg ${q.promo?.valid ? 'msg--ok' : 'msg--err'}`; }
    if (q.errors.length) showError(q.errors.map((e) => e.message).join(' '));
    renderMethods();
    if (!q.deliveryMethod && state.delivery.method) await refreshQuote(); // price the default method
  }

  function renderMethods() {
    const box = root.querySelector('[data-delivery-methods]');
    const methods = state.quote?.deliveryMethods || [];
    if (!state.delivery.method) state.delivery.method = methods[0]?.id;
    box.innerHTML = '<legend class="sr-only">Delivery method</legend>' + methods.map((m) => `<label class="radio-card"><input type="radio" name="method" value="${m.id}"${m.id === state.delivery.method ? ' checked' : ''} required><span class="rc-main"><strong>${escapeHtml(m.label)}</strong><span class="muted" style="font-size:.8125rem">${escapeHtml(m.eta)}</span></span><span class="rc-price">${m.fee ? formatMoney(m.fee) : 'Free'}</span></label>`).join('');
    toggleAddress();
  }
  function toggleAddress() {
    const pickup = state.delivery.method === 'store-pickup';
    root.querySelector('[data-address-fields]').hidden = pickup;
    root.querySelector('[data-store-fields]').hidden = !pickup;
  }
  root.querySelector('[data-delivery-methods]').addEventListener('change', (e) => {
    if (e.target.name !== 'method') return;
    state.delivery.method = e.target.value;
    toggleAddress();
    refreshQuote();
    save();
  });

  function showError(msg) { errBox.hidden = !msg; errBox.textContent = msg || ''; if (msg) errBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

  function go(step) {
    state.step = step;
    showError('');
    root.querySelectorAll('[data-step]').forEach((p) => { p.hidden = p.dataset.step !== step; });
    const idx = STEPS.indexOf(step);
    root.querySelectorAll('[data-steps] li').forEach((li, i) => {
      li.classList.toggle('is-done', i < idx);
      if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    root.querySelector(`[data-step="${step}"] h2`)?.setAttribute('tabindex', '-1');
    root.querySelector(`[data-step="${step}"] h2`)?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (step === 'review') renderReview();
    if (step === 'delivery') track('add_shipping_info_view', {});
  }

  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => go(STEPS[Math.max(0, STEPS.indexOf(state.step) - 1)])));

  root.querySelector('[data-step="contact"]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget)) return;
    state.contact = formData(e.currentTarget);
    save();
    go('delivery');
  });
  root.querySelector('[data-step="delivery"]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget)) return;
    state.delivery = { ...formData(e.currentTarget), method: state.delivery.method };
    save();
    const q = state.quote;
    track('add_shipping_info', { currency: 'NGN', value: q?.total, shipping_tier: state.delivery.method, items: q?.lines.map((l) => item(byId.get(l.id), { quantity: l.qty })) });
    go('payment');
  });
  root.querySelector('[data-step="payment"]').addEventListener('submit', (e) => {
    e.preventDefault();
    state.payment = { method: e.currentTarget.paymentMethod.value };
    save();
    track('add_payment_info', { currency: 'NGN', value: state.quote?.total, payment_type: state.payment.method });
    go('review');
  });

  function renderReview() {
    const c = state.contact;
    const d = state.delivery;
    const m = state.quote?.deliveryMethods.find((x) => x.id === d.method);
    const pickup = d.method === 'store-pickup';
    root.querySelector('[data-review]').innerHTML = `
      <div class="review-block"><div class="head"><strong>Contact</strong><button class="textlink" type="button" data-edit="contact">Edit</button></div><span>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</span><span class="muted">${escapeHtml(c.email)} · ${escapeHtml(c.phone)}</span></div>
      <div class="review-block"><div class="head"><strong>Delivery</strong><button class="textlink" type="button" data-edit="delivery">Edit</button></div><span>${escapeHtml(m?.label || '')} — ${escapeHtml(m?.eta || '')}</span><span class="muted">${pickup ? `Collect from ${escapeHtml(root.querySelector(`#a-store option[value="${d.storeSlug}"]`)?.textContent || d.storeSlug)}` : `${escapeHtml(d.line1)}${d.line2 ? `, ${escapeHtml(d.line2)}` : ''}, ${escapeHtml(d.city)}, ${escapeHtml(d.state)}`}</span></div>
      <div class="review-block"><div class="head"><strong>Payment</strong><button class="textlink" type="button" data-edit="payment">Edit</button></div><span>${escapeHtml(PAYMENT_METHODS.find((x) => x.id === state.payment.method)?.label || 'Card')}</span><span class="muted">Paid on our provider’s secure page${state.quote?.payment?.testMode ? ' · staging: no real payment' : ''}</span></div>
      <div class="review-block"><div class="head"><strong>Items</strong><span class="muted">${state.quote?.lines.reduce((n, l) => n + l.qty, 0) || 0}</span></div>${(state.quote?.lines || []).map((l) => `<span style="display:flex;justify-content:space-between;gap:12px"><span>${l.qty} × ${escapeHtml(l.name)}</span><span>${formatMoney(l.lineTotal)}</span></span>`).join('')}<span style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:8px;margin-top:4px"><strong>Total</strong><strong>${formatMoney(state.quote?.total || 0)}</strong></span></div>`;
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => go(b.dataset.edit)));
  }

  root.querySelector('[data-place-order]').addEventListener('click', async (e) => {
    const terms = root.querySelector('[data-terms]');
    if (!terms.checked) { showError('Please accept the terms of sale to continue.'); terms.focus(); return; }
    const btn = e.currentTarget;
    setBusy(btn, true, 'Placing order');
    const d = state.delivery;
    try {
      const res = await api('/api/checkout', {
        method: 'POST',
        body: {
          items: items(), promoCode: state.promoCode || undefined,
          contact: { email: state.contact.email, phone: state.contact.phone, firstName: state.contact.firstName, lastName: state.contact.lastName, marketing: !!state.contact.marketing },
          delivery: d.method === 'store-pickup' ? { method: d.method, storeSlug: d.storeSlug } : { method: d.method, address: { line1: d.line1, line2: d.line2, city: d.city, state: d.state, country: 'NG' } },
          notes: d.notes,
          paymentMethod: state.payment.method,
        },
      });
      sessionStorage.setItem('cnm.lastOrder', JSON.stringify({ number: res.order.number, token: res.order.accessToken }));
      if (res.payment.mode === 'paystack' && res.payment.authorizationUrl) {
        location.href = res.payment.authorizationUrl;
        return;
      }
      showPay(res);
    } catch (ex) {
      showError(ex.message || 'We couldn’t place your order. Please try again.');
      setBusy(btn, false);
      if (ex.body?.quote) { state.quote = ex.body.quote; refreshQuote(); }
    }
  });

  function showPay(res) {
    root.querySelectorAll('[data-step]').forEach((p) => { p.hidden = p.dataset.step !== 'pay'; });
    const panel = root.querySelector('[data-step="pay"]');
    panel.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', async () => {
      setBusy(b, true, 'Processing');
      try {
        const r = await api('/api/payments/simulate', { method: 'POST', body: { number: res.order.number, accessToken: res.order.accessToken, outcome: b.dataset.sim } });
        if (r.order.status === 'paid') {
          S.clearBag();
          sessionStorage.removeItem(SAVE_KEY);
          sessionStorage.removeItem('cnm.promo');
          location.href = `/checkout/confirmation/?n=${encodeURIComponent(res.order.number)}&t=${encodeURIComponent(res.order.accessToken)}`;
        } else {
          showError('Your payment was declined. No money has been taken. Please try again or use another method.');
          track('payment_failed', { order: res.order.number });
          setBusy(b, false);
        }
      } catch (ex) { showError(ex.message); setBusy(b, false); }
    }));
  }

  promoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.promoCode = promoForm.code.value.trim().toUpperCase();
    sessionStorage.setItem('cnm.promo', state.promoCode);
    save();
    refreshQuote();
  });

  await refreshQuote();
  go('contact');
}

import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { PAYMENT_METHODS } from '../shared/payment-methods.mjs';
import { breadcrumbs, butterflySVG } from './layout.mjs';

const skeletonLines = (n = 2) =>
  Array.from({ length: n }, () => `<div class="line-item"><div class="line-item__media skeleton"></div><div class="stack"><div class="skeleton" style="height:14px;width:60%"></div><div class="skeleton" style="height:12px;width:30%"></div></div></div>`).join('');

export function bagPage(ctx) {
  const { html: crumbs } = breadcrumbs(ctx, [{ name: 'Bag', path: '/bag/' }]);
  return `<div class="container">${crumbs}
  <header class="plp-head"><h1 class="h1">Your bag</h1></header>
  <div class="bag-page" data-bag-page>
    <section aria-label="Items"><div data-bag-page-lines>${skeletonLines()}</div></section>
    <aside class="summary-card" aria-labelledby="summary-title">
      <h2 id="summary-title" class="label">Order summary</h2>
      <form class="promo" data-promo-form novalidate><label for="promo" class="sr-only">Promo code</label><input id="promo" name="code" placeholder="Promo code" autocomplete="off"><button class="btn btn--ghost" type="submit">Apply</button></form>
      <p class="msg" data-promo-msg aria-live="polite"></p>
      <div class="field"><label for="est-delivery">Estimate delivery</label><select id="est-delivery" data-est-delivery>${ctx.commerce.deliveryMethods.map((d) => `<option value="${d.id}">${escapeHtml(d.label)} — ${escapeHtml(d.eta)}</option>`).join('')}</select></div>
      <div class="totals" data-totals></div>
      <a class="btn btn--green btn--block" href="/checkout/" data-begin-checkout>Checkout securely</a>
      <p class="muted" style="font-size:.75rem;display:flex;gap:8px;align-items:center">${icon('lock')} Payments are processed by our payment provider. Card details never touch CNM servers.</p>
    </aside>
  </div>
</div>`;
}

export function wishlistPage(ctx) {
  const { html: crumbs } = breadcrumbs(ctx, [{ name: 'Wishlist', path: '/wishlist/' }]);
  return `<div class="container">${crumbs}
  <header class="plp-head" style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap"><div><h1 class="h1">Wishlist</h1><p class="muted" data-wish-note>Saved on this device. <button class="textlink" type="button" data-auth-open="signin" data-auth-reason="Optional: keep your wishlist across web and app.">Sign in</button> to keep it across web and app (optional).</p></div><button class="link" type="button" data-wish-share>${icon('share')} Share wishlist</button></header>
  <div class="grid-products" data-wishlist-grid style="padding-bottom:96px"></div>
  <div class="empty-state" data-wishlist-empty hidden><p class="h3">Nothing saved yet.</p><p class="muted">Tap the heart on any product to keep it here.</p><a class="btn" href="/shop/">Explore the shop</a></div>
</div>`;
}

export function searchPage(ctx) {
  return `<div class="container" style="padding-bottom:96px">
  <header class="plp-head"><span class="label muted">Search</span><h1 class="h1" data-search-heading>Search</h1></header>
  <form class="search-bar" action="/search/" role="search" data-search-page-form style="height:72px;margin-bottom:32px">${icon('search')}<label for="sq" class="sr-only">Search</label><input id="sq" name="q" type="search" placeholder="Search products, scents, services…" autocomplete="off"></form>
  <div data-search-page-results></div>
</div>`;
}

export function checkoutPage(ctx) {
  const steps = ['Contact', 'Delivery', 'Payment', 'Review'];
  return `<div class="container">
  <div class="checkout" data-checkout>
    <button class="co-summary-toggle" type="button" data-summary-toggle aria-expanded="false" aria-controls="co-summary-card"><span>${icon('bag')} <span data-summary-toggle-label>Show order summary</span></span><strong data-summary-total></strong></button>
    <div class="checkout__main">
      <ol class="steps" data-steps>${steps.map((s, i) => `<li${i === 0 ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>
      <div class="alert alert--err" data-checkout-error role="alert" hidden></div>

      <form class="step-panel" data-step="contact" novalidate>
        <h2>Contact</h2>
        <div class="co-auth" data-co-auth>
          <p data-co-auth-guest><strong>Checking out as a guest.</strong> <span class="muted">No account needed.</span></p>
          <div class="co-auth__actions" data-co-auth-actions><button class="textlink" type="button" data-auth-open="signin" data-auth-reason="Optional: sign in to use your saved details. You can also close this and check out as a guest.">Sign in</button><button class="textlink" type="button" data-auth-open="signup" data-auth-reason="Optional: an account lets you track orders and save addresses. You can also close this and check out as a guest.">Create account</button></div>
        </div>
        <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" required></div>
        <div class="form-row"><div class="field"><label for="c-first">First name</label><input id="c-first" name="firstName" autocomplete="given-name" required></div><div class="field"><label for="c-last">Last name</label><input id="c-last" name="lastName" autocomplete="family-name" required></div></div>
        <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+234"><span class="hint">For delivery updates only.</span></div>
        <label class="check"><input type="checkbox" name="marketing"> Email me about new arrivals and events (optional)</label>
        <div class="step-nav"><a class="textlink" href="/bag/">Return to bag</a><button class="btn" type="submit">Continue to delivery</button></div>
      </form>

      <form class="step-panel" data-step="delivery" novalidate hidden>
        <h2>Delivery</h2>
        <fieldset style="border:0;padding:0;margin:0;display:grid;gap:10px" data-delivery-methods><legend class="sr-only">Delivery method</legend></fieldset>
        <div data-address-fields class="form">
          <div class="field"><label for="a-line1">Address</label><input id="a-line1" name="line1" autocomplete="address-line1" required></div>
          <div class="field"><label for="a-line2">Apartment, suite, landmark (optional)</label><input id="a-line2" name="line2" autocomplete="address-line2"></div>
          <div class="form-row"><div class="field"><label for="a-city">City / area</label><input id="a-city" name="city" autocomplete="address-level2" required></div>
          <div class="field"><label for="a-state">State</label><select id="a-state" name="state" autocomplete="address-level1" required><option value="">Select state</option>${NG_STATES.map((s) => `<option>${s}</option>`).join('')}</select></div></div>
        </div>
        <div data-store-fields hidden class="field"><label for="a-store">Collect from</label><select id="a-store" name="storeSlug">${ctx.stores.map((s) => `<option value="${s.slug}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="a-notes">Delivery notes (optional)</label><input id="a-notes" name="notes" maxlength="300"></div>
        <div class="step-nav"><button class="textlink" type="button" data-back>Back</button><button class="btn" type="submit">Continue to payment</button></div>
      </form>

      <form class="step-panel" data-step="payment" novalidate hidden>
        <h2>Payment</h2>
        <fieldset class="pay-methods-list" data-pay-methods><legend class="sr-only">Payment method</legend>
        ${PAYMENT_METHODS.map((m, i) => `<label class="radio-card"><input type="radio" name="paymentMethod" value="${m.id}"${i === 0 ? ' checked' : ''} required><span class="rc-main"><strong>${escapeHtml(m.label)}</strong><span class="muted" style="font-size:.8125rem">${escapeHtml(m.detail)}</span></span>${icon(m.id === 'card' ? 'lock' : m.id === 'ussd' ? 'phone' : 'store')}</label>`).join('')}
        </fieldset>
        <p class="muted" style="font-size:.8125rem;display:flex;gap:8px;align-items:flex-start">${icon('lock')} <span>You’ll complete payment on our payment provider’s secure page. CNM never sees or stores your card details.</span></p>
        <div class="sim-pay" data-pay-mode-note${ctx.staging ? '' : ' hidden'}><strong class="label">Staging — no real payments</strong><p style="margin:0" data-pay-mode-text>This preview uses a payment simulator or Paystack test mode. No money is taken and no real card is charged.</p></div>
        <div class="step-nav"><button class="textlink" type="button" data-back>Back</button><button class="btn" type="submit">Review order</button></div>
      </form>

      <div class="step-panel" data-step="review" hidden>
        <h2>Review</h2>
        <div data-review></div>
        <label class="check"><input type="checkbox" required data-terms> I agree to the <a class="textlink" href="/terms/" target="_blank">terms of sale</a>.</label>
        <div class="step-nav"><button class="textlink" type="button" data-back>Back</button><button class="btn btn--green" type="button" data-place-order>Place order &amp; pay</button></div>
      </div>

      <div class="step-panel" data-step="pay" hidden>
        <h2>Payment</h2>
        <div class="sim-pay" data-sim-pay>
          <strong class="label">Staging payment simulator</strong>
          <p style="margin:0">No payment provider keys are configured, so this staging build simulates the provider. Choose an outcome to test the flow.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn--green" type="button" data-sim="success">Simulate successful payment</button><button class="btn btn--ghost" type="button" data-sim="failure">Simulate failed payment</button></div>
        </div>
      </div>
    </div>

    <aside class="summary-card co-summary" id="co-summary-card" aria-labelledby="co-summary" data-co-summary>
      <h2 id="co-summary" class="label">Order summary</h2>
      <div class="mini-lines" data-co-lines>${skeletonLines(1)}</div>
      <form class="promo" data-promo-form novalidate><label for="co-promo" class="sr-only">Promo code</label><input id="co-promo" name="code" placeholder="Promo code" autocomplete="off"><button class="btn btn--ghost" type="submit">Apply</button></form>
      <p class="msg" data-promo-msg aria-live="polite"></p>
      <div class="totals" data-totals></div>
    </aside>
  </div>
</div>`;
}

export function confirmationPage() {
  return `<div class="container container--narrow" data-confirmation>
  <div class="cnm-loader cnm-loader--inline" data-inline-loader hidden><div>${butterflySVG()}<div class="cnm-loader__label">Confirming your order</div></div></div>
  <div data-confirm-body hidden></div>
</div>`;
}

export const NG_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];

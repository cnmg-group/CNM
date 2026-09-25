import { butterflySVG } from './layout.mjs';

export const ACCOUNT_VIEWS = [
  { view: 'overview', path: '/account/', title: 'Account' },
  { view: 'orders', path: '/account/orders/', title: 'Orders' },
  { view: 'order', path: '/account/orders/view/', title: 'Order details', hideNav: true },
  { view: 'profile', path: '/account/profile/', title: 'Profile' },
  { view: 'addresses', path: '/account/addresses/', title: 'Addresses' },
  { view: 'preferences', path: '/account/preferences/', title: 'Communication preferences' },
];

const NAV = ACCOUNT_VIEWS.filter((v) => !v.hideNav);

export function accountPage(view) {
  const nav = NAV.map((v) => `<a href="${v.path}"${v.view === view || (view === 'order' && v.view === 'orders') ? ' aria-current="page"' : ''}>${v.title === 'Account' ? 'Overview' : v.title}</a>`).join('');
  return `<div class="container">
  <div class="account" data-account data-view="${view}">
    <nav class="account-nav" aria-label="Account">${nav}<a href="/wishlist/">Wishlist</a><button type="button" data-logout>Sign out</button></nav>
    <section class="panel" data-account-panel aria-live="polite">
      <div class="cnm-loader cnm-loader--inline" data-inline-loader hidden><div>${butterflySVG()}</div></div>
      <div class="skeleton" style="height:40px;width:40%"></div><div class="skeleton" style="height:120px"></div>
    </section>
  </div>
</div>`;
}

export function loginPage() {
  return `<div class="container"><div class="auth-wrap" data-auth="login">
  <h1>Sign in</h1>
  <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-auth-tab="password">Password</button><button type="button" role="tab" aria-selected="false" data-auth-tab="otp">Email code</button></div>
  <div class="alert alert--err" role="alert" data-auth-error hidden></div>
  <form class="form" data-login-form novalidate>
    <div class="field"><label for="l-email">Email</label><input id="l-email" name="email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="l-pass">Password</label><input id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn btn--block" type="submit">Sign in</button>
    <a class="textlink muted" href="/account/reset/" style="font-size:.875rem;justify-self:center">Forgotten your password?</a>
  </form>
  <form class="form" data-otp-form novalidate hidden>
    <div class="field"><label for="o-email">Email</label><input id="o-email" name="email" type="email" autocomplete="email" required></div>
    <div class="field" data-otp-code hidden><label for="o-code">6-digit code</label><input id="o-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></div>
    <button class="btn btn--block" type="submit" data-otp-submit>Email me a code</button>
    <p class="muted" style="font-size:.8125rem" data-otp-note></p>
  </form>
  <p class="center muted">New to CNM? <a class="textlink" href="/account/register/" data-register-link>Create an account</a></p>
</div></div>`;
}

export function registerPage() {
  return `<div class="container"><div class="auth-wrap" data-auth="register">
  <h1>Create account</h1>
  <p class="center muted">Track orders, save addresses and keep your wishlist on web and app.</p>
  <div class="alert alert--err" role="alert" data-auth-error hidden></div>
  <form class="form" data-register-form novalidate>
    <div class="form-row"><div class="field"><label for="r-first">First name</label><input id="r-first" name="firstName" autocomplete="given-name" required></div><div class="field"><label for="r-last">Last name</label><input id="r-last" name="lastName" autocomplete="family-name" required></div></div>
    <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="email" required></div>
    <div class="field"><label for="r-pass">Password</label><input id="r-pass" name="password" type="password" autocomplete="new-password" minlength="10" required aria-describedby="r-pass-hint"><span class="hint" id="r-pass-hint">At least 10 characters.</span></div>
    <label class="check"><input type="checkbox" name="marketingOptIn"> Email me about new arrivals and events (optional)</label>
    <button class="btn btn--block" type="submit">Create account</button>
    <p class="muted" style="font-size:.75rem">By creating an account you agree to our <a class="textlink" href="/terms/">terms</a> and <a class="textlink" href="/privacy/">privacy notice</a>.</p>
  </form>
  <p class="center muted">Already registered? <a class="textlink" href="/account/login/">Sign in</a></p>
</div></div>`;
}

export function resetPage() {
  return `<div class="container"><div class="auth-wrap" data-auth="reset">
  <h1>Reset password</h1>
  <div class="alert" role="status" data-auth-msg hidden></div>
  <div class="alert alert--err" role="alert" data-auth-error hidden></div>
  <form class="form" data-reset-request novalidate>
    <p class="muted center">Enter your email and we'll send you a link to reset your password.</p>
    <div class="field"><label for="rs-email">Email</label><input id="rs-email" name="email" type="email" autocomplete="email" required></div>
    <button class="btn btn--block" type="submit">Send reset link</button>
  </form>
  <form class="form" data-reset-confirm novalidate hidden>
    <div class="field"><label for="rs-pass">New password</label><input id="rs-pass" name="password" type="password" autocomplete="new-password" minlength="10" required><span class="hint">At least 10 characters.</span></div>
    <button class="btn btn--block" type="submit">Set new password</button>
  </form>
  <p class="center"><a class="textlink muted" href="/account/login/">Back to sign in</a></p>
</div></div>`;
}

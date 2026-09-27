// Sign in / create account dialog. Always optional: shoppers can browse, save and check out as guests.
// Default is a one-time email code (new emails get an account on first code); a password is an alternative.
import { track } from './analytics.js';
import { api } from './api.js';
import * as S from './store.js';
import { close, open, setBusy, toast } from './ui.js';

const $ = (sel) => document.querySelector(`[data-panel="auth"] ${sel}`);
let state = { mode: 'signin', password: false, codeSent: false, onSuccess: null };
let timer;
let wired = false;

function render() {
  const signup = state.mode === 'signup';
  $('[data-auth-title]').textContent = signup ? 'Create account' : 'Sign in';
  document.querySelectorAll('[data-panel="auth"] [data-auth-mode]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.authMode === state.mode)));
  document.querySelectorAll('[data-panel="auth"] [data-signup-only]').forEach((n) => { n.hidden = !signup; });
  const form = $('[data-auth-dialog-form]');
  form.firstName.required = signup; form.lastName.required = signup;
  $('[data-ad-password]').hidden = !state.password;
  form.password.required = state.password;
  form.password.autocomplete = signup ? 'new-password' : 'current-password';
  form.password.minLength = signup ? 10 : 0;
  $('[data-ad-code]').hidden = state.password || !state.codeSent;
  form.code.required = !state.password && state.codeSent;
  form.email.readOnly = !state.password && state.codeSent;
  $('[data-ad-resend]').hidden = state.password || !state.codeSent;
  $('[data-ad-toggle-password]').textContent = state.password ? 'Use an email code instead' : 'Use a password instead';
  $('[data-ad-submit]').textContent = state.password
    ? (signup ? 'Create account' : 'Sign in')
    : state.codeSent ? (signup ? 'Create account' : 'Sign in') : 'Email me a code';
  if (!state.codeSent || state.password) $('[data-ad-note]').textContent = state.password && signup ? 'Passwords need at least 10 characters.' : '';
}

function showError(msg) { const e = $('[data-auth-dialog-error]'); e.hidden = !msg; e.textContent = msg || ''; }

function countdown(secs) {
  const b = $('[data-ad-resend]');
  clearInterval(timer);
  let left = secs;
  b.disabled = true; b.textContent = `Resend code in ${left}s`;
  timer = setInterval(() => { left -= 1; if (left <= 0) { clearInterval(timer); b.disabled = false; b.textContent = 'Resend code'; } else b.textContent = `Resend code in ${left}s`; }, 1000);
}

async function requestCode() {
  const form = $('[data-auth-dialog-form]');
  const r = await api('/api/auth/otp-request', { method: 'POST', body: { email: form.email.value.trim() }, loader: false });
  state.codeSent = true;
  render();
  form.code.value = '';
  form.code.focus();
  $('[data-ad-note]').textContent = r.devCode
    ? `Staging: email delivery isn't configured, so your code is ${r.devCode}.`
    : `We've sent a 6-digit code to ${form.email.value.trim()}. It expires in ${r.expiresInMinutes} minutes.`;
  countdown(r.resendAfterSeconds || 60);
}

async function done(user, method, isNew) {
  S.setUser(user);
  track(isNew ? 'sign_up' : 'login', { method });
  await S.mergeWishlistOnSignIn().catch(() => {});
  clearInterval(timer);
  close();
  toast(isNew ? `Welcome to CNM Essentials${user.firstName ? `, ${user.firstName}` : ''}.` : `Signed in as ${user.email}`, { action: 'My account', href: '/account/' });
  document.querySelectorAll('[data-signed-in]').forEach((n) => { n.hidden = false; });
  document.querySelectorAll('[data-signed-out]').forEach((n) => { n.hidden = true; });
  state.onSuccess?.(user);
}

function wire() {
  if (wired) return;
  wired = true;
  const form = $('[data-auth-dialog-form]');
  document.querySelectorAll('[data-panel="auth"] [data-auth-mode]').forEach((t) => t.addEventListener('click', () => { state.mode = t.dataset.authMode; showError(''); render(); }));
  $('[data-ad-toggle-password]').addEventListener('click', () => { state.password = !state.password; state.codeSent = false; clearInterval(timer); showError(''); render(); });
  $('[data-ad-resend]').addEventListener('click', async () => { showError(''); try { await requestCode(); } catch (ex) { showError(ex.message); } });
  form.code.addEventListener('input', () => { if (/^\d{6}$/.test(form.code.value)) form.requestSubmit(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    if (!form.reportValidity()) return;
    const btn = $('[data-ad-submit]');
    const label = btn.textContent;
    setBusy(btn, true, '');
    const signup = state.mode === 'signup';
    const v = (n) => form[n].value.trim();
    try {
      if (state.password) {
        const r = signup
          ? await api('/api/auth/register', { method: 'POST', body: { email: v('email'), password: form.password.value, firstName: v('firstName'), lastName: v('lastName'), marketingOptIn: form.marketingOptIn.checked } })
          : await api('/api/auth/login', { method: 'POST', body: { email: v('email'), password: form.password.value } });
        await done(r.user, signup ? 'register' : 'password', signup);
      } else if (!state.codeSent) {
        await requestCode();
      } else {
        const r = await api('/api/auth/otp-verify', { method: 'POST', body: { email: v('email'), code: v('code'), ...(signup ? { firstName: v('firstName'), lastName: v('lastName'), marketingOptIn: form.marketingOptIn.checked } : {}) } });
        await done(r.user, 'otp', r.isNew);
      }
    } catch (ex) {
      showError(ex.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(btn, false);
      if (btn.textContent === '') btn.textContent = label;
      render();
    }
  });
}

/**
 * Open the dialog. Never blocks shopping: closing it leaves everything as it was.
 * @param {'signin'|'signup'} mode
 * @param {{ reason?: string, email?: string, onSuccess?: (user) => void }} opts
 */
export function openAuth(mode = 'signin', { reason, email, onSuccess } = {}) {
  wire();
  state = { mode, password: false, codeSent: false, onSuccess };
  const form = $('[data-auth-dialog-form]');
  form.reset();
  if (email) form.email.value = email;
  const r = $('[data-auth-reason]');
  r.hidden = !reason; r.textContent = reason || '';
  showError('');
  $('[data-ad-note]').textContent = '';
  clearInterval(timer);
  render();
  open('auth');
  setTimeout(() => (mode === 'signup' ? form.firstName : form.email).focus(), 80);
  track('auth_open', { mode });
}

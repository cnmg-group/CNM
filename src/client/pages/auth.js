import { track } from '../analytics.js';
import { api } from '../api.js';
import * as S from '../store.js';
import { formData, setBusy, validate } from '../ui.js';

const next = () => {
  const n = new URLSearchParams(location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/account/';
};

async function signedIn(user, method) {
  S.setUser(user);
  track(method === 'register' ? 'sign_up' : 'login', { method });
  await S.mergeWishlistOnSignIn().catch(() => {});
  location.href = next();
}

export function init() {
  const root = document.querySelector('[data-auth]');
  const err = root.querySelector('[data-auth-error]');
  const fail = (e) => { err.hidden = false; err.textContent = e.message || 'Something went wrong. Please try again.'; };
  const reg = root.querySelector('[data-register-link]');
  if (reg) reg.href += location.search;

  root.querySelector('[data-login-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const f = e.currentTarget;
    if (!validate(f)) return;
    const btn = f.querySelector('button[type="submit"]');
    setBusy(btn, true, 'Signing in');
    try { const { user } = await api('/api/auth/login', { method: 'POST', body: formData(f) }); await signedIn(user, 'password'); } catch (ex) { fail(ex); setBusy(btn, false); }
  });

  // Tabs: password / email code
  root.querySelectorAll('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => {
    root.querySelectorAll('[data-auth-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    root.querySelector('[data-login-form]').hidden = tab.dataset.authTab !== 'password';
    root.querySelector('[data-otp-form]').hidden = tab.dataset.authTab !== 'otp';
  }));

  const otp = root.querySelector('[data-otp-form]');
  if (otp) {
    const codeField = otp.querySelector('[data-otp-code]');
    const btn = otp.querySelector('[data-otp-submit]');
    const note = otp.querySelector('[data-otp-note]');
    const actions = otp.querySelector('[data-otp-actions]');
    const resend = otp.querySelector('[data-otp-resend]');
    let timer;
    const countdown = (secs) => {
      clearInterval(timer);
      resend.disabled = true;
      let left = secs;
      resend.textContent = `Resend code in ${left}s`;
      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) { clearInterval(timer); resend.disabled = false; resend.textContent = 'Resend code'; } else resend.textContent = `Resend code in ${left}s`;
      }, 1000);
    };
    const request = async () => {
      const r = await api('/api/auth/otp-request', { method: 'POST', body: { email: otp.email.value.trim() } });
      codeField.hidden = false;
      actions.hidden = false;
      otp.code.required = true;
      otp.email.readOnly = true;
      otp.code.value = '';
      otp.code.focus();
      btn.textContent = 'Sign in';
      note.textContent = r.devCode
        ? `Staging: email delivery isn't configured, so your code is ${r.devCode}.`
        : `We've sent a 6-digit code to ${otp.email.value.trim()}. It expires in ${r.expiresInMinutes} minutes. Check your spam folder if it doesn't arrive.`;
      countdown(r.resendAfterSeconds || 60);
    };
    otp.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      if (!validate(otp)) return;
      setBusy(btn, true, '');
      try {
        if (codeField.hidden) { await request(); setBusy(btn, false); btn.textContent = 'Sign in'; }
        else {
          const r = await api('/api/auth/otp-verify', { method: 'POST', body: { email: otp.email.value.trim(), code: otp.code.value.trim() } });
          S.setUser(r.user);
          track(r.isNew ? 'sign_up' : 'login', { method: 'otp' });
          await S.mergeWishlistOnSignIn().catch(() => {});
          location.href = r.needsProfile ? `/account/profile/?welcome=1&next=${encodeURIComponent(next())}` : next();
        }
      } catch (ex) { fail(ex); setBusy(btn, false); if (!codeField.hidden) btn.textContent = 'Sign in'; }
    });
    otp.code.addEventListener('input', () => { if (/^\d{6}$/.test(otp.code.value)) otp.requestSubmit(); });
    resend.addEventListener('click', async () => { err.hidden = true; try { await request(); } catch (ex) { fail(ex); } });
    otp.querySelector('[data-otp-change]').addEventListener('click', () => {
      clearInterval(timer);
      codeField.hidden = true; actions.hidden = true; otp.email.readOnly = false; otp.code.required = false;
      btn.textContent = 'Email me a code'; note.textContent = ''; otp.email.focus();
    });
  }

  root.querySelector('[data-register-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const f = e.currentTarget;
    if (!validate(f)) return;
    const btn = f.querySelector('button[type="submit"]');
    setBusy(btn, true, 'Creating account');
    try { const { user } = await api('/api/auth/register', { method: 'POST', body: formData(f) }); await signedIn(user, 'register'); } catch (ex) { fail(ex); setBusy(btn, false); }
  });

  // Password reset
  const token = new URLSearchParams(location.search).get('token');
  const reqForm = root.querySelector('[data-reset-request]');
  const confForm = root.querySelector('[data-reset-confirm]');
  const msg = root.querySelector('[data-auth-msg]');
  if (reqForm && token) { reqForm.hidden = true; confForm.hidden = false; }
  reqForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!validate(reqForm)) return;
    const btn = reqForm.querySelector('button');
    setBusy(btn, true, 'Sending');
    try {
      const r = await api('/api/auth/reset-request', { method: 'POST', body: formData(reqForm) });
      reqForm.hidden = true;
      msg.hidden = false;
      msg.innerHTML = r.devLink ? `Staging: email delivery is not configured. <a class="textlink" href="${r.devLink}">Open your reset link</a>.` : 'If an account exists for that email, you’ll receive a reset link shortly.';
    } catch (ex) { fail(ex); setBusy(btn, false); }
  });
  confForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!validate(confForm)) return;
    const btn = confForm.querySelector('button');
    setBusy(btn, true, 'Saving');
    try {
      await api('/api/auth/reset-confirm', { method: 'POST', body: { token, password: confForm.password.value } });
      confForm.hidden = true;
      msg.hidden = false;
      msg.className = 'alert alert--ok';
      msg.innerHTML = 'Your password has been updated. <a class="textlink" href="/account/login/">Sign in</a>.';
    } catch (ex) { fail(ex); setBusy(btn, false); }
  });
}

// /api/admin/* — operations back office. Role-based access; every route checks permissions server-side.
import { baseProducts, commerce, liveOverrides, stores } from '../lib/catalogue.mjs';
import { createCompany, leadCompany, listCompanies, scopeFor, updateCompany } from '../lib/companies.mjs';
import { idempotent } from '../lib/idempotency.mjs';
import { commandCenter, pulseStamp } from '../lib/metrics.mjs';
import { emailKey, hashPassword, randomCode, randomToken, safeEqual, sha256, verifyPassword } from '../lib/crypto.mjs';
import { BOOTSTRAP_ADMINS } from '../lib/admin-accounts.mjs';
import { adminOtpEmail, credentialChangedEmail, emailConfigured, sendEmail, statusEmail } from '../lib/email.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { getOrder, listOrders, saveOrder, setStatus, STATUSES, summary } from '../lib/orders.mjs';
import { providerFor } from '../lib/payments/index.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';
import { clearAdminCookie, clearAdminStep, currentAdmin, issueAdminSession, issueAdminStep, readAdminStep } from '../lib/session.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';

export const ROLES = {
  owner: ['dashboard', 'companies', 'audit', 'orders', 'customers', 'inventory', 'discounts', 'content', 'enquiries', 'subscribers', 'analytics', 'publish', 'users', 'media'],
  manager: ['dashboard', 'audit', 'orders', 'customers', 'inventory', 'discounts', 'content', 'enquiries', 'subscribers', 'analytics', 'publish', 'media'],
  fulfilment: ['dashboard', 'orders'],
  editor: ['dashboard', 'content', 'enquiries', 'publish', 'media', 'analytics'],
};
const CONTENT_KEYS = ['homepage', 'seo', 'redirects', 'stores', 'announcements'];
const TRANSITIONS = {
  pending_payment: ['cancelled'], payment_failed: ['cancelled'], paid: ['processing', 'cancelled', 'refunded'],
  processing: ['dispatched', 'cancelled', 'refunded'], dispatched: ['delivered', 'returned'], delivered: ['refunded'], returned: ['refunded'], cancelled: [], refunded: [],
};

/** Admin accounts: ADMIN_USERS env var (JSON) first, then the hashed accounts shipped in lib/admin-accounts.mjs.
 *  A staging-only bootstrap owner can be enabled with ADMIN_STAGING_PASSWORD + ADMIN_STAGING_PIN. */
function adminUsers() {
  let list = [];
  try { list = JSON.parse(process.env.ADMIN_USERS || '[]'); } catch { console.error('[admin] ADMIN_USERS is not valid JSON'); }
  const all = [...list, ...BOOTSTRAP_ADMINS.filter((b) => !list.some((u) => u.email?.toLowerCase() === b.email.toLowerCase()))];
  return all.filter((u) => u.email && u.passwordHash && ROLES[u.role]);
}
const LOCAL_ADMIN = { email: 'admin@cnm.local', role: 'owner', name: 'Local owner', password: 'cnm-local-admin', pin: '246810' };
const localStore = () => process.env.CNM_LOCAL_STORE === '1';
function baseAdmin(email) {
  const u = adminUsers().find((x) => x.email.toLowerCase() === email);
  if (u) return u;
  if (process.env.CONTEXT !== 'production' && process.env.ADMIN_STAGING_PASSWORD && email === 'staging@cnmessentials.com') return { email, role: 'owner', name: 'Staging owner', password: process.env.ADMIN_STAGING_PASSWORD, pin: process.env.ADMIN_STAGING_PIN };
  if (localStore() && email === LOCAL_ADMIN.email) return LOCAL_ADMIN;
  return null;
}
/** A password or PIN an admin reset themselves (Forgot password / Forgot PIN) is kept, hashed, in the "admins" store and wins over the configured one. */
const credKey = (email) => `cred/${emailKey(email)}`;
async function findAdmin(email) {
  const u = email && baseAdmin(email);
  if (!u) return null;
  const o = await (await store('admins')).get(credKey(u.email));
  return o ? { ...u, ...(o.passwordHash ? { passwordHash: o.passwordHash, password: undefined } : {}), ...(o.pinHash ? { pinHash: o.pinHash, pin: undefined } : {}) } : u;
}
async function saveCredential(u, patch) {
  const admins = await store('admins');
  const prev = (await admins.get(credKey(u.email))) || {};
  await admins.set(credKey(u.email), { ...prev, ...patch, email: u.email.toLowerCase(), updatedAt: new Date().toISOString() });
}
async function checkPassword(u, password) {
  if (!u) return false;
  return u.passwordHash ? verifyPassword(password, u.passwordHash) : safeEqual(password, u.password || '\0');
}
const hasPin = (u) => !!(u.pinHash || /^\d{6}$/.test(u.pin || ''));
async function checkPin(u, pin) { return u.pinHash ? verifyPassword(pin, u.pinHash) : safeEqual(pin, u.pin || '\0'); }
const maskEmail = (m) => m.replace(/^(.)(.*)(.@)/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 6)) + c);
const OTP_TTL = 10 * 60 * 1000;
const OTP_RESEND_AFTER = 30 * 1000;
const MAX_TRIES = 5;
const adminPayload = (u) => ({ email: u.email, role: u.role, name: u.name || u.email, permissions: ROLES[u.role] });
const loginAudit = async (req, context, email, action, detail = {}) => (await store('audit')).set(`${new Date().toISOString()}-${randomToken(4)}`, { admin: email, role: baseAdmin(email)?.role || null, action, detail, ip: clientIp(req, context), agent: (req.headers.get('user-agent') || '').slice(0, 160) });
const weakPin = (p) => /^(\d)\1{5}$/.test(p) || '0123456789012345'.includes(p) || '9876543210987654'.includes(p);
const GENERIC_RESET = 'If that email belongs to a CNM admin, we have sent it a reset code.';

/** Password (or "forgot password") accepted → email a fresh 6-digit code and move the browser to the code step. */
async function startOtp(req, u, { resend = false, remember = false, purpose = 'login' } = {}) {
  if (!emailConfigured() && !localStore()) fail(503, 'email_not_configured', 'Sign-in codes cannot be emailed yet: email sending (RESEND_API_KEY) is not set up on this site.');
  const tokens = await store('tokens');
  const key = `admin-login/${emailKey(u.email)}`;
  const prev = await tokens.get(key);
  if (resend && prev?.sentAt && Date.now() - prev.sentAt < OTP_RESEND_AFTER) fail(429, 'otp_cooldown', `Please wait ${Math.ceil((OTP_RESEND_AFTER - (Date.now() - prev.sentAt)) / 1000)} seconds before asking for another code.`);
  const code = randomCode(6);
  const nonce = randomToken(12);
  await tokens.set(key, { nonce, purpose, stage: 'otp', hash: sha256(`${nonce}:${code}`), exp: Date.now() + OTP_TTL, attempts: 0, pinAttempts: 0, sentAt: Date.now() });
  const { sent } = await sendEmail(adminOtpEmail(u.email, code, purpose));
  if (emailConfigured() && !sent) { await tokens.delete(key); fail(502, 'email_failed', 'We could not send your code. Please try again in a moment.'); }
  return json({ step: 'otp', purpose, email: maskEmail(u.email), expiresInMinutes: OTP_TTL / 60000, resendAfterSeconds: OTP_RESEND_AFTER / 1000, ...(purpose !== 'login' ? { message: GENERIC_RESET } : {}), ...(!emailConfigured() && localStore() ? { devCode: code } : {}) }, 200,
    { 'Set-Cookie': await issueAdminStep(req, { email: u.email.toLowerCase(), stage: 'otp', nonce, remember }) });
}

async function finishSignIn(req, context, u, st, tokens, key, detail = {}) {
  await tokens.delete(key);
  await loginAudit(req, context, u.email, 'login.success', { remembered: !!st.rem, ...(detail.changed ? { after: `${detail.changed} reset` } : {}) });
  const expiresAt = new Date(Date.now() + (st.rem ? 24 : 12) * 36e5).toISOString();
  return json({ admin: { ...adminPayload(u), remembered: !!st.rem, expiresAt }, ...detail }, 200, { 'Set-Cookie': [await issueAdminSession(req, u, { remember: !!st.rem }), clearAdminStep(req)] });
}

/**
 * Sign-in:          /login (email + password) → /login/otp (emailed code) → /login/pin → session.
 * Forgot password:  /login/forgot-password (email) → /login/otp → /login/pin → /login/new-password → session.
 * Forgot PIN:       /login (password) → /login/otp → /login/forgot-pin → /login/new-pin → session.
 * Every path needs two of password / emailed code / PIN; forgetting both password and PIN needs the group owner.
 */
async function loginFlow(req, context, step) {
  if (req.method !== 'POST') fail(405, 'method_not_allowed', 'Use POST.');
  const b = await readJson(req);
  if (!step) {
    await rateLimit('admin', clientIp(req, context));
    const email = v.email(b.email);
    const u = await findAdmin(email);
    if (!(await checkPassword(u, v.str(b.password, { name: 'Password', max: 200 })))) { if (u) await loginAudit(req, context, email, 'login.password_failed'); fail(401, 'invalid_credentials', 'Email or password is incorrect.'); }
    if (!hasPin(u)) fail(403, 'pin_not_set', 'This admin account has no PIN yet. Ask the owner to set one.');
    return startOtp(req, u, { remember: b.remember === true });
  }
  if (step === 'forgot-password') {
    await rateLimit('admin', clientIp(req, context));
    const email = v.email(b.email);
    const u = await findAdmin(email);
    await loginAudit(req, context, email, 'login.forgot_password', { known: !!u });
    if (u && hasPin(u)) return startOtp(req, u, { remember: b.remember === true, purpose: 'reset_password' });
    // Unknown email: answer exactly like a real one (a code that can never match), so the form can't be used to find admin emails.
    const nonce = randomToken(12);
    await (await store('tokens')).set(`admin-login/${emailKey(email)}`, { nonce, purpose: 'reset_password', stage: 'otp', hash: sha256(randomToken(16)), exp: Date.now() + OTP_TTL, attempts: 0, pinAttempts: 0, sentAt: Date.now() });
    return json({ step: 'otp', purpose: 'reset_password', email: maskEmail(email), expiresInMinutes: OTP_TTL / 60000, resendAfterSeconds: OTP_RESEND_AFTER / 1000, message: GENERIC_RESET }, 200,
      { 'Set-Cookie': await issueAdminStep(req, { email, stage: 'otp', nonce }) });
  }
  await rateLimit('admin2fa', clientIp(req, context));
  const st = await readAdminStep(req);
  const tokens = await store('tokens');
  const key = st && `admin-login/${emailKey(st.email)}`;
  const rec = key && await tokens.get(key);
  const restart = async (msg) => { if (key) await tokens.delete(key); return fail(401, 'login_expired', msg, { restart: true }); };
  if (!rec || rec.nonce !== st.nonce || rec.exp < Date.now()) return restart('Your sign-in has expired. Please start again.');
  const u = await findAdmin(st.email);
  const purpose = rec.purpose || 'login';
  const next = async (stage, extra = {}) => {
    rec.stage = stage; rec.exp = Date.now() + OTP_TTL;
    await tokens.set(key, rec);
    return json({ step: stage, purpose, ...extra }, 200, { 'Set-Cookie': await issueAdminStep(req, { email: st.email, stage, nonce: rec.nonce, remember: !!st.rem }) });
  };
  const at = (stage, msg) => { if (st.stage !== stage || rec.stage !== stage) fail(409, 'wrong_step', msg); };
  if (step === 'resend') {
    at('otp', 'Your code has already been checked.');
    if (!u) { rec.sentAt = Date.now(); await tokens.set(key, rec); return json({ step: 'otp', purpose, email: maskEmail(st.email), expiresInMinutes: OTP_TTL / 60000, resendAfterSeconds: OTP_RESEND_AFTER / 1000, message: GENERIC_RESET }); }
    return startOtp(req, u, { resend: true, remember: !!st.rem, purpose });
  }
  if (step === 'otp') {
    at('otp', 'Your code has already been checked. Enter your PIN.');
    const code = String(b.code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) fail(400, 'invalid_code', 'Enter the 6-digit code from your email.');
    if (!u || !safeEqual(sha256(`${rec.nonce}:${code}`), rec.hash)) {
      rec.attempts++;
      if (rec.attempts >= MAX_TRIES) { await loginAudit(req, context, st.email, 'login.otp_locked', { purpose }); return restart('Too many incorrect codes. Please start again to get a new code.'); }
      await tokens.set(key, rec);
      fail(400, 'invalid_code', `That code is incorrect. ${MAX_TRIES - rec.attempts} attempts left.`);
    }
    rec.hash = null;
    return next('pin');
  }
  if (!u) return restart('Your sign-in has expired. Please start again.');
  if (step === 'pin') {
    at('pin', 'Enter the code from your email first.');
    const pin = String(b.pin || '');
    if (!/^\d{6}$/.test(pin)) fail(400, 'invalid_pin', 'Enter your 6-digit PIN.');
    if (!(await checkPin(u, pin))) {
      rec.pinAttempts++;
      if (rec.pinAttempts >= MAX_TRIES) { await loginAudit(req, context, u.email, 'login.pin_locked', { purpose }); return restart('Too many incorrect PINs. Please start again.'); }
      await tokens.set(key, rec);
      await loginAudit(req, context, u.email, 'login.pin_failed', { purpose });
      fail(401, 'invalid_pin', `That PIN is incorrect. ${MAX_TRIES - rec.pinAttempts} attempts left.`);
    }
    if (purpose === 'reset_password') return next('new_password');
    return finishSignIn(req, context, u, st, tokens, key);
  }
  if (step === 'forgot-pin') {
    at('pin', 'Enter the code from your email first.');
    if (purpose !== 'login') fail(409, 'need_owner', 'To reset a password you need your PIN, and to reset a PIN you need your password. If you have forgotten both, ask the CNM Group owner to reset your account.');
    await loginAudit(req, context, u.email, 'login.forgot_pin');
    return next('new_pin');
  }
  if (step === 'new-password') {
    at('new_password', 'Confirm your email code and PIN first.');
    const pw = v.str(b.password, { name: 'New password', max: 200 });
    if (pw.length < 12) fail(422, 'weak_password', 'Use at least 12 characters for your new password.');
    if (pw !== b.confirm) fail(422, 'mismatch', 'The two passwords do not match.');
    if (pw.toLowerCase().includes(u.email.split('@')[0].toLowerCase())) fail(422, 'weak_password', 'Your password should not contain your email name.');
    if (await checkPassword(u, pw)) fail(422, 'same_password', 'Choose a password you have not used for this account.');
    await saveCredential(u, { passwordHash: await hashPassword(pw) });
    await sendEmail(credentialChangedEmail(u.email, 'password', clientIp(req, context)));
    await loginAudit(req, context, u.email, 'login.password_reset');
    return finishSignIn(req, context, u, st, tokens, key, { changed: 'password' });
  }
  if (step === 'new-pin') {
    at('new_pin', 'Confirm your password and email code first.');
    const pin = String(b.pin || '');
    if (!/^\d{6}$/.test(pin)) fail(422, 'invalid_pin', 'Your PIN must be exactly 6 digits.');
    if (pin !== String(b.confirm || '')) fail(422, 'mismatch', 'The two PINs do not match.');
    if (weakPin(pin)) fail(422, 'weak_pin', 'Avoid repeated or sequential digits such as 111111 or 123456.');
    if (hasPin(u) && await checkPin(u, pin)) fail(422, 'same_pin', 'Choose a PIN you have not used for this account.');
    await saveCredential(u, { pinHash: await hashPassword(pin) });
    await sendEmail(credentialChangedEmail(u.email, 'PIN', clientIp(req, context)));
    await loginAudit(req, context, u.email, 'login.pin_reset');
    return finishSignIn(req, context, u, st, tokens, key, { changed: 'pin' });
  }
  fail(404, 'not_found', 'Unknown sign-in step.');
}

const can = (admin, perm) => ROLES[admin.role]?.includes(perm);
const need = (admin, perm) => { if (!can(admin, perm)) fail(403, 'forbidden', 'Your role does not have access to this area.'); };

async function dashboard() {
  const orders = await listOrders();
  const paid = orders.filter((o) => ['paid', 'processing', 'dispatched', 'delivered'].includes(o.status));
  const revenue = paid.reduce((s, o) => s + o.totals.total, 0);
  const days = [...Array(14)].map((_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const series = days.map((d) => ({ date: d, revenue: paid.filter((o) => o.createdAt.startsWith(d)).reduce((s, o) => s + o.totals.total, 0), orders: paid.filter((o) => o.createdAt.startsWith(d)).length }));
  const inv = (await (await store('config')).get('inventory'))?.products || {};
  const lowStock = baseProducts.map((p) => ({ id: p.id, name: p.name, stock: inv[p.id]?.stock ?? p.stock.quantity })).filter((p) => p.stock != null && p.stock <= 5);
  const leads = await store('leads');
  const [enquiries, subs] = await Promise.all([leads.list('enquiry/'), leads.list('newsletter/')]);
  const enquiryRecs = await Promise.all(enquiries.map((k) => leads.get(k)));
  return {
    kpis: { revenue, orders: paid.length, aov: paid.length ? Math.round(revenue / paid.length) : 0, awaitingFulfilment: orders.filter((o) => ['paid', 'processing'].includes(o.status)).length, pendingPayment: orders.filter((o) => o.status === 'pending_payment').length, newEnquiries: enquiryRecs.filter((e) => e?.status === 'new').length, subscribers: subs.length },
    series, lowStock, recentOrders: orders.slice(0, 8).map((o) => ({ ...summary(o), customer: `${o.contact.firstName} ${o.contact.lastName}` })),
  };
}

/** All raw records the Command Center needs (small today; see ADMIN-OS-SPEC §12 for the Postgres rollups that replace this at scale). */
async function commandData() {
  const [orders, companies, inventory] = await Promise.all([listOrders(), listCompanies(), liveOverrides()]);
  const ev = await store('events');
  const keys = (await ev.list('daily/')).sort().slice(-800);
  const eventDays = await Promise.all(keys.map(async (k) => ({ date: k.slice(6), ...(await ev.get(k)) })));
  const leads = await store('leads');
  const enquiries = (await Promise.all((await leads.list('enquiry/')).map((k) => leads.get(k)))).filter(Boolean).map((e) => ({ ...e, companyId: leadCompany(e) }));
  return { orders, companies, inventory, eventDays, enquiries, products: baseProducts, stores };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function commandQuery(req, admin, companies) {
  const u = new URL(req.url).searchParams;
  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const to = DAY_RE.test(u.get('to') || '') ? u.get('to') : today;
  const from = DAY_RE.test(u.get('from') || '') ? u.get('from') : new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  if (from > to) fail(422, 'invalid', 'The start date must be on or before the end date.');
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 731) fail(422, 'invalid', 'Choose a range of two years or less.');
  const scope = scopeFor(admin, companies);
  const company = u.get('company') || 'all';
  if (company !== 'all' && !companies.some((c) => c.id === company)) fail(404, 'not_found', 'Unknown company.');
  if (scope && company !== 'all' && !scope.includes(company)) fail(403, 'forbidden', 'You do not have access to that company.');
  return {
    from, to, company, scope,
    compare: ['previous', 'year', 'none'].includes(u.get('compare')) ? u.get('compare') : 'previous',
    location: (u.get('location') || 'all').slice(0, 60), channel: ['all', 'web', 'app', 'manual', 'pos'].includes(u.get('channel')) ? u.get('channel') : 'all',
  };
}

async function analytics() {
  const s = await store('events');
  const keys = (await s.list('daily/')).sort().slice(-30);
  const days = await Promise.all(keys.map(async (k) => ({ date: k.slice(6), ...(await s.get(k)) })));
  const total = {};
  const searches = {};
  const zero = {};
  for (const d of days) {
    for (const [k, n] of Object.entries(d.counts || {})) total[k] = (total[k] || 0) + n;
    for (const [k, n] of Object.entries(d.searches || {})) searches[k] = (searches[k] || 0) + n;
    for (const [k, n] of Object.entries(d.zeroSearches || {})) zero[k] = (zero[k] || 0) + n;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const funnel = ['view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase'].map((k) => ({ step: k, count: total[k] || 0 }));
  return { days: days.map((d) => ({ date: d.date, counts: d.counts })), totals: total, funnel, topSearches: top(searches), zeroResultSearches: top(zero) };
}

export default handler(async (req, context) => {
  assertCsrf(req);
  const parts = segments(req).slice(2); // after api/admin
  const [area, id] = parts;

  if (area === 'login') return loginFlow(req, context, id);
  if (area === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearAdminCookie(req) });

  const admin = await currentAdmin(req);
  if (!admin) fail(401, 'unauthenticated', 'Please sign in to the admin.');
  const b = ['PUT', 'PATCH', 'POST'].includes(req.method) ? await readJson(req, area === 'media' ? 6 * 1024 * 1024 : 256 * 1024) : null;
  const cfg = await store('config');
  // Audit trail for every sensitive action: who, role, what, before/after detail, from which IP and device.
  const audit = async (action, detail) => (await store('audit')).set(`${new Date().toISOString()}-${randomToken(4)}`, { admin: admin.email, role: admin.role, action, detail, ip: clientIp(req, context), agent: (req.headers.get('user-agent') || '').slice(0, 160) });

  switch (area) {
    case 'me': {
      const companies = await listCompanies();
      const scope = scopeFor(admin, companies);
      return json({ admin: { email: admin.email, role: admin.role, name: admin.name, permissions: ROLES[admin.role], scope, ...(admin.preview ? { preview: true } : { remembered: !!admin.rem, expiresAt: new Date(admin.exp * 1000).toISOString() }) } });
    }

    // ---- Command Center: group / company overview with filters and comparisons ----
    case 'command': {
      need(admin, 'dashboard');
      const data = await commandData();
      const q = commandQuery(req, admin, data.companies);
      return json(commandCenter(data, q), 200, { 'Cache-Control': 'no-store' });
    }
    // ---- Live updates: a tiny change stamp the dashboard polls; it refetches only when something changed ----
    case 'pulse': {
      need(admin, 'dashboard');
      const orders = await listOrders();
      const leads = await store('leads');
      const enquiries = (await Promise.all((await leads.list('enquiry/')).map((k) => leads.get(k)))).filter(Boolean);
      return json({ stamp: pulseStamp(orders, enquiries), at: new Date().toISOString() }, 200, { 'Cache-Control': 'no-store' });
    }

    // ---- Companies (super admin): create, edit, archive; each change audited with before/after ----
    case 'companies': {
      const companies = await listCompanies();
      if (req.method === 'GET') {
        need(admin, 'dashboard');
        const scope = scopeFor(admin, companies);
        return json({ companies: companies.filter((c) => !scope || scope.includes(c.id)), canManage: can(admin, 'companies') });
      }
      need(admin, 'companies');
      if (req.method === 'POST' && !id) {
        const r = await idempotent(req, `${admin.email}:companies.create`, b, async () => {
          const c = await createCompany(b, admin.email);
          await audit('company.create', { id: c.id, name: c.name });
          return { status: 201, body: { company: c } };
        });
        return json({ ...r.body, ...(r.replayed ? { replayed: true } : {}) }, r.status);
      }
      if (req.method === 'PATCH' && id) {
        const { company, changed, before } = await updateCompany(decodeURIComponent(id), b, admin.email);
        if (changed.length) {
          const action = changed.includes('status') ? (company.status === 'archived' ? 'company.archive' : 'company.restore') : 'company.update';
          await audit(action, { id: company.id, changed, before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, company[k]])) });
        }
        return json({ company, changed });
      }
      fail(405, 'method', 'Method not allowed.');
    }
    case 'dashboard': need(admin, 'dashboard'); return json(await dashboard());
    case 'analytics': need(admin, 'analytics'); return json(await analytics());

    case 'orders': {
      need(admin, 'orders');
      if (!id) {
        const status = new URL(req.url).searchParams.get('status');
        const all = await listOrders();
        return json({ orders: all.filter((o) => !status || o.status === status).map((o) => ({ ...summary(o), customer: `${o.contact.firstName} ${o.contact.lastName}`, email: o.contact.email, delivery: o.delivery.label })) });
      }
      const order = await getOrder(decodeURIComponent(id));
      if (!order) fail(404, 'not_found', 'Order not found.');
      if (req.method === 'PATCH') {
        const next = v.oneOf(b.status, STATUSES, 'Status');
        if (!TRANSITIONS[order.status]?.includes(next)) fail(422, 'transition', `An order cannot move from ${order.status} to ${next}.`);
        if (next === 'refunded') {
          // Money goes back through the provider first; the order is only marked refunded if that succeeds.
          const amount = b.amount != null && b.amount !== '' ? Number(b.amount) : undefined;
          if (amount != null && !(amount > 0 && amount <= order.totals.total)) fail(422, 'invalid', 'Refund amount must be between 0 and the order total.');
          try {
            const r = await providerFor(order).refund(order, amount);
            order.payment.refund = { id: r.id, status: r.status, amount: amount ?? order.totals.total, requestedBy: admin.email, at: new Date().toISOString() };
          } catch (err) {
            fail(502, 'refund_failed', `The payment provider rejected the refund: ${err.message}`);
          }
        }
        setStatus(order, next, v.str(b.note, { name: 'Note', max: 300, required: false }), admin.email);
        await saveOrder(order);
        await sendEmail(statusEmail(order, new URL(req.url).origin));
        await audit('order.status', { number: order.number, status: next });
      }
      const { accessToken, ...safe } = order;
      return json({ order: safe, transitions: TRANSITIONS[order.status] });
    }

    case 'customers': {
      need(admin, 'customers');
      const users = await store('users');
      const recs = (await Promise.all((await users.list('user/')).map((k) => users.get(k)))).filter(Boolean);
      const orders = await listOrders();
      return json({ customers: recs.map((u) => ({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`, createdAt: u.createdAt, orders: orders.filter((o) => o.userId === u.id).length, marketing: !!u.preferences?.email?.newArrivals })) });
    }

    case 'enquiries': {
      need(admin, 'enquiries');
      const leads = await store('leads');
      if (id && req.method === 'PATCH') {
        const e = await leads.get(`enquiry/${id}`);
        if (!e) fail(404, 'not_found', 'Enquiry not found.');
        e.status = v.oneOf(b.status, ['new', 'contacted', 'quoted', 'won', 'lost'], 'Status');
        await leads.set(`enquiry/${id}`, e);
        await audit('enquiry.status', { id, status: e.status });
      }
      const list = (await Promise.all((await leads.list('enquiry/')).map((k) => leads.get(k)))).filter(Boolean).sort((a, x) => x.createdAt.localeCompare(a.createdAt));
      return json({ enquiries: list });
    }

    case 'subscribers': {
      need(admin, 'subscribers');
      const leads = await store('leads');
      const subs = (await Promise.all((await leads.list('newsletter/')).map((k) => leads.get(k)))).filter(Boolean);
      const bis = (await Promise.all((await leads.list('bis/')).map((k) => leads.get(k)))).filter(Boolean);
      return json({ subscribers: subs, backInStock: bis });
    }

    case 'inventory': {
      need(admin, 'inventory');
      const cur = (await cfg.get('inventory')) || { products: {} };
      if (req.method === 'PUT') {
        const next = { products: {} };
        for (const p of baseProducts) {
          const x = b.products?.[p.id];
          if (!x) { if (cur.products[p.id]) next.products[p.id] = cur.products[p.id]; continue; }
          const num = (n, name) => (n === '' || n == null ? undefined : Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.round(Number(n) * 100) / 100 : fail(422, 'invalid', `${name} for ${p.name} is invalid.`));
          next.products[p.id] = {
            price: num(x.price, 'Price'), compareAt: num(x.compareAt, 'Compare-at price'), stock: num(x.stock, 'Stock'),
            available: x.available !== false, priceApproved: !!x.priceApproved,
            description: v.str(x.description, { name: 'Description', max: 4000, required: false }) || undefined,
            images: Array.isArray(x.images) ? x.images.filter((i) => typeof i?.src === 'string').slice(0, 8).map((i) => ({ src: i.src.slice(0, 500), alt: v.str(i.alt, { name: 'Alt text', max: 200 }) })) : cur.products[p.id]?.images,
            seo: { title: v.str(x.seo?.title, { name: 'SEO title', max: 70, required: false }) || undefined, description: v.str(x.seo?.description, { name: 'Meta description', max: 160, required: false }) || undefined },
          };
        }
        await cfg.set('inventory', next);
        await audit('inventory.update', { count: Object.keys(next.products).length });
        return json({ products: baseProducts.map((p) => ({ id: p.id, name: p.name, base: { price: p.price.amount, stock: p.stock.quantity }, override: next.products[p.id] || null })) });
      }
      return json({ products: baseProducts.map((p) => ({ id: p.id, name: p.name, category: p.category, base: { price: p.price.amount, stock: p.stock.quantity }, override: cur.products[p.id] || null })) });
    }

    case 'discounts': {
      need(admin, 'discounts');
      if (req.method === 'PUT') {
        if (!Array.isArray(b.discounts) || b.discounts.length > 100) fail(422, 'invalid', 'Invalid discounts.');
        const list = b.discounts.map((d) => ({
          code: v.str(d.code, { name: 'Code', max: 40 }).toUpperCase().replace(/[^A-Z0-9_-]/g, ''), type: v.oneOf(d.type, ['percent', 'fixed'], 'Type'),
          value: Math.max(0, Math.min(d.type === 'percent' ? 100 : 10_000_000, Number(d.value) || 0)), minSubtotal: Math.max(0, Number(d.minSubtotal) || 0), active: d.active !== false,
          note: v.str(d.note, { name: 'Note', max: 200, required: false }),
        }));
        await cfg.set('discounts', { discounts: list });
        await audit('discounts.update', { count: list.length });
      }
      return json({ discounts: (await commerce()).discounts });
    }

    case 'content': {
      need(admin, 'content');
      if (!CONTENT_KEYS.includes(id)) fail(404, 'not_found', 'Unknown content key.');
      if (req.method === 'PUT') {
        if (JSON.stringify(b).length > 200 * 1024) fail(413, 'too_large', 'Content too large.');
        await cfg.set(`content/${id}`, { ...b, updatedAt: new Date().toISOString(), updatedBy: admin.email });
        await audit('content.update', { key: id });
      }
      return json({ key: id, value: await cfg.get(`content/${id}`) });
    }

    case 'media': {
      need(admin, 'media');
      const media = await store('media');
      if (req.method === 'POST') {
        const type = v.oneOf(b.type, ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'video/mp4'], 'File type');
        const name = v.str(b.name, { name: 'File name', max: 120 }).replace(/[^\w.-]/g, '-');
        const data = v.str(b.data, { name: 'File', max: 6 * 1024 * 1024 });
        const key = `${Date.now()}-${name}`;
        await media.set(`file/${key}`, { type, data, name, uploadedBy: admin.email, at: new Date().toISOString() });
        await audit('media.upload', { key });
        return json({ url: `/api/media/${encodeURIComponent(key)}` }, 201);
      }
      const keys = await media.list('file/');
      return json({ media: keys.map((k) => ({ key: k.slice(5), url: `/api/media/${encodeURIComponent(k.slice(5))}` })) });
    }

    case 'publish': {
      need(admin, 'publish');
      if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
      // A build/deploy hook URL: Netlify build hook or Cloudflare Pages deploy hook.
      const hook = process.env.DEPLOY_HOOK_URL || process.env.NETLIFY_BUILD_HOOK_URL;
      if (!hook) fail(501, 'not_configured', 'Set DEPLOY_HOOK_URL (a Cloudflare Pages deploy hook or Netlify build hook) to enable publishing from the admin.');
      const r = await fetch(hook, { method: 'POST' });
      await audit('publish', { status: r.status });
      return json({ ok: r.ok });
    }

    case 'users': {
      need(admin, 'users');
      return json({ users: adminUsers().map((u) => ({ email: u.email, name: u.name, role: u.role })), roles: ROLES, stagingBootstrap: !!process.env.ADMIN_STAGING_PASSWORD && process.env.CONTEXT !== 'production' });
    }

    case 'audit': {
      need(admin, 'audit');
      const a = await store('audit');
      const keys = (await a.list('')).sort().slice(-300).reverse();
      const entries = await Promise.all(keys.map(async (k) => ({ at: k.slice(0, 24), ...(await a.get(k)) })));
      // Preview visitors see what happened, not staff IP addresses or devices.
      return json({ entries: admin.preview ? entries.map((x) => ({ ...x, ip: null, agent: null })) : entries });
    }

    default:
      fail(404, 'not_found', 'Unknown admin area.');
  }
});

export const config = { path: ['/api/admin/:area', '/api/admin/:area/:id'] };

// Integration tests: exercise the Netlify functions directly with the local store.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';

process.env.CNM_LOCAL_STORE = '1';
process.env.CNM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'cnm-test-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.PAYSTACK_SECRET_KEY = '';

const fn = {};
before(async () => {
  for (const n of ['auth', 'account', 'checkout', 'payments', 'orders', 'admin', 'leads', 'catalogue-live']) fn[n] = (await import(`../../netlify/functions/${n}.mjs`)).default;
});

let ipn = 0;
const call = async (f, method, p, { body, cookie, headers = {}, csrf = true, ip } = {}) => {
  const h = { 'content-type': 'application/json', ...headers };
  if (csrf && method !== 'GET') h['x-cnm-request'] = '1';
  if (cookie) h.cookie = cookie;
  const res = await fn[f](new Request(`http://localhost${p}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), { ip: ip || `10.0.0.${++ipn}` });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';')[0] };
};

const contact = { email: 'ada@example.com', phone: '+2348012345678', firstName: 'Ada', lastName: 'Obi' };
const delivery = { method: 'lagos-standard', address: { line1: '1 Test Road', city: 'Ikoyi', state: 'Lagos' } };

test('auth: register, me, duplicate, login, wrong password, logout-all invalidates', async () => {
  const r = await call('auth', 'POST', '/api/auth/register', { body: { email: 'Ada@Example.com', password: 'correct-horse-1', firstName: 'Ada', lastName: 'Obi' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.token, undefined, 'web never receives the raw token');
  assert.match(r.cookie, /^cnm_session=/);
  assert.equal((await call('auth', 'GET', '/api/auth/me', { cookie: r.cookie })).data.user.email, 'ada@example.com');
  assert.equal((await call('auth', 'POST', '/api/auth/register', { body: { email: 'ada@example.com', password: 'correct-horse-1', firstName: 'A', lastName: 'O' } })).status, 409);
  assert.equal((await call('auth', 'POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'wrong-password' } })).status, 401);
  const mobile = await call('auth', 'POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'correct-horse-1' }, headers: { 'x-cnm-client': 'mobile' } });
  assert.ok(mobile.data.token, 'mobile receives a bearer token');
  assert.equal((await call('account', 'GET', '/api/account/profile', { headers: { authorization: `Bearer ${mobile.data.token}` } })).status, 200);
  await call('account', 'POST', '/api/account/logout-all', { cookie: r.cookie });
  assert.equal((await call('auth', 'GET', '/api/auth/me', { cookie: r.cookie })).status, 401);
});

test('auth: password reset and OTP flows (dev link/code only in staging without email)', async () => {
  await call('auth', 'POST', '/api/auth/register', { body: { email: 'reset@example.com', password: 'first-password', firstName: 'R', lastName: 'S' } });
  const rq = await call('auth', 'POST', '/api/auth/reset-request', { body: { email: 'reset@example.com' } });
  const token = new URL(rq.data.devLink).searchParams.get('token');
  assert.equal((await call('auth', 'POST', '/api/auth/reset-confirm', { body: { token, password: 'second-password' } })).status, 200);
  assert.equal((await call('auth', 'POST', '/api/auth/reset-confirm', { body: { token, password: 'third-password' } })).status, 400, 'tokens are single use');
  assert.equal((await call('auth', 'POST', '/api/auth/login', { body: { email: 'reset@example.com', password: 'second-password' } })).status, 200);
  const unknown = await call('auth', 'POST', '/api/auth/reset-request', { body: { email: 'nobody@example.com' } });
  assert.equal(unknown.status, 200, 'no account enumeration');
  const otp = await call('auth', 'POST', '/api/auth/otp-request', { body: { email: 'reset@example.com' } });
  assert.equal((await call('auth', 'POST', '/api/auth/otp-verify', { body: { email: 'reset@example.com', code: '000000' === otp.data.devCode ? '111111' : '000000' } })).status, 400);
  assert.equal((await call('auth', 'POST', '/api/auth/otp-verify', { body: { email: 'reset@example.com', code: otp.data.devCode } })).status, 200);
});

test('security: CSRF header required for cookie requests; auth required for account', async () => {
  assert.equal((await call('checkout', 'POST', '/api/checkout/quote', { body: { items: [{ id: 'midnight-vanilla-room-spray', qty: 1 }] }, csrf: false })).status, 403);
  assert.equal((await call('checkout', 'POST', '/api/checkout/quote', { body: { items: [{ id: 'midnight-vanilla-room-spray', qty: 1 }] }, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call('account', 'GET', '/api/account/orders')).status, 401);
  const forged = 'cnm_session=eyJ0eXAiOiJ1c2VyIiwidWlkIjoieCIsInYiOjAsImV4cCI6OTk5OTk5OTk5OX0.forged';
  assert.equal((await call('auth', 'GET', '/api/auth/me', { cookie: forged })).status, 401);
});

test('security: rate limiting on login', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await call('auth', 'POST', '/api/auth/login', { body: { email: 'x@example.com', password: 'nope-nope-nope' }, ip: '9.9.9.9' });
  assert.equal(last.status, 429);
});

test('checkout: server prices (client prices ignored), simulated failure then success, stock committed', async () => {
  const { store } = await import('../../netlify/lib/store.mjs');
  await (await store('config')).set('inventory', { products: { 'midnight-vanilla-room-spray': { stock: 50 }, 'crushed-room-spray': { stock: 0 } } });
  const reg = await call('auth', 'POST', '/api/auth/register', { body: { email: 'buyer@example.com', password: 'buyer-password', firstName: 'B', lastName: 'Y' } });
  const r = await call('checkout', 'POST', '/api/checkout', { cookie: reg.cookie, body: { items: [{ id: 'midnight-vanilla-room-spray', qty: 2, price: 1 }], contact, delivery, promoCode: 'STAGING10' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.payment.mode, 'simulated');
  assert.equal(r.data.order.total, 35700 - 3570 + 3500);
  const { number, accessToken } = r.data.order;
  assert.equal((await call('orders', 'GET', `/api/orders/${number}?token=wrong`)).status, 404);
  const fail = await call('payments', 'POST', '/api/payments/simulate', { body: { number, accessToken, outcome: 'failure' } });
  assert.equal(fail.data.order.status, 'payment_failed');
  const ok = await call('payments', 'POST', '/api/payments/simulate', { body: { number, accessToken, outcome: 'success' } });
  assert.equal(ok.data.order.status, 'paid');
  const again = await call('payments', 'POST', '/api/payments/simulate', { body: { number, accessToken, outcome: 'success' } });
  assert.equal(again.data.order.history.filter((h) => h.status === 'paid').length, 1, 'idempotent');
  const live = await call('catalogue-live', 'GET', '/api/catalogue/live');
  assert.equal(live.data.products['midnight-vanilla-room-spray'].stock, 48);
  const mine = await call('account', 'GET', '/api/account/orders', { cookie: reg.cookie });
  assert.equal(mine.data.orders[0].number, number);
});

test('checkout: validation — out of stock, region mismatch, bad email', async () => {
  assert.equal((await call('checkout', 'POST', '/api/checkout', { body: { items: [{ id: 'crushed-room-spray', qty: 1 }], contact, delivery } })).status, 409);
  const wrongRegion = await call('checkout', 'POST', '/api/checkout', { body: { items: [{ id: 'midnight-vanilla-room-spray', qty: 1 }], contact, delivery: { method: 'abuja-standard', address: delivery.address } } });
  assert.equal(wrongRegion.status, 422);
  assert.equal((await call('checkout', 'POST', '/api/checkout', { body: { items: [{ id: 'midnight-vanilla-room-spray', qty: 1 }], contact: { ...contact, email: 'nope' }, delivery } })).status, 422);
});

test('payments: Paystack webhook signature is verified', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'none', amount: 1 } });
  const bad = await fn.payments(new Request('http://localhost/api/payments/paystack-webhook', { method: 'POST', body, headers: { 'x-paystack-signature': 'bad' } }), {});
  assert.equal(bad.status, 401);
  const sig = createHmac('sha512', 'sk_test_x').update(body).digest('hex');
  const good = await fn.payments(new Request('http://localhost/api/payments/paystack-webhook', { method: 'POST', body, headers: { 'x-paystack-signature': sig } }), {});
  assert.equal(good.status, 200);
  process.env.PAYSTACK_SECRET_KEY = '';
});

test('admin: login, RBAC, order status transitions and notifications', async () => {
  assert.equal((await call('admin', 'GET', '/api/admin/dashboard')).status, 401);
  const { hashPassword } = await import('../../netlify/lib/crypto.mjs');
  process.env.ADMIN_USERS = JSON.stringify([{ email: 'ops@cnm.test', name: 'Ops', role: 'fulfilment', passwordHash: await hashPassword('ops-password-1') }]);
  const ops = await call('admin', 'POST', '/api/admin/login', { body: { email: 'ops@cnm.test', password: 'ops-password-1' } });
  assert.equal(ops.status, 200);
  assert.equal((await call('admin', 'GET', '/api/admin/inventory', { cookie: ops.cookie })).status, 403, 'fulfilment cannot edit inventory');
  const orders = await call('admin', 'GET', '/api/admin/orders', { cookie: ops.cookie });
  const paid = orders.data.orders.find((o) => o.status === 'paid');
  assert.equal((await call('admin', 'PATCH', `/api/admin/orders/${paid.number}`, { cookie: ops.cookie, body: { status: 'delivered' } })).status, 422, 'invalid transition');
  const moved = await call('admin', 'PATCH', `/api/admin/orders/${paid.number}`, { cookie: ops.cookie, body: { status: 'processing', note: 'Packing' } });
  assert.equal(moved.data.order.status, 'processing');
  assert.equal(moved.data.order.accessToken, undefined);
  const owner = await call('admin', 'POST', '/api/admin/login', { body: { email: 'admin@cnm.local', password: 'cnm-local-admin' } });
  const inv = await call('admin', 'PUT', '/api/admin/inventory', { cookie: owner.cookie, body: { products: { 'petalrich-room-spray': { price: 16000, stock: 7 } } } });
  assert.equal(inv.status, 200);
  const q = await call('checkout', 'POST', '/api/checkout/quote', { body: { items: [{ id: 'petalrich-room-spray', qty: 1 }] } });
  assert.equal(q.data.subtotal, 16000, 'admin price override is authoritative');
});

test('leads: enquiry requires consent; honeypot; newsletter', async () => {
  const base = { name: 'Chi', email: 'chi@example.com', sector: 'weddings', message: 'We would love scent for our wedding.' };
  assert.equal((await call('leads', 'POST', '/api/enquiry', { body: base })).status, 422);
  assert.equal((await call('leads', 'POST', '/api/enquiry', { body: { ...base, consent: true } })).status, 201);
  assert.equal((await call('leads', 'POST', '/api/enquiry', { body: { ...base, website: 'spam' } })).status, 200);
  assert.equal((await call('leads', 'POST', '/api/newsletter', { body: { email: 'n@example.com', consent: true } })).status, 201);
});

test('otp sign-in: new customers get a code, verify creates a verified account; cooldown; attempt limits', async () => {
  const email = 'newbuyer@example.com';
  const r1 = await call('auth', 'POST', '/api/auth/otp-request', { body: { email } });
  assert.equal(r1.status, 200);
  assert.match(r1.data.devCode, /^\d{6}$/);
  assert.equal((await call('auth', 'POST', '/api/auth/otp-request', { body: { email } })).status, 429, 'resend cooldown');
  const wrong = await call('auth', 'POST', '/api/auth/otp-verify', { body: { email, code: r1.data.devCode === '000000' ? '111111' : '000000' } });
  assert.match(wrong.data.message, /4 attempts left/);
  const ok = await call('auth', 'POST', '/api/auth/otp-verify', { body: { email, code: r1.data.devCode } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.isNew, true);
  assert.equal(ok.data.needsProfile, true);
  assert.match(ok.cookie, /^cnm_session=/);
  assert.equal((await call('auth', 'POST', '/api/auth/otp-verify', { body: { email, code: r1.data.devCode } })).status, 400, 'codes are single use');
  const pw = await call('auth', 'POST', '/api/auth/login', { body: { email, password: 'whatever-password' } });
  assert.match(pw.data.message, /email code/);
});

test('admin refunds go through the payment adapter before the order is marked refunded', async () => {
  const owner = await call('admin', 'POST', '/api/admin/login', { body: { email: 'admin@cnm.local', password: 'cnm-local-admin' } });
  const orders = await call('admin', 'GET', '/api/admin/orders?status=processing', { cookie: owner.cookie });
  const n = orders.data.orders[0].number;
  assert.equal((await call('admin', 'PATCH', `/api/admin/orders/${n}`, { cookie: owner.cookie, body: { status: 'refunded', amount: 99999999 } })).status, 422);
  const r = await call('admin', 'PATCH', `/api/admin/orders/${n}`, { cookie: owner.cookie, body: { status: 'refunded', amount: 1000 } });
  assert.equal(r.data.order.status, 'refunded');
  assert.equal(r.data.order.payment.refund.amount, 1000);
  assert.equal(r.data.order.payment.refund.status, 'processed');
});

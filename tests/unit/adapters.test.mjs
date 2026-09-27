// Adapter tests with mocked HTTP: Paystack payments and the Supabase store. No network or real keys needed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import * as paystack from '../../netlify/lib/payments/paystack.mjs';
import { activeProvider } from '../../netlify/lib/payments/index.mjs';
import { supabaseStore } from '../../netlify/lib/store.mjs';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete process.env.PAYSTACK_SECRET_KEY; delete process.env.PAYSTACK_CHANNELS; });

const order = { number: 'CNM-260927-ABCDE', totals: { total: 14888.75 }, contact: { email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi', phone: '+2348012345678' }, payment: { provider: 'paystack', reference: 'CNM-260927-ABCDE-x1' } };
const mockFetch = (handler) => { const calls = []; globalThis.fetch = async (url, init = {}) => { calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null }); const { status = 200, body } = await handler(url, init, calls.length); return new Response(JSON.stringify(body), { status }); }; return calls; };

test('provider selection: simulator without a key, Paystack with one', () => {
  assert.equal(activeProvider().name, 'simulated');
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  assert.equal(activeProvider().name, 'paystack');
  assert.equal(paystack.isTestMode(), true);
});

test('paystack.initialize: kobo amount, NGN, channels, metadata, bearer auth', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  process.env.PAYSTACK_CHANNELS = 'card,bank_transfer';
  const calls = mockFetch(() => ({ body: { status: true, data: { authorization_url: 'https://checkout.paystack.com/xyz', access_code: 'xyz' } } }));
  const r = await paystack.initialize(order, { callbackUrl: 'https://cnmshop.netlify.app/checkout/confirmation/?n=1' });
  assert.equal(r.authorizationUrl, 'https://checkout.paystack.com/xyz');
  assert.equal(calls[0].url, 'https://api.paystack.co/transaction/initialize');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk_test_abc');
  assert.equal(calls[0].body.amount, 1488875);
  assert.equal(calls[0].body.currency, 'NGN');
  assert.deepEqual(calls[0].body.channels, ['card', 'bank_transfer']);
  assert.equal(calls[0].body.metadata.order_number, order.number);
});

test('paystack.initialize: retries once with a fresh reference on "Duplicate Transaction Reference"', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  const calls = mockFetch((u, i, n) => (n === 1 ? { status: 400, body: { status: false, message: 'Duplicate Transaction Reference' } } : { body: { status: true, data: { authorization_url: 'https://x', access_code: 'a' } } }));
  const r = await paystack.initialize(order, { callbackUrl: 'https://x' });
  assert.equal(calls.length, 2);
  assert.notEqual(r.reference, order.payment.reference);
  assert.equal(calls[1].body.reference, r.reference);
});

test('paystack.verify normalises statuses; errors surface Paystack messages', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  mockFetch(() => ({ body: { status: true, data: { status: 'success', amount: 1488875, currency: 'NGN', channel: 'card', paid_at: '2026-09-27T10:00:00Z' } } }));
  assert.deepEqual(await paystack.verify('ref'), { status: 'success', amountKobo: 1488875, currency: 'NGN', channel: 'card', paidAt: '2026-09-27T10:00:00Z', gatewayResponse: undefined });
  mockFetch(() => ({ body: { status: true, data: { status: 'abandoned' } } }));
  assert.equal((await paystack.verify('ref')).status, 'abandoned');
  mockFetch(() => ({ status: 404, body: { status: false, message: 'Transaction reference not found' } }));
  await assert.rejects(paystack.verify('nope'), /Transaction reference not found/);
});

test('paystack.parseWebhook: HMAC-SHA512 signature required; events normalised', () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  const raw = JSON.stringify({ event: 'charge.success', data: { reference: 'ref1', amount: 100, currency: 'NGN', channel: 'bank_transfer' } });
  const sig = createHmac('sha512', 'sk_test_abc').update(raw).digest('hex');
  assert.equal(paystack.parseWebhook(raw, new Headers({ 'x-paystack-signature': 'bad' })), null);
  assert.deepEqual(paystack.parseWebhook(raw, new Headers({ 'x-paystack-signature': sig })), { type: 'payment.success', reference: 'ref1', amountKobo: 100, currency: 'NGN', channel: 'bank_transfer' });
  process.env.PAYSTACK_ENFORCE_IPS = 'true';
  assert.equal(paystack.parseWebhook(raw, new Headers({ 'x-paystack-signature': sig }), '1.2.3.4'), null);
  assert.ok(paystack.parseWebhook(raw, new Headers({ 'x-paystack-signature': sig }), '52.31.139.75'));
  delete process.env.PAYSTACK_ENFORCE_IPS;
});

test('paystack.refund: full and partial refunds in kobo', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  const calls = mockFetch(() => ({ body: { status: true, data: { id: 42, status: 'pending' } } }));
  assert.deepEqual(await paystack.refund(order), { status: 'pending', id: 42 });
  assert.equal(calls[0].body.transaction, order.payment.reference);
  assert.equal(calls[0].body.amount, undefined);
  await paystack.refund(order, 5000.5);
  assert.equal(calls[1].body.amount, 500050);
});

test('supabase store: upsert, get, list by prefix (escaping _), delete, secret-key headers', async () => {
  const rows = new Map();
  const seen = [];
  const fetchImpl = async (u, init = {}) => {
    const url = new URL(u);
    seen.push(init.headers);
    const p = url.searchParams;
    const store = p.get('store')?.slice(3);
    if (init.method === 'POST') { const b = JSON.parse(init.body); rows.set(`${b.store}|${b.key}`, b.value); return new Response(null, { status: 201 }); }
    if (init.method === 'DELETE') { rows.delete(`${store}|${p.get('key').slice(3)}`); return new Response(null, { status: 204 }); }
    if (p.get('key')?.startsWith('eq.')) { const v = rows.get(`${store}|${p.get('key').slice(3)}`); return new Response(JSON.stringify(v === undefined ? [] : [{ value: v }])); }
    const like = p.get('key').slice(5).replace(/\*$/, '');
    const re = new RegExp(`^${like.replace(/\\(.)|([.*+?^${}()|[\]])|_/g, (m, esc, special) => (esc ? esc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : special ? `\\${special}` : '.'))}`);
    const keys = [...rows.keys()].filter((k) => k.startsWith(`${store}|`)).map((k) => k.split('|')[1]).filter((k) => re.test(k));
    return new Response(JSON.stringify(keys.map((key) => ({ key }))));
  };
  const s = supabaseStore('orders', { url: 'https://proj.supabase.co', key: 'sb_secret_test', fetchImpl });
  await s.set('order/A_1', { n: 1 });
  await s.set('order/AB1', { n: 2 });
  await s.set('user/u1/order', { n: 3 });
  assert.deepEqual(await s.get('order/A_1'), { n: 1 });
  assert.equal(await s.get('missing'), null);
  assert.deepEqual((await s.list('order/A_')).sort(), ['order/A_1']);
  assert.equal((await s.list('order/')).length, 2);
  await s.delete('order/A_1');
  assert.equal(await s.get('order/A_1'), null);
  assert.equal(seen[0].apikey, 'sb_secret_test');
  assert.equal(seen[0].Authorization, undefined);
  const legacy = supabaseStore('x', { url: 'https://p.supabase.co', key: 'eyJhbGciOi.jwt', fetchImpl });
  await legacy.get('k');
  assert.equal(seen.at(-1).Authorization, 'Bearer eyJhbGciOi.jwt');
});

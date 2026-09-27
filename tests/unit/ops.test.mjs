// Phase 1 operations: orders search, fulfilment & delivery, exceptions, refunds with approvals, returns, manual orders,
// courier webhooks, RBAC and company scope.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { adminLogin, TEST_PIN } from './admin-login.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';

process.env.CNM_LOCAL_STORE = '1';
process.env.CNM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'cnm-ops-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.PAYSTACK_SECRET_KEY = '';
process.env.COURIER_WEBHOOK_SECRET_GIG = 'wh-secret';

const fn = {};
let hash;
before(async () => {
  for (const n of ['checkout', 'payments', 'admin', 'ops', 'courier-webhook']) fn[n] = (await import(`../../netlify/functions/${n}.mjs`)).default;
  hash = (await import('../../netlify/lib/crypto.mjs')).hashPassword;
  const { store } = await import('../../netlify/lib/store.mjs');
  await (await store('config')).set('inventory', { products: { 'midnight-vanilla-room-spray': { stock: 40 }, 'petalrich-room-spray': { stock: 40 }, 'love-stoned-room-spray': { stock: 40 } } });
  process.env.ADMIN_USERS = JSON.stringify([
    { email: 'm1@cnm.test', name: 'Manager One', role: 'manager', passwordHash: await hash('manager-one-pass'), pinHash: await hash(TEST_PIN) },
    { email: 'm2@cnm.test', name: 'Manager Two', role: 'manager', passwordHash: await hash('manager-two-pass'), pinHash: await hash(TEST_PIN) },
    { email: 'ship@cnm.test', name: 'Dispatch', role: 'fulfilment', passwordHash: await hash('dispatch-pass-1'), pinHash: await hash(TEST_PIN) },
    { email: 'sp@cnm.test', name: 'Spectra lead', role: 'manager', companies: ['spectra'], passwordHash: await hash('spectra-pass-12'), pinHash: await hash(TEST_PIN) },
  ]);
});

let ipn = 0;
const call = async (f, method, p, { body, cookie, headers = {}, raw } = {}) => {
  const h = { 'content-type': 'application/json', 'x-cnm-request': '1', ...headers };
  if (cookie) h.cookie = cookie;
  const res = await fn[f](new Request(`http://localhost${p}`, { method, headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) }), { ip: `10.20.0.${++ipn % 250}` });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';')[0], headers: res.headers };
};
const login = async (email, password) => (await adminLogin((p, body, cookie) => call('admin', 'POST', p, { body, cookie }), email, password)).cookie;
const contact = { email: 'chioma@example.com', phone: '+2348031234567', firstName: 'Chioma', lastName: 'Nwosu' };
const delivery = { method: 'lagos-standard', address: { line1: '5 Admiralty Way', city: 'Lekki', state: 'Lagos' } };
async function paidOrder(items = [{ id: 'midnight-vanilla-room-spray', qty: 2 }], c = contact) {
  const r = await call('checkout', 'POST', '/api/checkout', { body: { items, contact: c, delivery } });
  const { number, accessToken } = r.data.order;
  await call('payments', 'POST', '/api/payments/simulate', { body: { number, accessToken, outcome: 'success' } });
  return number;
}

test('orders: search by name, phone, product; filters; keyset pages; CSV export', async () => {
  const m1 = await login('m1@cnm.test', 'manager-one-pass');
  const a = await paidOrder();
  await paidOrder([{ id: 'petalrich-room-spray', qty: 1 }], { ...contact, email: 'tunde@example.com', phone: '+2348099990000', firstName: 'Tunde', lastName: 'Bakare' });
  await paidOrder([{ id: 'love-stoned-room-spray', qty: 1 }], { ...contact, email: 'zainab@example.com', phone: '+2348077770000', firstName: 'Zainab', lastName: 'Bello' });
  const byName = await call('ops', 'GET', '/api/ops/orders?q=chioma', { cookie: m1 });
  assert.ok(byName.data.orders.every((o) => o.customer.includes('Chioma')) && byName.data.orders.some((o) => o.number === a));
  assert.equal((await call('ops', 'GET', '/api/ops/orders?q=08099990000', { cookie: m1 })).data.orders[0].customer, 'Tunde Bakare', 'local phone format finds +234 numbers');
  assert.equal((await call('ops', 'GET', '/api/ops/orders?q=petalrich', { cookie: m1 })).data.total, 1);
  assert.ok((await call('ops', 'GET', '/api/ops/orders?status=paid&location=Lagos', { cookie: m1 })).data.total >= 3);
  const p1 = await call('ops', 'GET', '/api/ops/orders?limit=10', { cookie: m1 });
  assert.ok(p1.data.counts.paid >= 3);
  const csv = await call('ops', 'GET', '/api/ops/orders/export?q=zainab', { cookie: m1 });
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.data, /Zainab Bello/);
});

test('fulfilment: pack → courier → hand over → failed attempt (exception) → reschedule → deliver with proof; order status follows', async () => {
  const ship = await login('ship@cnm.test', 'dispatch-pass-1');
  const n = await paidOrder();
  let d = await call('ops', 'GET', `/api/ops/orders/${n}`, { cookie: ship });
  assert.deepEqual(d.data.allowed.shipment, ['packed']);
  assert.equal(d.data.allowed.refund, false, 'fulfilment staff cannot refund');
  d = await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'packed' } });
  assert.equal(d.data.order.status, 'processing');
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'handed_over' } })).status, 422, 'courier required first');
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'delivered' } })).status, 422, 'no skipping steps');
  await call('ops', 'PATCH', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { courier: 'gig', trackingNumber: 'GIG-001', eta: '2026-10-01', promisedBy: '2026-10-02' } });
  d = await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'handed_over' } });
  assert.equal(d.data.order.status, 'dispatched');
  assert.equal((await call('ops', 'PATCH', `/api/ops/orders/${n}/address`, { cookie: ship, body: { address: { line1: 'x', city: 'y', state: 'Lagos' } } })).status, 422, 'address locked once with the courier');
  d = await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'failed_attempt', note: 'Customer not at home' } });
  assert.equal(d.data.order.shipment.exception.kind, 'failed_attempt');
  assert.equal(d.data.order.shipment.attempts, 1);
  assert.ok(d.data.order.history.some((h) => h.status === 'delivery_failed'));
  assert.equal((await call('ops', 'GET', '/api/ops/orders?exception=1', { cookie: ship })).data.orders.some((o) => o.number === n), true);
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'rescheduled' } })).status, 422, 'reschedule needs a date');
  await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'rescheduled', rescheduleTo: '2026-10-03' } });
  await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'out_for_delivery' } });
  d = await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: 'delivered', pod: { recipient: 'Chioma (in person)', note: 'Left with customer' } } });
  assert.equal(d.data.order.status, 'delivered');
  assert.equal(d.data.order.shipment.pod.recipient, 'Chioma (in person)');
  assert.ok(d.data.order.shipment.exception.resolvedAt, 'delivering resolves the exception');
  assert.ok(d.data.timeline.length >= 8);
  const board = await call('ops', 'GET', '/api/ops/fulfilment', { cookie: ship });
  assert.equal(board.data.stats.delivered >= 1, true);
  assert.equal(board.data.stats.firstAttemptRate < 100, true);
});

test('refunds: partial refunds, approval above the threshold by a second manager, limits, idempotency; command center sees them', async () => {
  const m1 = await login('m1@cnm.test', 'manager-one-pass');
  const m2 = await login('m2@cnm.test', 'manager-two-pass');
  const owner = await login('admin@cnm.local', 'cnm-local-admin');
  assert.equal((await call('ops', 'PUT', '/api/ops/settings', { cookie: m1, body: { refundApprovalThreshold: 10000 } })).status, 403, 'only owners change the threshold');
  assert.equal((await call('ops', 'PUT', '/api/ops/settings', { cookie: owner, body: { refundApprovalThreshold: 10000 } })).data.refundApprovalThreshold, 10000);
  const n = await paidOrder([{ id: 'midnight-vanilla-room-spray', qty: 3 }]);
  const total = (await call('ops', 'GET', `/api/ops/orders/${n}`, { cookie: m1 })).data.order.totals.total;
  const small = await call('ops', 'POST', `/api/ops/orders/${n}/refunds`, { cookie: m1, body: { amount: 5000, reason: 'goodwill' }, headers: { 'idempotency-key': 'refund-small-0001' } });
  assert.equal(small.status, 201);
  assert.equal(small.data.refund.status, 'succeeded', 'below threshold: issued at once');
  const replay = await call('ops', 'POST', `/api/ops/orders/${n}/refunds`, { cookie: m1, body: { amount: 5000, reason: 'goodwill' }, headers: { 'idempotency-key': 'refund-small-0001' } });
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.refunded, 5000, 'a retried refund never pays twice');
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/refunds`, { cookie: m1, body: { amount: total, reason: 'goodwill' } })).status, 422, 'cannot exceed what is left');
  const big = await call('ops', 'POST', `/api/ops/orders/${n}/refunds`, { cookie: m1, body: { amount: 20000, reason: 'damaged' } });
  assert.equal(big.data.refund.status, 'requested');
  assert.equal(big.data.refund.needsApproval, true);
  const cc = await call('admin', 'GET', '/api/admin/command', { cookie: owner });
  assert.ok(cc.data.attention.some((x) => x.kind === 'refund_approval'), 'waiting refunds show in Needs attention');
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/refunds/${big.data.refund.id}/approve`, { cookie: m1 })).status, 403, 'requester cannot approve their own');
  const ok = await call('ops', 'POST', `/api/ops/orders/${n}/refunds/${big.data.refund.id}/approve`, { cookie: m2 });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.refunded, 25000);
  assert.ok(ok.data.order.history.some((h) => h.status === 'partially_refunded'));
  assert.equal(ok.data.order.status, 'paid', 'partial refunds keep the order status');
  const ship = await login('ship@cnm.test', 'dispatch-pass-1');
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/refunds`, { cookie: ship, body: { amount: 100, reason: 'goodwill' } })).status, 403);
  const cc2 = await call('admin', 'GET', '/api/admin/command', { cookie: owner });
  assert.ok(cc2.data.sales.refunds >= 25000, 'Command Center counts partial refunds');
});

test('returns: RMA → approve → receive → inspect (restock) → refund completes the return; limits on quantity', async () => {
  const m1 = await login('m1@cnm.test', 'manager-one-pass');
  const ship = await login('ship@cnm.test', 'dispatch-pass-1');
  const n = await paidOrder([{ id: 'petalrich-room-spray', qty: 2 }]);
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/returns`, { cookie: m1, body: { reason: 'damaged', lines: [{ id: 'petalrich-room-spray', qty: 1 }] } })).status, 422, 'not before dispatch');
  await call('ops', 'PATCH', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { courier: 'rider' } });
  for (const s of ['packed', 'handed_over', 'delivered']) await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { status: s } });
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/returns`, { cookie: m1, body: { reason: 'damaged', lines: [{ id: 'petalrich-room-spray', qty: 3 }] } })).status, 422, 'cannot return more than bought');
  const rt = await call('ops', 'POST', `/api/ops/orders/${n}/returns`, { cookie: m1, body: { kind: 'refund', reason: 'damaged', note: 'Cap cracked', lines: [{ id: 'petalrich-room-spray', qty: 1 }] }, headers: { 'idempotency-key': 'rma-create-0001' } });
  assert.equal(rt.status, 201);
  const rma = rt.data.rma;
  assert.match(rma, /^RMA-/);
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/returns`, { cookie: m1, body: { kind: 'refund', reason: 'damaged', note: 'Cap cracked', lines: [{ id: 'petalrich-room-spray', qty: 1 }] }, headers: { 'idempotency-key': 'rma-create-0001' } })).data.order.returns.length, 1, 'retry does not duplicate');
  for (const s of ['approved', 'received']) assert.equal((await call('ops', 'POST', `/api/ops/orders/${n}/returns/${rma}`, { cookie: m1, body: { status: s } })).status, 200);
  const { store } = await import('../../netlify/lib/store.mjs');
  const before = (await (await store('config')).get('inventory')).products['petalrich-room-spray'].stock;
  await call('ops', 'POST', `/api/ops/orders/${n}/returns/${rma}`, { cookie: m1, body: { status: 'inspected', restock: true, note: 'Resaleable' } });
  assert.equal((await (await store('config')).get('inventory')).products['petalrich-room-spray'].stock, before + 1, 'restocked');
  const value = (await call('ops', 'GET', `/api/ops/orders/${n}`, { cookie: m1 })).data.order.returns[0].value;
  const rf = await call('ops', 'POST', `/api/ops/orders/${n}/refunds`, { cookie: m1, body: { amount: value, reason: 'returned_items', rma } });
  assert.equal(rf.data.refund.needsApproval, value > 10000);
  let final = rf.data;
  if (rf.data.refund.status === 'requested') {
    assert.equal(rf.data.order.returns[0].status, 'inspected', 'waits for approval');
    final = (await call('ops', 'POST', `/api/ops/orders/${n}/refunds/${rf.data.refund.id}/approve`, { cookie: await login('m2@cnm.test', 'manager-two-pass') })).data;
  }
  assert.equal(final.order.returns[0].status, 'refunded', 'the refund completes the return');
});

test('manual orders (paid, unpaid → mark paid), cancellations with refund and restock', async () => {
  const m1 = await login('m1@cnm.test', 'manager-one-pass');
  const ship = await login('ship@cnm.test', 'dispatch-pass-1');
  const body = { items: [{ id: 'love-stoned-room-spray', qty: 2 }], contact: { email: 'walkin@example.com', phone: '08031112222', firstName: 'Walk', lastName: 'In' }, delivery: { method: 'store-pickup', storeSlug: 'lagos' }, paymentMode: 'paid', paymentMethod: 'pos_card', paymentReason: 'POS slip 4471', channel: 'pos' };
  assert.equal((await call('ops', 'POST', '/api/ops/orders', { cookie: ship, body })).status, 403, 'fulfilment cannot create orders');
  const a = await call('ops', 'POST', '/api/ops/orders', { cookie: m1, body, headers: { 'idempotency-key': 'manual-order-0001' } });
  assert.equal(a.status, 201);
  assert.equal(a.data.status, 'paid');
  const again = await call('ops', 'POST', '/api/ops/orders', { cookie: m1, body, headers: { 'idempotency-key': 'manual-order-0001' } });
  assert.equal(again.data.number, a.data.number, 'double-submit makes one order');
  const d = await call('ops', 'GET', `/api/ops/orders/${a.data.number}`, { cookie: m1 });
  assert.equal(d.data.order.channel, 'pos');
  assert.equal(d.data.order.placedBy, 'm1@cnm.test');
  assert.equal(d.data.order.shipment, undefined);
  const u = await call('ops', 'POST', '/api/ops/orders', { cookie: m1, body: { ...body, paymentMode: 'unpaid', paymentMethod: 'bank_transfer', channel: 'manual' } });
  assert.equal(u.data.status, 'pending_payment');
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${u.data.number}/mark-paid`, { cookie: m1, body: { method: 'bank_transfer', reason: 'x' } })).status, 422, 'needs a reference');
  const mp = await call('ops', 'POST', `/api/ops/orders/${u.data.number}/mark-paid`, { cookie: m1, body: { method: 'bank_transfer', reason: 'GTB transfer ref 99812' } });
  assert.equal(mp.data.order.status, 'paid');
  const link = await call('ops', 'POST', '/api/ops/orders', { cookie: m1, body: { ...body, paymentMode: 'link', channel: 'manual' } });
  assert.equal(link.data.paymentLink, null);
  assert.match(link.data.note, /Paystack/);
  // Cancel an unpaid order; cancel a paid one (full refund, recorded outside Paystack for a manual payment, stock back)
  assert.equal((await call('ops', 'POST', `/api/ops/orders/${link.data.number}/cancel`, { cookie: ship, body: { reason: 'Customer changed mind' } })).data.order.status, 'cancelled');
  const { store } = await import('../../netlify/lib/store.mjs');
  const stock = (await (await store('config')).get('inventory')).products['love-stoned-room-spray'].stock;
  const c = await call('ops', 'POST', `/api/ops/orders/${a.data.number}/cancel`, { cookie: m1, body: { reason: 'Wrong scent chosen' } });
  assert.equal(c.data.order.status, 'refunded');
  assert.match(c.data.refunds[0].providerRef, /^MANUAL-/);
  assert.equal((await (await store('config')).get('inventory')).products['love-stoned-room-spray'].stock, stock + 2);
});

test('courier webhook: signature, idempotency, forward jumps; staff notes, address edit; company scope', async () => {
  const ship = await login('ship@cnm.test', 'dispatch-pass-1');
  const n = await paidOrder();
  await call('ops', 'PATCH', `/api/ops/orders/${n}/shipment`, { cookie: ship, body: { courier: 'gig', trackingNumber: 'TRK-555' } });
  const post = (payload, secret = 'wh-secret') => { const raw = JSON.stringify(payload); return call('courier-webhook', 'POST', '/api/couriers/gig/webhook', { raw, headers: { 'x-cnm-signature': createHmac('sha256', secret).update(raw).digest('hex') } }); };
  assert.equal((await post({ event_id: 'e1', tracking_number: 'TRK-555', status: 'in_transit' }, 'wrong')).status, 401);
  const r = await post({ event_id: 'e1', tracking_number: 'TRK-555', status: 'in_transit', note: 'Left hub' });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'in_transit', 'courier can jump from awaiting to in transit');
  assert.equal((await post({ event_id: 'e1', tracking_number: 'TRK-555', status: 'in_transit' })).data.duplicate, true);
  assert.equal((await post({ event_id: 'e2', order_number: n, status: 'delivered', recipient: 'Gatekeeper' })).data.status, 'delivered');
  const d = await call('ops', 'GET', `/api/ops/orders/${n}`, { cookie: ship });
  assert.equal(d.data.order.status, 'delivered');
  assert.equal(d.data.order.shipment.pod.recipient, 'Gatekeeper');
  // notes + address
  const m1 = await login('m1@cnm.test', 'manager-one-pass');
  const n2 = await paidOrder();
  const note = await call('ops', 'POST', `/api/ops/orders/${n2}/notes`, { cookie: ship, body: { text: 'Customer asked for evening delivery' } });
  assert.equal(note.data.order.staffNotes[0].text, 'Customer asked for evening delivery');
  assert.equal((await call('ops', 'PATCH', `/api/ops/orders/${n2}/address`, { cookie: m1, body: { address: { line1: '9 Bourdillon Rd', city: 'Ikoyi', state: 'FCT' } } })).status, 422, 'Lagos delivery cannot go to FCT');
  const moved = await call('ops', 'PATCH', `/api/ops/orders/${n2}/address`, { cookie: m1, body: { address: { line1: '9 Bourdillon Rd', city: 'Ikoyi', state: 'Lagos' } } });
  assert.equal(moved.data.order.delivery.address.line1, '9 Bourdillon Rd');
  // Company scope: a Spectra-only manager cannot see Essentials orders
  const sp = await login('sp@cnm.test', 'spectra-pass-12');
  assert.equal((await call('ops', 'GET', `/api/ops/orders/${n2}`, { cookie: sp })).status, 404);
  assert.equal((await call('ops', 'GET', '/api/ops/orders', { cookie: sp })).data.total, 0);
  // Audit trail covers operations
  const owner = await login('admin@cnm.local', 'cnm-local-admin');
  const actions = (await call('admin', 'GET', '/api/admin/audit', { cookie: owner })).data.entries.map((x) => x.action);
  for (const a of ['shipment.status', 'refund.approve', 'return.create', 'order.manual', 'order.cancel', 'shipment.webhook', 'order.address', 'order.note']) assert.ok(actions.includes(a), a);
});

test('couriers: GIG waybill or a booked dispatch rider (name, phone, what CNM paid); delivery cost vs charge', async () => {
  const { DEFAULT_COURIERS, deliveryStats } = await import('../../netlify/lib/ops.mjs');
  assert.deepEqual(DEFAULT_COURIERS.map((c) => [c.id, c.kind]), [['gig', 'courier'], ['rider', 'rider'], ['pickup', 'pickup']]);
  const m1 = await login('m1@cnm.test', 'manager-one-pass');
  const n = await paidOrder();
  await call('ops', 'POST', `/api/ops/orders/${n}/shipment`, { cookie: m1, body: { status: 'packed' } });
  const r = await call('ops', 'PATCH', `/api/ops/orders/${n}/shipment`, { cookie: m1, body: { courier: 'rider', rider: { name: 'Tunde', phone: '08031234567' }, cost: { amount: 2500, method: 'cash' } } });
  assert.equal(r.status, 200);
  const s = r.data.order.shipment;
  assert.deepEqual(s.rider, { name: 'Tunde', phone: '08031234567' });
  assert.equal(s.cost.amount, 2500);
  assert.equal(s.cost.method, 'cash');
  assert.equal(s.cost.recordedBy, 'm1@cnm.test');
  assert.match(s.events.at(-1).note, /rider Tunde/);
  assert.equal((await call('ops', 'PATCH', `/api/ops/orders/${n}/shipment`, { cookie: m1, body: { cost: { amount: -5 } } })).status, 422, 'no negative costs');
  assert.equal((await call('ops', 'PATCH', `/api/ops/orders/${n}/shipment`, { cookie: m1, body: { cost: { amount: 100, method: 'crypto' } } })).status, 422, 'known payment methods only');
  const stats = deliveryStats([{ ...r.data.order, status: 'dispatched' }]);
  assert.equal(stats.costRecorded, 1);
  assert.equal(stats.deliveryCost, 2500);
});

test('returns policy: change of mind within 7 days, problems within 48 hours; outside needs an override with a reason', async () => {
  const { returnWindow, createReturn } = await import('../../netlify/lib/ops.mjs');
  const policy = { changeOfMindDays: 7, reportProblemHours: 48 };
  const day = 864e5;
  const t0 = Date.parse('2026-09-01T10:00:00Z');
  const order = { number: 'CNM-260901-0001', status: 'delivered', shipment: { deliveredAt: new Date(t0).toISOString() }, returns: [], lines: [{ id: 'x', name: 'Spray', qty: 2, unitPrice: 10000 }] };
  const w = returnWindow(order, policy, t0 + 3 * day);
  assert.equal(w.changeOfMindOpen, true);
  assert.equal(w.problemOpen, false, 'damage must be reported within 48 hours');
  const lines = [{ id: 'x', qty: 1 }];
  const at = (ms, fn) => { const real = Date.now; Date.now = () => ms; try { return fn(); } finally { Date.now = real; } };
  assert.equal(at(t0 + 3 * day, () => createReturn(order, { reason: 'changed_mind', lines }, 'm', policy)).outsidePolicy, undefined);
  assert.throws(() => at(t0 + 10 * day, () => createReturn(order, { reason: 'changed_mind', lines }, 'm', policy)), (e) => e.code === 'outside_policy');
  assert.throws(() => at(t0 + 10 * day, () => createReturn(order, { reason: 'changed_mind', lines, override: true }, 'm', policy)), (e) => e.code === 'outside_policy', 'override needs a reason');
  const late = at(t0 + 10 * day, () => createReturn(order, { reason: 'changed_mind', lines, override: true, note: 'Loyal customer, sealed box' }, 'm', policy));
  assert.equal(late.outsidePolicy, true);
});

test('companies: legal details for invoices are validated, never invented', async () => {
  const { validateCompany } = await import('../../netlify/lib/companies.mjs');
  assert.equal(validateCompany({ rcNumber: 'rc-1234567' }, { creating: false }).rcNumber, 'RC 1234567');
  assert.equal(validateCompany({ rcNumber: '' }, { creating: false }).rcNumber, null);
  assert.equal(validateCompany({ taxId: '12345678-0001' }, { creating: false }).taxId, '12345678-0001');
  assert.throws(() => validateCompany({ rcNumber: 'pending' }, { creating: false }));
  assert.throws(() => validateCompany({ taxId: 'abc' }, { creating: false }));
  assert.equal(validateCompany({}, { creating: false }).rcNumber, undefined, 'untouched fields stay unset');
});

test('admin sign-in: email + password → emailed code → PIN; no skipping steps, limited tries, audited', async () => {
  const post = (p, body, cookie) => call('admin', 'POST', p, { body, cookie });
  assert.equal((await post('/api/admin/login', { email: 'm1@cnm.test', password: 'wrong-password' })).status, 401);
  const a = await post('/api/admin/login', { email: 'm1@cnm.test', password: 'manager-one-pass' });
  assert.equal(a.status, 200);
  assert.equal(a.data.step, 'otp');
  assert.equal(a.data.admin, undefined, 'a password alone never signs you in');
  assert.equal((await call('admin', 'GET', '/api/admin/me', { cookie: a.cookie })).status, 401, 'the step cookie is not a session');
  assert.equal((await post('/api/admin/login/pin', { pin: TEST_PIN }, a.cookie)).status, 409, 'cannot jump to the PIN before the code');
  const bad = await post('/api/admin/login/otp', { code: a.data.devCode === '000000' ? '111111' : '000000' }, a.cookie);
  assert.equal(bad.status, 400);
  assert.match(bad.data.message, /4 attempts left/);
  const b = await post('/api/admin/login/otp', { code: a.data.devCode }, a.cookie);
  assert.equal(b.data.step, 'pin');
  assert.equal((await post('/api/admin/login/otp', { code: a.data.devCode }, a.cookie)).status, 409, 'a code works once');
  assert.equal((await post('/api/admin/login/pin', { pin: '000001' }, b.cookie)).status, 401);
  const c = await post('/api/admin/login/pin', { pin: TEST_PIN }, b.cookie);
  assert.equal(c.status, 200);
  assert.equal(c.data.admin.email, 'm1@cnm.test');
  assert.equal((await call('admin', 'GET', '/api/admin/me', { cookie: c.cookie })).status, 200, 'full access after code and PIN');
  assert.equal((await post('/api/admin/login/pin', { pin: TEST_PIN }, b.cookie)).status, 401, 'the finished sign-in cannot be replayed');
  // Five wrong PINs: start again from the password
  const a2 = await post('/api/admin/login', { email: 'm2@cnm.test', password: 'manager-two-pass' });
  const b2 = await post('/api/admin/login/otp', { code: a2.data.devCode }, a2.cookie);
  for (let i = 0; i < 4; i++) assert.equal((await post('/api/admin/login/pin', { pin: '999999' }, b2.cookie)).status, 401);
  const locked = await post('/api/admin/login/pin', { pin: '999999' }, b2.cookie);
  assert.equal(locked.data.error, 'login_expired');
  assert.equal((await post('/api/admin/login/pin', { pin: TEST_PIN }, b2.cookie)).status, 401, 'even the right PIN needs a fresh sign-in');
  const audit = await call('admin', 'GET', '/api/admin/audit', { cookie: c.cookie });
  assert.ok(audit.status === 403 || audit.data.entries.some((x) => x.action === 'login.success'));
  // Without email set up, a deployed site refuses rather than skipping the code
  process.env.CNM_LOCAL_STORE = '0';
  assert.equal((await post('/api/admin/login', { email: 'm2@cnm.test', password: 'manager-two-pass' })).data.error, 'email_not_configured');
  process.env.CNM_LOCAL_STORE = '1';
});

test('shipped admin account holds only hashes, with a PIN', async () => {
  const { BOOTSTRAP_ADMINS } = await import('../../netlify/lib/admin-accounts.mjs');
  const owner = BOOTSTRAP_ADMINS.find((u) => u.email === 'gabeth.ai4@gmail.com');
  assert.equal(owner.role, 'owner');
  assert.match(owner.passwordHash, /^scrypt\$/);
  assert.match(owner.pinHash, /^scrypt\$/);
  assert.deepEqual(Object.keys(owner).sort(), ['email', 'name', 'passwordHash', 'pinHash', 'role']);
});

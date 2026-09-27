// CNM Group OS: Command Center metrics (pure) and the companies / command / pulse admin APIs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { adminLogin, TEST_PIN } from './admin-login.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.CNM_LOCAL_STORE = '1';
process.env.CNM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'cnm-os-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_USERS = '';

const M = await import('../../netlify/lib/metrics.mjs');
let admin; let events; let leads;
before(async () => {
  admin = (await import('../../netlify/functions/admin.mjs')).default;
  events = (await import('../../netlify/functions/events.mjs')).default;
  leads = (await import('../../netlify/functions/leads.mjs')).default;
});

const NOW = Date.parse('2026-09-27T12:00:00Z');
const order = (n, { day, status = 'paid', total = 10000, subtotal = 9000, discount = 0, company = 'essentials', state = 'Lagos', channel = 'web', lines, history, refund } = {}) => ({
  number: `CNM-${n}`, status, createdAt: `${day}T10:00:00.000Z`, updatedAt: `${day}T10:00:00.000Z`, companyId: company, channel,
  totals: { subtotal, discount, delivery: total - subtotal + discount, vat: 0, total },
  lines: lines || [{ id: 'p1', name: 'Product one', qty: 1, lineTotal: subtotal }],
  delivery: { label: 'Standard', address: { line1: 'x', city: 'y', state } }, contact: { firstName: 'Ada', lastName: 'Obi' },
  history: history || [{ status: 'pending_payment', at: `${day}T10:00:00.000Z` }, ...(status !== 'pending_payment' ? [{ status: 'paid', at: `${day}T10:01:00.000Z` }] : [])],
  payment: refund ? { refund } : {},
});

test('metrics: ranges, comparison windows and Lagos day buckets', () => {
  assert.deepEqual(M.compareRange({ from: '2026-09-21', to: '2026-09-27' }), { from: '2026-09-14', to: '2026-09-20' });
  assert.deepEqual(M.compareRange({ from: '2024-02-29', to: '2024-03-01' }, 'year'), { from: '2023-02-28', to: '2023-03-01' });
  assert.equal(M.compareRange({ from: '2026-09-01', to: '2026-09-01' }, 'none'), null);
  assert.equal(M.dayKey('2026-09-26T23:30:00Z'), '2026-09-27', '23:30 UTC is already the next day in Lagos');
  assert.equal(M.dayList('2026-09-25', '2026-09-27').length, 3);
});

test('metrics: gross vs net, refunds, AOV, deltas, per-company roll-up, filters', () => {
  const orders = [
    order(1, { day: '2026-09-25', total: 20000, subtotal: 18000, discount: 1000 }),
    order(2, { day: '2026-09-26', total: 10000, subtotal: 9000, state: 'FCT', channel: 'app' }),
    order(3, { day: '2026-09-26', status: 'refunded', total: 5000, subtotal: 4500, refund: { amount: 2000, at: '2026-09-26T15:00:00Z' } }),
    order(4, { day: '2026-09-18', total: 8000, subtotal: 7000 }), // previous window
    order(5, { day: '2026-09-26', status: 'pending_payment' }),
    order(6, { day: '2026-09-24', company: 'spectra', total: 30000, subtotal: 30000 }),
  ];
  const companies = [{ id: 'essentials', name: 'CNM Essentials' }, { id: 'spectra', name: 'CNM Spectra' }];
  const eventDays = [{ date: '2026-09-26', counts: { active_user: 40, view_item: 10 }, byCompany: { essentials: { active_user: 30 }, spectra: { active_user: 10 } } }];
  const cc = M.commandCenter({ orders, companies, eventDays }, { from: '2026-09-21', to: '2026-09-27', compare: 'previous', company: 'all', location: 'all', channel: 'all', now: NOW });
  assert.equal(cc.sales.orders, 4);
  assert.equal(cc.sales.gross, 18000 + 9000 + 4500 + 30000);
  assert.equal(cc.sales.discounts, 1000);
  assert.equal(cc.sales.refunds, 2000, 'partial refund uses the refunded amount');
  assert.equal(cc.sales.net, 61500 - 1000 - 2000);
  assert.equal(cc.sales.revenue, 65000 - 2000);
  const k = Object.fromEntries(cc.kpis.map((x) => [x.key, x]));
  assert.equal(k.orders.previous, 1);
  assert.equal(k.orders.delta, 300);
  assert.equal(k.activeUsers.value, 40);
  assert.equal(k.conversion.value, 10, '4 orders / 40 active users');
  assert.equal(cc.ops.awaitingPayment, 1);
  const byId = Object.fromEntries(cc.byCompany.map((c) => [c.id, c]));
  assert.equal(byId.spectra.revenue, 30000);
  assert.equal(byId.essentials.revenue + byId.spectra.revenue, cc.sales.revenue);
  assert.equal(Math.round(byId.spectra.share + byId.essentials.share), 100);
  assert.equal(cc.series.length, 7);
  assert.equal(cc.compareSeries.length, 7);
  // Filters
  const fct = M.commandCenter({ orders, companies, eventDays }, { from: '2026-09-21', to: '2026-09-27', compare: 'none', company: 'essentials', location: 'FCT', channel: 'all', now: NOW });
  assert.equal(fct.sales.orders, 1);
  assert.equal(fct.compareSeries, null);
  const app = M.commandCenter({ orders, companies, eventDays }, { from: '2026-09-21', to: '2026-09-27', compare: 'none', company: 'all', location: 'all', channel: 'app', now: NOW });
  assert.equal(app.sales.orders, 1);
  assert.deepEqual(app.byChannel.map((c) => c.channel), ['app']);
  // Scope: a Spectra-only admin never sees Essentials numbers
  const scoped = M.commandCenter({ orders, companies, eventDays }, { from: '2026-09-21', to: '2026-09-27', compare: 'none', company: 'all', location: 'all', channel: 'all', scope: ['spectra'], now: NOW });
  assert.equal(scoped.sales.revenue, 30000);
  assert.deepEqual(scoped.byCompany.map((c) => c.id), ['spectra']);
  assert.equal(scoped.traffic.activeUsers, 10);
});

test('metrics: needs-attention list (late fulfilment, overdue delivery, stock, stale leads) ranked by severity', () => {
  const orders = [
    order(10, { day: '2026-09-24' }), // paid 3 days ago, not dispatched → late
    order(11, { day: '2026-09-27' }), // paid today → fine
    order(12, { day: '2026-09-15', status: 'dispatched', history: [{ status: 'paid', at: '2026-09-15T10:00:00Z' }, { status: 'dispatched', at: '2026-09-16T10:00:00Z' }] }),
  ];
  const products = [{ id: 'p1', name: 'Diffuser', slug: 'diffuser', stock: { quantity: 20 } }, { id: 'p2', name: 'Candle', slug: 'candle', stock: { quantity: 3 } }];
  const enquiries = [{ id: 'e1', name: 'Tolu', status: 'new', createdAt: '2026-09-25T09:00:00Z', companyId: 'cnmworx', subject: 'Proposal' }];
  const cc = M.commandCenter({ orders, products, inventory: { p1: { stock: 0 } }, enquiries, companies: [] }, { from: '2026-09-21', to: '2026-09-27', compare: 'none', company: 'all', location: 'all', channel: 'all', now: NOW });
  const kinds = cc.attention.map((a) => a.kind);
  assert.ok(kinds.includes('late_fulfilment') && kinds.includes('late_delivery') && kinds.includes('out_of_stock') && kinds.includes('low_stock') && kinds.includes('stale_lead'));
  assert.ok(!cc.attention.some((a) => a.title.startsWith('CNM-11')), 'fresh orders are not flagged');
  assert.deepEqual([...new Set(cc.attention.map((a) => a.severity))], ['high', 'medium']);
  assert.equal(cc.ops.lateFulfil, 1);
  assert.equal(cc.ops.outOfStock, 1);
  assert.equal(cc.feed[0].title.startsWith('CNM-11'), true, 'feed is newest first');
});

// ---- API ----
let ipn = 0;
const call = async (method, p, { body, cookie, headers = {} } = {}) => {
  const h = { 'content-type': 'application/json', 'x-cnm-request': '1', ...headers };
  if (cookie) h.cookie = cookie;
  const res = await admin(new Request(`http://localhost${p}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), { ip: `10.9.0.${++ipn}` });
  return { status: res.status, data: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie')?.split(';')[0] };
};

test('api: command center, pulse, companies CRUD with idempotency, archive, audit and RBAC', async () => {
  const { cookie } = await adminLogin((p, body, cookie) => call('POST', p, { body, cookie }), 'admin@cnm.local', 'cnm-local-admin');
  assert.ok(cookie);
  const me = await call('GET', '/api/admin/me', { cookie });
  assert.equal(me.data.admin.scope, null, 'owners see every company');

  const cc = await call('GET', '/api/admin/command?from=2026-09-01&to=2026-09-27&compare=year&company=all', { cookie });
  assert.equal(cc.status, 200);
  assert.equal(cc.data.range.from, '2026-09-01');
  assert.equal(cc.data.compare.from, '2025-09-01');
  assert.deepEqual(cc.data.byCompany.map((c) => c.id), ['essentials', 'spectra', 'cnmworx', 'foundation']);
  assert.equal((await call('GET', '/api/admin/command?from=2026-09-27&to=2026-09-01', { cookie })).status, 422);
  assert.equal((await call('GET', '/api/admin/command?company=nope', { cookie })).status, 404);
  assert.match((await call('GET', '/api/admin/pulse', { cookie })).data.stamp, /^\d+\.\d+\./);

  const body = { name: 'CNM Energy', kind: 'engineering', color: '#0F2C52', currency: 'NGN', paymentMethods: ['invoice', 'bank_transfer'], deliveryOptions: ['on-site-service'], domains: ['https://energy.cnmgroup.com/'], admins: ['Ops@CNMGroup.com'] };
  const key = 'create-energy-0001';
  const c1 = await call('POST', '/api/admin/companies', { cookie, body, headers: { 'idempotency-key': key } });
  assert.equal(c1.status, 201);
  assert.equal(c1.data.company.id, 'cnm-energy');
  assert.equal(c1.data.company.color, '#0f2c52');
  assert.deepEqual(c1.data.company.domains, ['energy.cnmgroup.com']);
  assert.deepEqual(c1.data.company.admins, ['ops@cnmgroup.com']);
  const c2 = await call('POST', '/api/admin/companies', { cookie, body, headers: { 'idempotency-key': key } });
  assert.equal(c2.status, 201);
  assert.equal(c2.data.replayed, true, 'a retried create returns the first result instead of creating twice');
  assert.equal((await call('POST', '/api/admin/companies', { cookie, body: { ...body, name: 'Other' }, headers: { 'idempotency-key': key } })).status, 422, 'same key, different body');
  assert.equal((await call('POST', '/api/admin/companies', { cookie, body })).status, 409, 'duplicate company');
  assert.equal((await call('POST', '/api/admin/companies', { cookie, body: { name: 'Bad', color: 'blue' } })).status, 422);
  assert.equal((await call('POST', '/api/admin/companies', { cookie, body: { name: 'Bad pay', paymentMethods: ['bitcoin'] } })).status, 422);

  const list = await call('GET', '/api/admin/companies', { cookie });
  assert.equal(list.data.companies.filter((c) => c.id === 'cnm-energy').length, 1);
  const arch = await call('PATCH', '/api/admin/companies/cnm-energy', { cookie, body: { status: 'archived' } });
  assert.equal(arch.data.company.status, 'archived');
  const after = await call('GET', '/api/admin/command', { cookie });
  assert.ok(!after.data.byCompany.some((c) => c.id === 'cnm-energy'), 'archived companies leave the Command Center table');
  const edit = await call('PATCH', '/api/admin/companies/cnm-energy', { cookie, body: { color: '#123456' } });
  assert.deepEqual(edit.data.changed, ['color']);

  const audit = await call('GET', '/api/admin/audit', { cookie });
  const actions = audit.data.entries.map((x) => x.action);
  assert.ok(actions.includes('company.create') && actions.includes('company.archive') && actions.includes('company.update'));
  const upd = audit.data.entries.find((x) => x.action === 'company.update');
  assert.deepEqual(upd.detail.before, { color: '#0f2c52' });
  assert.deepEqual(upd.detail.after, { color: '#123456' });
  assert.ok(upd.ip, 'audit records the IP');

  // RBAC: an editor can't manage companies or see the audit log
  const { hashPassword } = await import('../../netlify/lib/crypto.mjs');
  process.env.ADMIN_USERS = JSON.stringify([
    { email: 'ed@cnm.test', role: 'editor', name: 'Ed', passwordHash: await hashPassword('editor-pass-123'), pinHash: await hashPassword(TEST_PIN) },
    { email: 'sp@cnm.test', role: 'manager', name: 'Spectra lead', companies: ['spectra'], passwordHash: await hashPassword('spectra-pass-123'), pinHash: await hashPassword(TEST_PIN) },
  ]);
  const ed = await adminLogin((p, body, cookie) => call('POST', p, { body, cookie }), 'ed@cnm.test', 'editor-pass-123');
  assert.ok(ed.cookie, 'editor signs in');
  assert.equal((await call('POST', '/api/admin/companies', { cookie: ed.cookie, body: { name: 'Nope Ltd' } })).status, 403);
  assert.equal((await call('GET', '/api/admin/audit', { cookie: ed.cookie })).status, 403);
  assert.equal((await call('GET', '/api/admin/command', { cookie: ed.cookie })).status, 200);
  // A company-scoped manager only ever sees their own company
  const sp = await adminLogin((p, body, cookie) => call('POST', p, { body, cookie }), 'sp@cnm.test', 'spectra-pass-123');
  assert.deepEqual((await call('GET', '/api/admin/me', { cookie: sp.cookie })).data.admin.scope, ['spectra']);
  const spc = await call('GET', '/api/admin/command', { cookie: sp.cookie });
  assert.deepEqual(spc.data.byCompany.map((c) => c.id), ['spectra']);
  assert.equal((await call('GET', '/api/admin/command?company=essentials', { cookie: sp.cookie })).status, 403);
  assert.deepEqual((await call('GET', '/api/admin/companies', { cookie: sp.cookie })).data.companies.map((c) => c.id), ['spectra']);
  process.env.ADMIN_USERS = '';
});

test('events: counted per company and per Lagos day; enquiries carry their company', async () => {
  const send = (name, params) => events(new Request('http://localhost/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, params }) }), { ip: `10.8.0.${++ipn}` });
  await send('active_user', { company: 'spectra', path: '/spectra/' });
  await send('view_item', { path: '/cnmworx/services/' });
  const { store } = await import('../../netlify/lib/store.mjs');
  const day = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const agg = await (await store('events')).get(`daily/${day}`);
  assert.equal(agg.byCompany.spectra.active_user, 1);
  assert.equal(agg.byCompany.cnmworx.view_item, 1);
  const r = await leads(new Request('http://localhost/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cnm-request': '1' }, body: JSON.stringify({ name: 'Ngozi', email: 'n@example.com', sector: 'group', division: 'foundation', consent: true, message: 'I would like to volunteer.' }) }), { ip: '10.7.0.1' });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.equal((await (await store('leads')).get(`enquiry/${id}`)).companyId, 'foundation');
});

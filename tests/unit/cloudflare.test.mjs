// Cloudflare Pages: D1 storage (checked against real SQLite through a D1-shaped wrapper) and /api routing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

/** Minimal stand-in for a Cloudflare D1 binding: prepare(sql).bind(...).first()/run()/all(). */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => stmt(sql) };
}

test('D1 store: get/set/delete/list with prefixes that contain SQL wildcards', async () => {
  const { d1Store } = await import('../../netlify/lib/store.mjs');
  const s = d1Store('orders', fakeD1());
  assert.equal(await s.get('missing'), null);
  await s.set('order/CNM-1', { total: 100 });
  await s.set('order/CNM-2', { total: 200 });
  await s.set('order%_x', { odd: true });
  await s.set('order/CNM-1', { total: 150 });
  assert.deepEqual(await s.get('order/CNM-1'), { total: 150 }, 'upsert replaces');
  assert.deepEqual(await s.list('order/'), ['order/CNM-1', 'order/CNM-2'], '% and _ in keys are not wildcards');
  assert.deepEqual(await s.list('order%'), ['order%_x']);
  await s.delete('order/CNM-2');
  assert.deepEqual(await s.list(''), ['order%_x', 'order/CNM-1']);
});

test('Cloudflare adapter: routes /api paths to the same handlers, passes the visitor IP, uses D1', async () => {
  const cf = await import('../../netlify/lib/cloudflare.mjs');
  assert.ok(cf.matchRoute('/api/admin/login/otp'));
  assert.ok(cf.matchRoute('/api/ops/orders/CNM-1/refunds/RF-1/approve'));
  assert.equal(cf.matchRoute('/api/nope'), null);
  const saved = { ...process.env };
  try {
    delete process.env.CNM_LOCAL_STORE;
    const env = { CNM_DB: fakeD1(), SESSION_SECRET: 'cf-test-secret', ADMIN_USERS: '[]' };
    const quote = await cf.handleApi({ env, request: new Request('https://x.pages.dev/api/checkout/quote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cnm-request': '1', 'cf-connecting-ip': '203.0.113.9' }, body: JSON.stringify({ items: [{ id: 'petalrich-room-spray', qty: 2 }] }) }) });
    assert.equal(quote.status, 200);
    assert.equal((await quote.json()).lines[0].qty, 2);
    assert.equal(process.env.SESSION_SECRET, 'cf-test-secret', 'Cloudflare variables reach the handlers');
    const { storeBackend } = await import('../../netlify/lib/store.mjs');
    assert.equal(storeBackend(), 'cloudflare-d1');
    assert.equal((await cf.handleApi({ env, request: new Request('https://x.pages.dev/api/nope') })).status, 404);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    delete globalThis.__CNM_D1;
  }
});

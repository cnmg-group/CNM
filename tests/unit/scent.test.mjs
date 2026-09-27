// Scent finder: rules matcher + AI path with the model HTTP call mocked (no network, no real key).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanPreferences, eligible, familiesOf, ruleMatch } from '../../src/shared/scent-match.mjs';

const products = JSON.parse(await readFile(new URL('../../content/products.json', import.meta.url), 'utf8'));
const ids = new Set(products.map((p) => p.id));

test('cleanPreferences drops unknown values and clamps free text', () => {
  const p = cleanPreferences({ families: ['floral', 'nope'], room: 'garage', moods: ['calm', 'cosy', 'romantic', 'festive'], budget: 'x', notes: 'a\u0000b'.padEnd(400, 'z') });
  assert.deepEqual(p.families, ['floral']);
  assert.equal(p.room, 'living');
  assert.equal(p.moods.length, 3);
  assert.equal(p.budget, 'any');
  assert.equal(p.notes.length, 280);
  assert.ok(!p.notes.includes('\u0000'));
});

test('familiesOf reads only the product name', () => {
  assert.ok(familiesOf({ name: 'Midnight Vanilla Room Spray' }).includes('sweet'));
  assert.deepEqual(familiesOf({ name: 'Plain Product' }), []);
});

test('ruleMatch returns real, in-budget products with reasons', () => {
  const r = ruleMatch(products, { families: ['sweet'], room: 'bedroom', moods: ['cosy'], budget: 'u20' });
  assert.ok(r.picks.length > 0 && r.picks.length <= 4);
  for (const pick of r.picks) {
    assert.ok(ids.has(pick.id));
    const p = products.find((x) => x.id === pick.id);
    assert.ok(p.price.amount <= 20000);
    assert.ok(pick.reason.length > 10);
  }
});

test('ruleMatch prefers odour eliminators for a bathroom', () => {
  const r = ruleMatch(products, { room: 'bathroom', moods: ['clean'] });
  const top = products.find((p) => p.id === r.picks[0].id);
  if (products.some((p) => p.productType === 'Odour Eliminator')) assert.equal(top.productType, 'Odour Eliminator');
});

test('eligible excludes sold-out products', () => {
  const list = [{ id: 'a', price: { amount: 1000 }, stock: { quantity: 0 } }, { id: 'b', price: { amount: 1000 }, stock: { quantity: 3 } }];
  assert.deepEqual(eligible(list, cleanPreferences({})).map((p) => p.id), ['b']);
});

// ---------- AI path ----------
let handler;
const realFetch = globalThis.fetch;
const calls = [];
before(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = 'http://ai-gateway.test';
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    const { status = 200, body } = await handler(calls.at(-1));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
});
after(() => { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_BASE_URL; });

const message = (out, extra = {}) => ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify(out) }], ...extra });

test('recommend without a key uses the rules matcher', async () => {
  const { recommend } = await import('../../netlify/lib/ai/recommend.mjs');
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const r = await recommend(products, { families: ['floral'] });
    assert.equal(r.source, 'rules');
    assert.ok(r.picks.length);
  } finally { process.env.ANTHROPIC_API_KEY = key; }
});

test('recommend via the gateway keeps only real, eligible picks', async () => {
  const { recommend, MODEL } = await import('../../netlify/lib/ai/recommend.mjs');
  const cheap = products.filter((p) => p.price.amount <= 20000);
  const pricey = products.find((p) => p.price.amount > 20000);
  handler = () => ({ body: message({ summary: 'A cosy bedroom.', tip: 'Place it away from bedding.', picks: [
    { id: cheap[0].id, reason: 'Good fit.' }, { id: 'invented-product', reason: 'x' }, { id: cheap[0].id, reason: 'dup' }, ...(pricey ? [{ id: pricey.id, reason: 'over budget' }] : []),
  ] }) });
  const r = await recommend(products, { families: ['sweet'], room: 'bedroom', budget: 'u20' });
  assert.equal(r.source, 'ai');
  assert.deepEqual(r.picks.map((p) => p.id), [cheap[0].id]);
  const req = calls.at(-1);
  assert.match(req.url, /^http:\/\/ai-gateway\.test\/v1\/messages/);
  assert.equal(req.body.model, MODEL);
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.match(req.body.messages[0].content, /Catalogue/);
});

test('recommend falls back to rules on gateway errors and refusals', async () => {
  const { recommend } = await import('../../netlify/lib/ai/recommend.mjs');
  const err = console.error; const warn = console.warn; console.error = () => {}; console.warn = () => {};
  try {
    handler = () => ({ status: 500, body: { type: 'error', error: { type: 'api_error', message: 'boom' } } });
    assert.equal((await recommend(products, {})).source, 'rules');
    handler = () => ({ body: message({ summary: '', tip: '', picks: [] }, { stop_reason: 'refusal', content: [] }) });
    assert.equal((await recommend(products, {})).source, 'rules');
  } finally { console.error = err; console.warn = warn; }
});

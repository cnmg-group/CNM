import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeQuote } from '../../src/shared/pricing.mjs';
import { buildIndex, editDistance, search } from '../../src/shared/search.mjs';
import { applyLive, productImages, stockState } from '../../src/shared/product.mjs';
import { escapeHtml, formatMoney } from '../../src/shared/format.mjs';
import { productCardHTML } from '../../src/shared/card.mjs';
import products from '../../content/products.json' with { type: 'json' };
import commerce from '../../content/commerce.json' with { type: 'json' };

const map = new Map(products.map((p) => [p.id, p]));

test('quote: sums lines, applies promo, delivery and included VAT', () => {
  const q = computeQuote({ items: [{ id: 'refill-oil', qty: 2 }], products: map, commerce, promoCode: 'staging10', deliveryMethod: 'lagos-standard' });
  assert.equal(q.subtotal, 44000);
  assert.equal(q.discount, 4400);
  assert.equal(q.delivery, 3500);
  assert.equal(q.total, 43100);
  assert.equal(q.vat, Math.round(43100 - 43100 / 1.075));
  assert.equal(q.promo.valid, true);
});

test('quote: merges duplicate lines, caps quantity at stock and max per line', () => {
  const q = computeQuote({ items: [{ id: 'home-fragrance', qty: 2 }, { id: 'home-fragrance', qty: 5 }], products: map, commerce });
  assert.equal(q.lines[0].qty, 3); // stock is 3
  assert.equal(q.errors[0].code, 'qty_reduced');
  const q2 = computeQuote({ items: [{ id: 'refill-oil', qty: 99 }], products: map, commerce });
  assert.equal(q2.lines[0].qty, commerce.maxQtyPerLine);
});

test('quote: rejects out-of-stock, unknown ids, bad codes; ignores junk quantities', () => {
  const q = computeQuote({ items: [{ id: 'car-diffuser', qty: 1 }, { id: 'nope', qty: 1 }, { id: 'refill-oil', qty: -4 }, { id: 'body-wash', qty: 'x' }], products: map, commerce, promoCode: 'FAKE' });
  assert.equal(q.lines.length, 0);
  assert.deepEqual(q.errors.map((e) => e.code).sort(), ['not_found', 'out_of_stock']);
  assert.equal(q.promo.valid, false);
  assert.equal(q.total, 0);
});

test('quote: free delivery threshold applies after discount', () => {
  const q = computeQuote({ items: [{ id: 'smart-scent-machine', qty: 1 }], products: map, commerce, deliveryMethod: 'lagos-standard' });
  assert.equal(q.delivery, 0);
});

test('search: typo tolerance, prefix and multi-term AND', () => {
  const idx = buildIndex([
    { type: 'product', title: 'Stoneglow Reed Diffuser', text: 'Reed diffuser home fragrance' },
    { type: 'product', title: 'Smart Scent Machine', text: 'Scent machine' },
    { type: 'category', title: 'Body Care', text: 'Rituals for skin' },
  ]);
  assert.equal(search(idx, 'difuser')[0].title, 'Stoneglow Reed Diffuser');
  assert.equal(search(idx, 'scen mach')[0].title, 'Smart Scent Machine');
  assert.equal(search(idx, 'stonglow')[0].title, 'Stoneglow Reed Diffuser');
  assert.equal(search(idx, 'body diffuser').length, 0);
  assert.equal(editDistance('scnet', 'scent'), 1);
});

test('product helpers: stock states, placeholders and live overrides', () => {
  assert.equal(stockState(map.get('car-diffuser')).key, 'out');
  assert.equal(stockState(map.get('home-fragrance')).key, 'low');
  assert.equal(stockState(map.get('refill-oil')).key, 'in');
  assert.ok(productImages(map.get('refill-oil'))[0].placeholder);
  const live = applyLive(map.get('refill-oil'), { price: 1000, stock: 0 });
  assert.equal(live.price.amount, 1000);
  assert.equal(stockState(live).key, 'out');
});

test('format & card: naira formatting, escaping, demo labelling', () => {
  assert.equal(formatMoney(28000), '₦28,000');
  assert.equal(escapeHtml('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
  const html = productCardHTML(map.get('refill-oil'));
  assert.match(html, /Demo/);
  assert.match(html, /data-add="refill-oil"/);
  assert.doesNotMatch(productCardHTML(map.get('car-diffuser')), /data-add=/);
});

test('content integrity: no invented product facts in the catalogue', () => {
  for (const p of products) {
    if (p.nameStatus === 'IMPORTED_FROM_CNM') continue; // real CNM data from the importer
    for (const k of ['description', 'scentNotes', 'ingredients', 'howToUse']) assert.equal(p[k], null, `${p.id}.${k} must stay null until CNM supplies it`);
    assert.equal(p.price.demo, true);
    for (const r of p.related) assert.ok(map.has(r), `${p.id} related ${r} exists`);
  }
});

test('importer: categorises CNM product types', async () => {
  const { categorise } = await import('../../scripts/import-catalogue.mjs');
  assert.equal(categorise('Reed Diffuser Stoneglow'), 'home-fragrance');
  assert.equal(categorise('Smart Scent Machine'), 'smart-scent-machines');
  assert.equal(categorise('Refill Oil 500ml'), 'refill-oils');
  assert.equal(categorise('Shea Body Butter'), 'body-care');
  assert.equal(categorise('Car Vent Diffuser'), 'car-fragrance');
});

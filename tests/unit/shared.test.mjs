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
const MV = 'midnight-vanilla-room-spray';
const withStock = (id, quantity) => new Map([...map, [id, { ...map.get(id), stock: { ...map.get(id).stock, quantity } }]]);

test('quote: sums lines, applies promo, delivery and included VAT', () => {
  const q = computeQuote({ items: [{ id: MV, qty: 2 }], products: map, commerce, promoCode: 'staging10', deliveryMethod: 'lagos-standard' });
  assert.equal(q.subtotal, 35700);
  assert.equal(q.discount, 3570);
  assert.equal(q.delivery, 3500);
  assert.equal(q.total, 35630);
  assert.equal(q.vat, Math.round((35630 - 35630 / 1.075) * 100) / 100);
  assert.equal(q.promo.valid, true);
});

test('quote: kobo-precise prices from the live catalogue', () => {
  const q = computeQuote({ items: [{ id: 'nurses-day-off-wallflower-refill', qty: 2 }, { id: 'warm-ocean-breeze-wallflower-plug-in-refill', qty: 1 }], products: map, commerce });
  assert.equal(q.subtotal, 44666.3);
});

test('quote: merges duplicate lines, caps quantity at stock and max per line', () => {
  const q = computeQuote({ items: [{ id: MV, qty: 2 }, { id: MV, qty: 5 }], products: withStock(MV, 3), commerce });
  assert.equal(q.lines[0].qty, 3);
  assert.equal(q.errors[0].code, 'qty_reduced');
  const q2 = computeQuote({ items: [{ id: MV, qty: 99 }], products: map, commerce });
  assert.equal(q2.lines[0].qty, commerce.maxQtyPerLine);
});

test('quote: rejects out-of-stock, unknown ids, bad codes; ignores junk quantities', () => {
  const q = computeQuote({ items: [{ id: MV, qty: 1 }, { id: 'nope', qty: 1 }, { id: 'crushed-room-spray', qty: -4 }, { id: 'petalrich-room-spray', qty: 'x' }], products: withStock(MV, 0), commerce, promoCode: 'FAKE' });
  assert.equal(q.lines.length, 0);
  assert.deepEqual(q.errors.map((e) => e.code).sort(), ['not_found', 'out_of_stock']);
  assert.equal(q.promo.valid, false);
  assert.equal(q.total, 0);
});

test('quote: free delivery threshold applies after discount', () => {
  const q = computeQuote({ items: [{ id: 'wallflower-socket-gray-wallflower-plug-in', qty: 5 }], products: map, commerce, deliveryMethod: 'lagos-standard' });
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

test('product helpers: stock states, images and live overrides', () => {
  assert.equal(stockState(map.get(MV)).key, 'unknown');
  assert.equal(stockState(withStock(MV, 0).get(MV)).key, 'out');
  assert.equal(stockState(withStock(MV, 2).get(MV)).key, 'low');
  assert.equal(productImages(map.get(MV))[0].placeholder, false);
  const live = applyLive(map.get(MV), { price: 1000, stock: 0 });
  assert.equal(live.price.amount, 1000);
  assert.equal(stockState(live).key, 'out');
});

test('format & card: naira with kobo, escaping, brand and type shown', () => {
  assert.equal(formatMoney(17850), '₦17,850');
  assert.equal(formatMoney(14888.75), '₦14,888.75');
  assert.equal(escapeHtml('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
  const html = productCardHTML(map.get(MV));
  assert.match(html, /Victoria&#39;s Secret/);
  assert.match(html, /Room Spray/);
  assert.match(html, /data-add="midnight-vanilla-room-spray"/);
  assert.doesNotMatch(productCardHTML(withStock(MV, 0).get(MV)), /data-add=/);
});

test('content integrity: catalogue mirrors cnmessentials.com; nothing invented', async () => {
  const { existsSync } = await import('node:fs');
  assert.equal(products.length, 20);
  for (const p of products) {
    assert.equal(p.nameStatus, 'FROM_CNM_LIVE_SITE');
    assert.ok(p.price.amount > 0 && p.price.demo === false);
    for (const k of ['description', 'scentNotes', 'ingredients', 'howToUse']) assert.equal(p[k], null, `${p.id}.${k} must stay null until CNM supplies it`);
    assert.ok(existsSync(new URL(`../../public${p.images[0].src}`, import.meta.url)), `${p.id} image exists`);
    for (const r of p.related) assert.ok(map.has(r), `${p.id} related ${r} exists`);
  }
  assert.equal(new Set(products.map((p) => p.id)).size, products.length);
});

test('importer: categorises CNM product types', async () => {
  const { categorise } = await import('../../scripts/import-catalogue.mjs');
  assert.equal(categorise('Reed Diffuser Stoneglow'), 'home-fragrance');
  assert.equal(categorise('Smart Scent Machine'), 'smart-scent-machines');
  assert.equal(categorise('Refill Oil 500ml'), 'refill-oils');
  assert.equal(categorise('Shea Body Butter'), 'body-care');
  assert.equal(categorise('Car Vent Diffuser'), 'car-fragrance');
});

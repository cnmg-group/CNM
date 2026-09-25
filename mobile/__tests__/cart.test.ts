import { bagCount, bagReducer, clampQty, EMPTY_BAG, estimateTotals, maxQtyFor, unavailableLines } from '@/lib/cart';
import { bundledCatalogue, findProduct } from '@/lib/catalogue';
import type { Commerce } from '@/lib/types';

import commerceJson from '../src/data/commerce.json';
import { real, withStock } from './fixtures';

const commerce = commerceJson as unknown as Commerce;

describe('bagReducer', () => {
  it('adds new lines and increments existing ones', () => {
    let s = bagReducer(EMPTY_BAG, { type: 'add', id: 'midnight-vanilla-room-spray', qty: 2, max: 10 });
    s = bagReducer(s, { type: 'add', id: 'midnight-vanilla-room-spray', qty: 3, max: 10 });
    expect(s.lines).toEqual([{ id: 'midnight-vanilla-room-spray', qty: 5 }]);
  });

  it('clamps to the per-line maximum', () => {
    const s = bagReducer(EMPTY_BAG, { type: 'add', id: 'x', qty: 50, max: 10 });
    expect(s.lines[0].qty).toBe(10);
  });

  it('ignores adds when max is zero (out of stock)', () => {
    expect(bagReducer(EMPTY_BAG, { type: 'add', id: 'x', qty: 1, max: 0 })).toBe(EMPTY_BAG);
  });

  it('setQty to 0 removes the line', () => {
    const s = bagReducer({ lines: [{ id: 'a', qty: 2 }], promoCode: null }, { type: 'setQty', id: 'a', qty: 0, max: 10 });
    expect(s.lines).toEqual([]);
  });

  it('normalises promo codes', () => {
    expect(bagReducer(EMPTY_BAG, { type: 'setPromo', code: ' staging10 ' }).promoCode).toBe('STAGING10');
    expect(bagReducer(EMPTY_BAG, { type: 'setPromo', code: '' }).promoCode).toBeNull();
  });

  it('counts items', () => {
    expect(bagCount([{ id: 'a', qty: 2 }, { id: 'b', qty: 3 }])).toBe(5);
  });
});

describe('quantity limits', () => {
  it('clampQty floors and bounds', () => {
    expect(clampQty(3.7, 10)).toBe(3);
    expect(clampQty(-2, 10)).toBe(0);
    expect(clampQty(Number.NaN, 10)).toBe(1);
  });

  it('unknown stock (null) is orderable up to maxQtyPerLine', () => {
    const p = real('midnight-vanilla-room-spray');
    expect(p.stock.quantity).toBeNull();
    expect(maxQtyFor(p, commerce)).toBe(commerce.maxQtyPerLine);
  });

  it('uses the lower of maxQtyPerLine and known stock', () => {
    const cat = withStock({ 'petalrich-room-spray': 3, 'crushed-room-spray': 50, 'love-stoned-room-spray': 0 });
    expect(maxQtyFor(findProduct(cat, 'petalrich-room-spray'), commerce)).toBe(3);
    expect(maxQtyFor(findProduct(cat, 'crushed-room-spray'), commerce)).toBe(commerce.maxQtyPerLine);
    expect(maxQtyFor(findProduct(cat, 'love-stoned-room-spray'), commerce)).toBe(0);
    expect(maxQtyFor(undefined, commerce)).toBe(0);
  });

  it('available:false blocks ordering even with unknown stock', () => {
    const cat = withStock({}, { 'crushed-room-spray': false });
    expect(maxQtyFor(findProduct(cat, 'crushed-room-spray'), commerce)).toBe(0);
  });
});

describe('estimateTotals', () => {
  // Real CNM prices, including kobo.
  const lines = [
    { id: 'nurses-day-off-wallflower-refill', qty: 2 }, // ₦14,888.75
    { id: 'white-jasmine-odour-eliminator', qty: 1 }, // ₦9,621.25
  ];

  it('sums subtotal from catalogue prices to the kobo', () => {
    const t = estimateTotals(lines, bundledCatalogue, commerce);
    expect(t.subtotal).toBe(39398.75);
    expect(t.discount).toBe(0);
    expect(t.delivery).toBe(0);
  });

  it('has no float drift on repeated kobo amounts', () => {
    const t = estimateTotals([{ id: 'warm-ocean-breeze-wallflower-plug-in-refill', qty: 3 }], bundledCatalogue, commerce); // ₦14,888.80
    expect(t.subtotal).toBe(44666.4);
  });

  it('extracts VAT already included in prices (rounded to kobo)', () => {
    const t = estimateTotals(lines, bundledCatalogue, commerce);
    // 39,398.75 − 39,398.75 / 1.075 = 2,748.7500…
    expect(t.vat).toBe(2748.75);
    expect(t.total).toBe(39398.75);
  });

  it('adds VAT on top when prices exclude it', () => {
    const t = estimateTotals(lines, bundledCatalogue, { ...commerce, pricesIncludeVat: { value: false } });
    expect(t.vat).toBe(2954.91);
    expect(t.total).toBe(42353.66);
  });

  it('applies delivery fee and free-over threshold', () => {
    const lagos = commerce.deliveryMethods.find((m) => m.id === 'lagos-standard')!;
    expect(estimateTotals(lines, bundledCatalogue, commerce, lagos).delivery).toBe(lagos.fee);
    const big = [{ id: 'wallflower-socket-gray-wallflower-plug-in', qty: 5 }]; // 5 × ₦31,121.25 = ₦155,606.25
    expect(estimateTotals(big, bundledCatalogue, commerce, lagos).delivery).toBe(0);
  });

  it('ignores unknown product ids', () => {
    expect(estimateTotals([{ id: 'nope', qty: 3 }], bundledCatalogue, commerce).subtotal).toBe(0);
  });

  it('flags unavailable lines (sold out or removed), not unconfirmed ones', () => {
    const cat = withStock({ 'crushed-room-spray': 0 });
    const flagged = unavailableLines(
      [
        { id: 'crushed-room-spray', qty: 1 },
        { id: 'midnight-vanilla-room-spray', qty: 1 },
        { id: 'gone', qty: 1 },
      ],
      cat,
    ).map((l) => l.id);
    expect(flagged).toEqual(['crushed-room-spray', 'gone']);
  });
});

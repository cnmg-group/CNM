import { bagCount, bagReducer, clampQty, EMPTY_BAG, estimateTotals, maxQtyFor, unavailableLines } from '@/lib/cart';
import { bundledCatalogue, findProduct } from '@/lib/catalogue';
import type { Commerce } from '@/lib/types';

import commerceJson from '../src/data/commerce.json';

const commerce = commerceJson as unknown as Commerce;

describe('bagReducer', () => {
  it('adds new lines and increments existing ones', () => {
    let s = bagReducer(EMPTY_BAG, { type: 'add', id: 'body-wash', qty: 2, max: 10 });
    s = bagReducer(s, { type: 'add', id: 'body-wash', qty: 3, max: 10 });
    expect(s.lines).toEqual([{ id: 'body-wash', qty: 5 }]);
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

  it('uses the lower of maxQtyPerLine and stock', () => {
    const lowStock = findProduct(bundledCatalogue, 'home-fragrance')!; // stock 3
    const plenty = findProduct(bundledCatalogue, 'refill-oil')!; // stock 50
    const soldOut = findProduct(bundledCatalogue, 'car-diffuser')!; // stock 0
    expect(maxQtyFor(lowStock, commerce)).toBe(3);
    expect(maxQtyFor(plenty, commerce)).toBe(commerce.maxQtyPerLine);
    expect(maxQtyFor(soldOut, commerce)).toBe(0);
    expect(maxQtyFor(undefined, commerce)).toBe(0);
  });
});

describe('estimateTotals', () => {
  const lines = [
    { id: 'body-wash', qty: 2 }, // 14,500 each
    { id: 'body-butter', qty: 1 }, // 18,500
  ];

  it('sums subtotal from catalogue prices', () => {
    const t = estimateTotals(lines, bundledCatalogue, commerce);
    expect(t.subtotal).toBe(47500);
    expect(t.discount).toBe(0);
    expect(t.delivery).toBe(0);
  });

  it('extracts VAT already included in prices', () => {
    const t = estimateTotals(lines, bundledCatalogue, commerce);
    // 47,500 - 47,500 / 1.075 = 3,313.95 → 3,314
    expect(t.vat).toBe(3314);
    expect(t.total).toBe(47500);
  });

  it('adds VAT on top when prices exclude it', () => {
    const t = estimateTotals(lines, bundledCatalogue, { ...commerce, pricesIncludeVat: { value: false } });
    expect(t.vat).toBe(Math.round(47500 * 0.075));
    expect(t.total).toBe(47500 + Math.round(47500 * 0.075));
  });

  it('applies delivery fee and free-over threshold', () => {
    const lagos = commerce.deliveryMethods.find((m) => m.id === 'lagos-standard')!;
    expect(estimateTotals(lines, bundledCatalogue, commerce, lagos).delivery).toBe(3500);
    const big = [{ id: 'smart-scent-machine', qty: 1 }]; // 185,000 > 150,000
    expect(estimateTotals(big, bundledCatalogue, commerce, lagos).delivery).toBe(0);
  });

  it('ignores unknown product ids', () => {
    expect(estimateTotals([{ id: 'nope', qty: 3 }], bundledCatalogue, commerce).subtotal).toBe(0);
  });

  it('flags unavailable lines', () => {
    expect(unavailableLines([{ id: 'car-diffuser', qty: 1 }, { id: 'body-wash', qty: 1 }, { id: 'gone', qty: 1 }], bundledCatalogue).map((l) => l.id)).toEqual([
      'car-diffuser',
      'gone',
    ]);
  });
});

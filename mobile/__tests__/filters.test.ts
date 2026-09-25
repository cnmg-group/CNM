import { bundledCatalogue } from '@/lib/catalogue';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, priceBands, sortProducts } from '@/lib/filters';

const all = bundledCatalogue.products;
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

describe('filters', () => {
  it('returns everything with no filters', () => {
    expect(applyFilters(all, EMPTY_FILTERS, 'featured')).toHaveLength(all.length);
  });

  it('filters by category', () => {
    const r = applyFilters(all, { ...EMPTY_FILTERS, categories: ['body-care'] }, 'featured');
    expect(ids(r).sort()).toEqual(['body-butter', 'body-wash']);
  });

  it('filters by collection', () => {
    expect(ids(applyFilters(all, { ...EMPTY_FILTERS, collections: ['stoneglow'] }, 'featured'))).toEqual(['stoneglow-reed-diffuser']);
  });

  it('filters by price range (inclusive)', () => {
    const r = applyFilters(all, { ...EMPTY_FILTERS, minPrice: 18500, maxPrice: 28000 }, 'price-asc');
    expect(r.every((p) => p.price.amount >= 18500 && p.price.amount <= 28000)).toBe(true);
    expect(ids(r)).toContain('body-butter');
  });

  it('filters availability, new and best sellers', () => {
    expect(ids(applyFilters(all, { ...EMPTY_FILTERS, inStockOnly: true }, 'featured'))).not.toContain('car-diffuser');
    expect(applyFilters(all, { ...EMPTY_FILTERS, newOnly: true }, 'featured').every((p) => p.isNew)).toBe(true);
    expect(ids(applyFilters(all, { ...EMPTY_FILTERS, bestSellersOnly: true }, 'featured')).sort()).toEqual(['refill-oil', 'stoneglow-reed-diffuser']);
  });

  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, categories: ['a', 'b'], minPrice: 1, newOnly: true })).toBe(4);
  });
});

describe('sorting', () => {
  it('sorts by price both ways', () => {
    const asc = sortProducts(all, 'price-asc').map((p) => p.price.amount);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortProducts(all, 'price-desc').map((p) => p.price.amount);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('featured keeps merchandising order but sinks out-of-stock', () => {
    const r = sortProducts(all, 'featured');
    expect(r[r.length - 1].id).toBe('car-diffuser');
    expect(r[0].id).toBe(all[0].id);
  });

  it('newest puts new items first', () => {
    const r = sortProducts(all, 'newest');
    expect(r[0].isNew).toBe(true);
  });

  it('does not mutate the input', () => {
    const before = ids(all);
    sortProducts(all, 'name');
    expect(ids(all)).toEqual(before);
  });
});

describe('price bands', () => {
  it('derives contiguous bands covering the catalogue range', () => {
    const bands = priceBands(all);
    expect(bands.length).toBeGreaterThan(1);
    expect(bands[0].min).toBeNull();
    expect(bands[bands.length - 1].max).toBeNull();
    for (const p of all) {
      const hits = bands.filter((b) => (b.min == null || p.price.amount >= b.min) && (b.max == null || p.price.amount <= b.max));
      expect(hits.length).toBeGreaterThanOrEqual(1);
    }
  });
});

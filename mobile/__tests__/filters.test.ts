import { brands, bundledCatalogue, categoryProductCount, visibleCategories } from '@/lib/catalogue';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, priceBands, sortProducts } from '@/lib/filters';

import { withStock } from './fixtures';

const all = bundledCatalogue.products;
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

describe('filters', () => {
  it('returns everything with no filters', () => {
    expect(applyFilters(all, EMPTY_FILTERS, 'featured')).toHaveLength(all.length);
  });

  it('filters by category', () => {
    const r = applyFilters(all, { ...EMPTY_FILTERS, categories: ['diffusers-refills'] }, 'featured');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.category === 'diffusers-refills')).toBe(true);
    expect(ids(r)).toContain('wallflower-socket-gray-wallflower-plug-in');
  });

  it('filters by brand', () => {
    const r = applyFilters(all, { ...EMPTY_FILTERS, brands: ['Febreze'] }, 'featured');
    expect(ids(r)).toEqual(['white-jasmine-odour-eliminator', 'sugarplum-delight-odour-eliminator']);
  });

  it('combines brand and category', () => {
    const r = applyFilters(all, { ...EMPTY_FILTERS, brands: ["Victoria's Secret"], categories: ['diffusers-refills'] }, 'featured');
    expect(r).toEqual([]);
  });

  it('filters by price range (inclusive, kobo-aware)', () => {
    const r = applyFilters(all, { ...EMPTY_FILTERS, minPrice: 9621.25, maxPrice: 14888.75 }, 'price-asc');
    expect(r.every((p) => p.price.amount >= 9621.25 && p.price.amount <= 14888.75)).toBe(true);
    expect(ids(r)).toContain('nurses-day-off-wallflower-refill');
    expect(ids(r)).not.toContain('warm-ocean-breeze-wallflower-plug-in-refill'); // ₦14,888.80
  });

  it('"available to order" keeps unconfirmed stock and drops sold-out items', () => {
    const cat = withStock({ 'crushed-room-spray': 0 });
    const r = ids(applyFilters(cat.products, { ...EMPTY_FILTERS, inStockOnly: true }, 'featured'));
    expect(r).not.toContain('crushed-room-spray');
    expect(r).toContain('midnight-vanilla-room-spray');
    expect(r).toHaveLength(all.length - 1);
  });

  it('new / best-seller flags filter (none set in live data)', () => {
    expect(applyFilters(all, { ...EMPTY_FILTERS, newOnly: true }, 'featured')).toEqual([]);
    expect(applyFilters(all, { ...EMPTY_FILTERS, bestSellersOnly: true }, 'featured')).toEqual([]);
  });

  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, categories: ['a', 'b'], brands: ['x'], minPrice: 1, newOnly: true })).toBe(5);
  });
});

describe('categories and brands', () => {
  it('hides empty categories unless showWhenEmpty', () => {
    const slugs = visibleCategories(bundledCatalogue).map((c) => c.slug);
    expect(slugs).toEqual(['room-home-fragrance', 'diffusers-refills', 'body-care', 'hair-care']);
    expect(categoryProductCount(bundledCatalogue, 'hair-care')).toBe(0);
  });

  it('lists distinct brands', () => {
    expect(brands(bundledCatalogue).sort()).toEqual(['Bath & Body Works', 'Febreze', "Victoria's Secret"]);
  });
});

describe('sorting', () => {
  it('sorts by price both ways', () => {
    const asc = sortProducts(all, 'price-asc').map((p) => p.price.amount);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortProducts(all, 'price-desc').map((p) => p.price.amount);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('featured follows CNM source order and sinks sold-out items', () => {
    expect(sortProducts(all, 'featured')[0].id).toBe('midnight-vanilla-room-spray');
    const cat = withStock({ 'midnight-vanilla-room-spray': 0 });
    const r = sortProducts(cat.products, 'featured');
    expect(r[r.length - 1].id).toBe('midnight-vanilla-room-spray');
  });

  it('sorts by name', () => {
    const names = sortProducts(all, 'name').map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('does not mutate the input', () => {
    const before = ids(all);
    sortProducts(all, 'price-desc');
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

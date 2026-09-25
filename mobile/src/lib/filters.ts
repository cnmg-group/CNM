import { stockState } from './catalogue';
import { formatNaira } from './format';
import type { Product } from './types';

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'New in' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'name', label: 'Name A–Z' },
];

export interface Filters {
  categories: string[];
  brands: string[];
  collections: string[];
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
  newOnly: boolean;
  bestSellersOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  categories: [],
  brands: [],
  collections: [],
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
  newOnly: false,
  bestSellersOnly: false,
};

export function activeFilterCount(f: Filters): number {
  return (
    f.categories.length +
    f.brands.length +
    f.collections.length +
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.inStockOnly ? 1 : 0) +
    (f.newOnly ? 1 : 0) +
    (f.bestSellersOnly ? 1 : 0)
  );
}

export function matchesFilters(p: Product, f: Filters): boolean {
  if (f.categories.length && !f.categories.includes(p.category)) return false;
  if (f.brands.length && !f.brands.includes(p.brand)) return false;
  if (f.collections.length && !p.collections.some((c) => f.collections.includes(c))) return false;
  if (f.minPrice != null && p.price.amount < f.minPrice) return false;
  if (f.maxPrice != null && p.price.amount > f.maxPrice) return false;
  // "Available" includes unconfirmed stock — those items are orderable.
  if (f.inStockOnly && stockState(p) === 'out_of_stock') return false;
  if (f.newOnly && !p.isNew) return false;
  if (f.bestSellersOnly && !p.isBestSeller) return false;
  return true;
}

/**
 * Featured order: keeps the catalogue order (CNM's merchandising order) but
 * sinks out-of-stock items to the end.
 */
export function sortProducts(products: Product[], sort: SortKey): Product[] {
  // Featured = CNM's own order (sourceOrder from the live site), else file order.
  const indexed = products.map((p, i) => ({ p, i: p.sourceOrder ?? i }));
  const oos = (p: Product) => (stockState(p) === 'out_of_stock' ? 1 : 0);
  indexed.sort((a, b) => {
    switch (sort) {
      case 'newest':
        return Number(b.p.isNew) - Number(a.p.isNew) || a.i - b.i;
      case 'price-asc':
        return a.p.price.amount - b.p.price.amount || a.i - b.i;
      case 'price-desc':
        return b.p.price.amount - a.p.price.amount || a.i - b.i;
      case 'name':
        return a.p.name.localeCompare(b.p.name);
      case 'featured':
      default:
        return oos(a.p) - oos(b.p) || a.i - b.i;
    }
  });
  return indexed.map((x) => x.p);
}

export function applyFilters(products: Product[], filters: Filters, sort: SortKey): Product[] {
  return sortProducts(
    products.filter((p) => matchesFilters(p, filters)),
    sort,
  );
}

/** Price bands derived from the actual catalogue range (never hard-coded). */
export function priceBounds(products: Product[]): { min: number; max: number } {
  if (!products.length) return { min: 0, max: 0 };
  const prices = products.map((p) => p.price.amount);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function priceBands(products: Product[]): { label: string; min: number | null; max: number | null }[] {
  const { min, max } = priceBounds(products);
  if (max <= 0 || min === max) return [];
  const step = niceStep((max - min) / 3);
  const bands: { label: string; min: number | null; max: number | null }[] = [];
  let lo = Math.floor(min / step) * step;
  while (lo < max) {
    const hi = lo + step;
    const bandMin = lo <= 0 ? null : lo;
    const bandMax = hi >= max ? null : hi;
    const label =
      bandMin == null && bandMax != null
        ? `Under ${formatNaira(bandMax)}`
        : bandMax == null
          ? `${formatNaira(bandMin ?? 0)} and above`
          : `${formatNaira(bandMin)} – ${formatNaira(bandMax)}`;
    bands.push({ label, min: bandMin, max: bandMax });
    lo = hi;
  }
  return bands;
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

import type { Catalogue, Category, Collection, LiveCatalogue, Product, ProductImage } from './types';

import bundledProducts from '../data/products.json';
import bundledCategories from '../data/categories.json';
import bundledCollections from '../data/collections.json';

/** Offline fallback shipped inside the binary (see scripts/sync-content.mjs). */
export const bundledCatalogue: Catalogue = {
  currency: 'NGN',
  products: bundledProducts as unknown as Product[],
  categories: bundledCategories as Category[],
  collections: bundledCollections as Collection[],
};

/** Normalise images to `{ src, alt }`, dropping placeholders so the UI renders its own tile. */
export function productImages(product: Product): ProductImage[] {
  return (product.images ?? [])
    .map((img) => (typeof img === 'string' ? { src: img, alt: product.name } : img))
    .filter((img): img is ProductImage => !!img && !!img.src && !img.placeholder);
}

/** Resolve a possibly-relative image path against the API base. */
export function absoluteUrl(base: string, src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return `${base.replace(/\/$/, '')}/${src.replace(/^\//, '')}`;
}

/** Merge `/api/catalogue/live` overrides over the static catalogue. Never mutates input. */
export function mergeLive(catalogue: Catalogue, live: LiveCatalogue | null | undefined): Catalogue {
  if (!live || !live.products) return catalogue;
  return {
    ...catalogue,
    products: catalogue.products.map((p) => {
      const o = live.products[p.id];
      if (!o) return p;
      return {
        ...p,
        price: {
          ...p.price,
          amount: typeof o.price === 'number' ? o.price : p.price.amount,
          compareAt: o.compareAt !== undefined ? o.compareAt : p.price.compareAt,
        },
        stock: { ...p.stock, quantity: typeof o.stock === 'number' ? o.stock : p.stock.quantity },
        available: typeof o.available === 'boolean' ? o.available : p.available,
      };
    }),
  };
}

/** Basic structural validation so a malformed remote file falls back to the bundle. */
export function isCatalogue(value: unknown): value is Catalogue {
  const v = value as Catalogue;
  return !!v && Array.isArray(v.products) && Array.isArray(v.categories) && v.products.every((p) => p && typeof p.id === 'string' && p.price && typeof p.price.amount === 'number');
}

export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock';
export const LOW_STOCK_THRESHOLD = 5;

export function stockState(product: Product): StockState {
  if (product.available === false || product.stock.quantity <= 0) return 'out_of_stock';
  if (product.stock.quantity <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

export function isPurchasable(product: Product): boolean {
  return stockState(product) !== 'out_of_stock';
}

export function findProduct(catalogue: Catalogue, idOrSlug: string): Product | undefined {
  return catalogue.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

export function categoryName(catalogue: Catalogue, slug: string): string {
  return catalogue.categories.find((c) => c.slug === slug)?.name ?? slug;
}

export function sortedCategories(catalogue: Catalogue): Category[] {
  return [...catalogue.categories].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** product.related may list ids that aren't products (content data); keep only real ones. */
export function relatedProducts(catalogue: Catalogue, product: Product): Product[] {
  return product.related
    .map((id) => findProduct(catalogue, id))
    .filter((p): p is Product => !!p && p.id !== product.id);
}

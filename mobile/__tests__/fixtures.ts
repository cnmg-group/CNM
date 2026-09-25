import { bundledCatalogue, findProduct } from '@/lib/catalogue';
import type { Catalogue, Product } from '@/lib/types';

/** Real bundled product by id (fails loudly if content changes under the tests). */
export function real(id: string): Product {
  const p = findProduct(bundledCatalogue, id);
  if (!p) throw new Error(`fixture product ${id} missing from src/data/products.json`);
  return p;
}

/** A catalogue with a few controlled stock states layered over real products. */
export function withStock(overrides: Record<string, number | null>, available: Record<string, boolean> = {}): Catalogue {
  return {
    ...bundledCatalogue,
    products: bundledCatalogue.products.map((p) =>
      p.id in overrides || p.id in available
        ? { ...p, stock: { ...p.stock, quantity: p.id in overrides ? overrides[p.id] : p.stock.quantity }, available: available[p.id] ?? p.available }
        : p,
    ),
  };
}

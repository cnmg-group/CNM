// Server-side catalogue: repository content + live admin overrides. Used to price every order.
import products from '../../content/products.json' with { type: 'json' };
import commerceBase from '../../content/commerce.json' with { type: 'json' };
import stores from '../../content/stores.json' with { type: 'json' };
import { applyLive } from '../../src/shared/product.mjs';
import { store } from './store.mjs';

export { stores };

export async function liveOverrides() {
  const s = await store('config');
  return (await s.get('inventory'))?.products || {};
}

export async function productsMap() {
  const live = await liveOverrides();
  return new Map(products.map((p) => [p.id, applyLive(p, live[p.id])]));
}

export async function commerce() {
  const s = await store('config');
  const discounts = await s.get('discounts');
  return { ...commerceBase, discounts: discounts?.discounts ?? commerceBase.discounts };
}

export const baseProducts = products;

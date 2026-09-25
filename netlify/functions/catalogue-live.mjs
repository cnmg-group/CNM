// GET /api/catalogue/live — live price/stock overrides managed in Admin.
import { handler, json } from '../lib/http.mjs';
import { liveOverrides } from '../lib/catalogue.mjs';

export default handler(async () => {
  const live = await liveOverrides();
  const products = {};
  for (const [id, o] of Object.entries(live)) products[id] = { price: o.price, compareAt: o.compareAt, stock: o.stock, available: o.available };
  return json({ products }, 200, { 'Cache-Control': 'public, max-age=30' });
});

export const config = { path: '/api/catalogue/live' };

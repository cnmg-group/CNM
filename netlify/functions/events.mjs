// POST /api/events — first-party, cookie-less analytics beacon. Aggregates daily counts only (no personal data).
import { clientIp, handler, json, readJson } from '../lib/http.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';
import { store } from '../lib/store.mjs';

const ALLOWED = new Set(['view_item_list', 'select_item', 'view_item', 'add_to_wishlist', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'payment_failed', 'search', 'filter_products', 'sign_up', 'login', 'generate_lead', 'store_directions', 'share', 'back_in_stock_signup', 'group_division']);

export default handler(async (req, context) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  try { await rateLimit('events', clientIp(req, context)); } catch { return json({ ok: false }, 429); }
  const { name, params = {} } = await readJson(req, 8 * 1024);
  if (!ALLOWED.has(name)) return json({ ok: false }, 202);
  const day = new Date().toISOString().slice(0, 10);
  const s = await store('events');
  const agg = (await s.get(`daily/${day}`)) || { counts: {}, searches: {}, zeroSearches: {}, pages: {}, revenue: 0 };
  agg.counts[name] = (agg.counts[name] || 0) + 1;
  if (name === 'search' && typeof params.search_term === 'string') {
    const term = params.search_term.toLowerCase().slice(0, 60);
    agg.searches[term] = (agg.searches[term] || 0) + 1;
    if (params.results === 0) agg.zeroSearches[term] = (agg.zeroSearches[term] || 0) + 1;
  }
  if (name === 'view_item' && typeof params.path === 'string') agg.pages[params.path.slice(0, 120)] = (agg.pages[params.path.slice(0, 120)] || 0) + 1;
  await s.set(`daily/${day}`, agg);
  return json({ ok: true }, 202);
});

export const config = { path: '/api/events' };

// GET /api/orders/:number?token= — guest order lookup (confirmation & tracking links).
import { safeEqual } from '../lib/crypto.mjs';
import { fail, handler, json, segments } from '../lib/http.mjs';
import { getOrder, publicOrder } from '../lib/orders.mjs';

export default handler(async (req) => {
  const number = decodeURIComponent(segments(req)[2] || '');
  const token = new URL(req.url).searchParams.get('token') || '';
  const order = await getOrder(number);
  if (!order || !safeEqual(order.accessToken, token)) fail(404, 'not_found', 'Order not found. Please check your confirmation link.');
  return json({ order: publicOrder(order) });
});

export const config = { path: '/api/orders/:number' };

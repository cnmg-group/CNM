// POST /api/couriers/:courier/webhook — delivery status updates pushed by a courier (spec §8).
// Security: body must be signed: X-CNM-Signature = hex HMAC-SHA256(raw body, COURIER_WEBHOOK_SECRET_<COURIER>).
// Idempotent: each event carries an id; repeats are acknowledged without applying twice.
// Payload (couriers map their own statuses to ours in a small adapter when their API is connected):
//   { "event_id": "…", "order_number": "CNM-…" | "tracking_number": "…", "status": "in_transit|out_for_delivery|delivered|failed_attempt|…",
//     "at": "ISO time", "note": "…", "recipient": "…", "eta": "YYYY-MM-DD" }
import { createHmac } from 'node:crypto';
import { safeEqual } from '../lib/crypto.mjs';
import { statusEmail, sendEmail } from '../lib/email.mjs';
import { fail, handler, json, segments } from '../lib/http.mjs';
import { getOrder, listOrders, saveOrder } from '../lib/orders.mjs';
import * as OPS from '../lib/ops.mjs';
import { store } from '../lib/store.mjs';

const siteUrl = (req) => (process.env.CONTEXT === 'production' && process.env.URL) || new URL(req.url).origin;

export default handler(async (req) => {
  if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
  const courierId = String(segments(req)[2] || '').toLowerCase();
  const couriers = await OPS.listCouriers();
  if (!couriers.some((c) => c.id === courierId)) fail(404, 'not_found', 'Unknown courier.');
  const secret = process.env[`COURIER_WEBHOOK_SECRET_${courierId.toUpperCase().replace(/-/g, '_')}`];
  if (!secret) fail(503, 'not_configured', 'Webhook secret not configured for this courier.');
  const raw = await req.text();
  if (raw.length > 64 * 1024) fail(413, 'too_large', 'Payload too large.');
  const sig = req.headers.get('x-cnm-signature') || '';
  if (!safeEqual(sig, createHmac('sha256', secret).update(raw).digest('hex'))) fail(401, 'bad_signature', 'Invalid signature.');
  let e;
  try { e = JSON.parse(raw); } catch { fail(400, 'invalid', 'Body must be JSON.'); }
  if (!e.event_id || !OPS.SHIP_STATUSES.includes(e.status)) fail(422, 'invalid', 'event_id and a known status are required.');

  let order = e.order_number ? await getOrder(String(e.order_number)) : null;
  if (!order && e.tracking_number) order = (await listOrders()).find((o) => o.shipment?.trackingNumber === String(e.tracking_number) && o.shipment?.courier === courierId) || null;
  if (!order) fail(404, 'not_found', 'No order for that order or tracking number.');
  OPS.ensureShipment(order);
  if (order.shipment.courier && order.shipment.courier !== courierId) fail(409, 'wrong_courier', 'This order is assigned to another courier.');
  if (!order.shipment.courier) order.shipment.courier = courierId;
  if (e.eta && /^\d{4}-\d{2}-\d{2}$/.test(e.eta)) order.shipment.eta = e.eta;

  const before = order.status;
  const at = e.at && !Number.isNaN(Date.parse(e.at)) ? new Date(e.at).toISOString() : undefined;
  const r = OPS.applyShipmentStatus(order, { status: e.status, note: String(e.note || '').slice(0, 300), at, source: `courier:${courierId}`, by: `courier:${courierId}`, eventId: String(e.event_id).slice(0, 100), pod: { recipient: e.recipient }, rescheduleTo: e.eta });
  if (r.duplicate) return json({ ok: true, duplicate: true });
  await saveOrder(order);
  if (before !== order.status && ['dispatched', 'delivered', 'returned'].includes(order.status)) await sendEmail(statusEmail(order, siteUrl(req)));
  await (await store('audit')).set(`${new Date().toISOString()}-wh${String(e.event_id).slice(0, 12)}`, { admin: `courier:${courierId}`, role: 'integration', action: 'shipment.webhook', detail: { number: order.number, status: e.status, eventId: e.event_id } });
  return json({ ok: true, order: order.number, status: order.shipment.status });
});

export const config = { path: '/api/couriers/:courier/webhook' };

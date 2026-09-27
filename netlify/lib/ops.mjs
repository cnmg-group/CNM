// Operations (spec §7–9): orders search, shipments & couriers, delivery exceptions, refunds with approvals, returns.
// Everything lives on the order document (shipment, refunds[], returns[], staffNotes[]) so one read gives the whole
// story and one write is atomic per order. Pure helpers here; the HTTP layer is netlify/functions/ops.mjs.
import { stores } from './catalogue.mjs';
import { randomToken } from './crypto.mjs';
import { fail } from './http.mjs';
import { setStatus } from './orders.mjs';
import { store } from './store.mjs';
import * as v from './validate.mjs';

const now = () => new Date().toISOString();
const r2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ couriers (configurable, no invented URLs) */
// CNM adds the couriers it actually uses (name + optional tracking-link template with {tracking}).
export const DEFAULT_COURIERS = [
  { id: 'in-house', name: 'CNM delivery riders', trackingUrl: null, active: true },
  { id: 'pickup', name: 'Collected in store', trackingUrl: null, active: true },
];
export async function listCouriers() {
  const doc = await (await store('config')).get('couriers');
  return doc?.couriers?.length ? doc.couriers : DEFAULT_COURIERS;
}
export async function saveCouriers(list) {
  if (!Array.isArray(list) || !list.length || list.length > 30) fail(422, 'invalid', 'Provide between 1 and 30 couriers.');
  const out = list.map((c) => {
    const name = v.str(c.name, { name: 'Courier name', max: 60 });
    const id = String(c.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    const t = c.trackingUrl ? String(c.trackingUrl).trim() : '';
    if (t && !(/^https:\/\/[^\s"'<>]+$/.test(t) && t.includes('{tracking}'))) fail(422, 'invalid', `Tracking link for ${name} must be an https URL containing {tracking}.`);
    return { id, name, trackingUrl: t || null, active: c.active !== false };
  });
  if (new Set(out.map((c) => c.id)).size !== out.length) fail(422, 'invalid', 'Courier names must be unique.');
  await (await store('config')).set('couriers', { couriers: out });
  return out;
}
export const trackingLink = (courier, number) => (courier?.trackingUrl && number ? courier.trackingUrl.replace('{tracking}', encodeURIComponent(number)) : null);

/* ------------------------------------------------------------------ shipments */
export const SHIP_STATUSES = ['awaiting_fulfilment', 'packed', 'ready_for_pickup', 'handed_over', 'in_transit', 'out_for_delivery', 'failed_attempt', 'rescheduled', 'delivered', 'returned_to_sender', 'lost'];
export const SHIP_LABEL = {
  awaiting_fulfilment: 'Awaiting fulfilment', packed: 'Packed', ready_for_pickup: 'Ready for collection', handed_over: 'Handed to courier', in_transit: 'In transit',
  out_for_delivery: 'Out for delivery', failed_attempt: 'Delivery attempt failed', rescheduled: 'Rescheduled', delivered: 'Delivered', returned_to_sender: 'Returned to sender', lost: 'Lost in transit',
};
const SHIP_NEXT = {
  awaiting_fulfilment: ['packed'],
  packed: ['handed_over', 'ready_for_pickup'],
  ready_for_pickup: ['delivered'],
  handed_over: ['in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'lost'],
  in_transit: ['out_for_delivery', 'delivered', 'failed_attempt', 'returned_to_sender', 'lost'],
  out_for_delivery: ['delivered', 'failed_attempt'],
  failed_attempt: ['rescheduled', 'out_for_delivery', 'returned_to_sender'],
  rescheduled: ['out_for_delivery', 'in_transit', 'delivered', 'failed_attempt'],
  delivered: [], returned_to_sender: [], lost: [],
};
export const shipNext = (s) => SHIP_NEXT[s] || [];
const FULFILLABLE = ['paid', 'processing', 'dispatched'];
const EXCEPTION_ON = { failed_attempt: 'failed_attempt', returned_to_sender: 'returned_to_sender', lost: 'lost' };
export const EXCEPTION_KINDS = ['failed_attempt', 'address_issue', 'damaged', 'delayed', 'lost', 'returned_to_sender', 'customer_unreachable', 'other'];

export function ensureShipment(order) {
  if (!order.shipment) {
    const pickup = order.delivery?.method === 'store-pickup' || !!order.delivery?.storeSlug;
    order.shipment = { id: `SHP-${order.number.slice(4)}`, courier: pickup ? 'pickup' : null, trackingNumber: null, status: 'awaiting_fulfilment', eta: null, promisedBy: null, attempts: 0, events: [], exception: null, pod: null };
  }
  return order.shipment;
}

/** Courier / tracking / dates. Allowed until delivered. */
export function updateShipmentDetails(order, b, couriers, by) {
  const s = ensureShipment(order);
  if (['delivered', 'returned_to_sender', 'lost'].includes(s.status)) fail(422, 'closed', 'This shipment is closed.');
  if (b.courier != null) { if (!couriers.some((c) => c.id === b.courier)) fail(422, 'invalid', 'Unknown courier.'); s.courier = b.courier; }
  if (b.trackingNumber != null) s.trackingNumber = v.str(b.trackingNumber, { name: 'Tracking number', max: 60, required: false }) || null;
  const day = (x, name) => (x === '' || x == null ? null : /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : fail(422, 'invalid', `${name} must be a date.`));
  if ('eta' in b) s.eta = day(b.eta, 'Estimated delivery');
  if ('promisedBy' in b) s.promisedBy = day(b.promisedBy, 'Promised-by date');
  s.events.push({ status: 'details_updated', at: now(), by, source: 'admin', note: [s.courier && `courier ${s.courier}`, s.trackingNumber && `tracking ${s.trackingNumber}`, s.eta && `ETA ${s.eta}`].filter(Boolean).join(' · ') });
  return s;
}

/**
 * Move a shipment forward and keep the order status in step:
 * packed/ready → processing, handed over/in transit → dispatched, delivered → delivered, returned to sender → returned.
 * Failed attempts, returns and losses open a delivery exception automatically.
 */
export function applyShipmentStatus(order, { status, note = '', at, source = 'admin', by, pod, rescheduleTo, eventId } = {}) {
  const s = ensureShipment(order);
  if (!FULFILLABLE.includes(order.status) && !(order.status === 'delivered' && status === 'delivered')) fail(422, 'transition', `Orders that are ${order.status.replace(/_/g, ' ')} can't be fulfilled.`);
  if (eventId && s.events.some((e) => e.eventId === eventId)) return { duplicate: true, shipment: s }; // courier retries
  const RANK = ['awaiting_fulfilment', 'packed', 'ready_for_pickup', 'handed_over', 'in_transit', 'out_for_delivery', 'failed_attempt', 'rescheduled', 'delivered'];
  const forwardSkip = String(source).startsWith('courier:') && RANK.indexOf(status) > RANK.indexOf(s.status) && !['delivered', 'returned_to_sender', 'lost'].includes(s.status);
  if (!shipNext(s.status).includes(status) && !forwardSkip) fail(422, 'transition', `A shipment can't go from ${SHIP_LABEL[s.status]} to ${SHIP_LABEL[status] || status}.`);
  if (['handed_over', 'in_transit'].includes(status) && s.courier !== 'pickup' && !s.courier) fail(422, 'invalid', 'Choose the courier before handing over.');
  const t = at || now();
  const evt = { status, at: t, by, source, note: v.str(note, { name: 'Note', max: 300, required: false }) || '', ...(eventId ? { eventId } : {}) };
  s.status = status;
  if (status === 'failed_attempt') s.attempts += 1;
  if (status === 'rescheduled') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rescheduleTo || '')) fail(422, 'invalid', 'Choose the new delivery date.');
    s.eta = rescheduleTo; evt.note = `${evt.note ? `${evt.note} · ` : ''}new date ${rescheduleTo}`;
  }
  if (status === 'delivered') {
    s.deliveredAt = t;
    s.pod = { recipient: v.str(pod?.recipient, { name: 'Received by', max: 80, required: false }) || null, note: v.str(pod?.note, { name: 'Delivery note', max: 300, required: false }) || null,
      photoUrl: pod?.photoUrl && /^(\/api\/media\/|https:\/\/)[^\s"'<>]{1,400}$/.test(pod.photoUrl) ? pod.photoUrl : null, at: t, by };
    if (s.exception && !s.exception.resolvedAt) Object.assign(s.exception, { resolvedAt: t, resolvedBy: by, resolution: 'Delivered' });
  }
  s.events.push(evt);
  if (EXCEPTION_ON[status]) openException(order, { kind: EXCEPTION_ON[status], note: evt.note }, by, t);

  // Order status follows the shipment, one step at a time so the order history stays complete.
  const orderFrom = order.status;
  const target = { packed: 'processing', ready_for_pickup: 'processing', handed_over: 'dispatched', in_transit: 'dispatched', out_for_delivery: 'dispatched', delivered: 'delivered', returned_to_sender: 'returned' }[status];
  if (target) advanceOrder(order, target, SHIP_LABEL[status], by);
  if (status === 'failed_attempt') order.history.push({ status: 'delivery_failed', at: t, by, note: evt.note || 'Delivery attempt failed' });
  return { shipment: s, orderChanged: orderFrom !== order.status };
}

const PATH = ['paid', 'processing', 'dispatched', 'delivered'];
function advanceOrder(order, target, note, by) {
  if (target === 'returned') { if (order.status !== 'returned') setStatus(order, 'returned', note, by); return; }
  const from = PATH.indexOf(order.status);
  const to = PATH.indexOf(target);
  for (let i = from + 1; from >= 0 && i <= to; i++) setStatus(order, PATH[i], i === to ? note : '', by);
}

export function openException(order, { kind, note }, by, at = now()) {
  const s = ensureShipment(order);
  if (!EXCEPTION_KINDS.includes(kind)) fail(422, 'invalid', 'Unknown exception type.');
  s.exception = { kind, note: v.str(note, { name: 'Note', max: 300, required: false }) || '', openedAt: at, openedBy: by, resolvedAt: null, resolution: null };
  return s.exception;
}
export function resolveException(order, resolution, by) {
  const s = ensureShipment(order);
  if (!s.exception || s.exception.resolvedAt) fail(422, 'invalid', 'There is no open delivery exception.');
  Object.assign(s.exception, { resolvedAt: now(), resolvedBy: by, resolution: v.str(resolution, { name: 'Resolution', max: 300 }) });
  s.events.push({ status: 'exception_resolved', at: s.exception.resolvedAt, by, source: 'admin', note: s.exception.resolution });
  return s.exception;
}
export const hasOpenException = (o) => !!(o.shipment?.exception && !o.shipment.exception.resolvedAt);

/* ------------------------------------------------------------------ refunds (partial, approvals above a threshold) */
export const REFUND_REASONS = ['customer_request', 'returned_items', 'damaged', 'not_delivered', 'wrong_item', 'duplicate_payment', 'pricing_error', 'goodwill', 'other'];
export const DEFAULT_REFUND_APPROVAL = 100000; // ₦ — refunds above this need a second approver (spec §9; CNM to confirm)

/** Every refund on an order, including the legacy single refund written by the older admin. */
export function refundList(o) {
  const list = Array.isArray(o.refunds) ? [...o.refunds] : [];
  if (o.payment?.refund && !list.some((r) => r.providerRef && r.providerRef === o.payment.refund.id)) {
    list.push({ id: 'legacy', amount: Number(o.payment.refund.amount ?? o.totals.total), status: 'succeeded', reason: 'other', at: o.payment.refund.at, requestedBy: o.payment.refund.requestedBy, providerRef: o.payment.refund.id });
  }
  return list;
}
export const refunded = (o) => r2(refundList(o).filter((r) => r.status === 'succeeded').reduce((s, r) => s + r.amount, 0));
export const pendingRefunds = (o) => refundList(o).filter((r) => r.status === 'requested');
export const refundable = (o) => r2(o.totals.total - refunded(o) - pendingRefunds(o).reduce((s, r) => s + r.amount, 0));

export function requestRefund(order, b, admin, threshold = DEFAULT_REFUND_APPROVAL) {
  if (!['paid', 'processing', 'dispatched', 'delivered', 'returned'].includes(order.status)) fail(422, 'transition', 'Only paid orders can be refunded.');
  const amount = r2(Number(b.amount));
  if (!(amount > 0)) fail(422, 'invalid', 'Enter a refund amount above ₦0.');
  if (amount > refundable(order)) fail(422, 'invalid', `At most ₦${refundable(order).toLocaleString('en-NG')} can still be refunded on this order.`);
  const reason = v.oneOf(b.reason, REFUND_REASONS, 'Reason');
  const r = { id: `RF-${randomToken(5)}`, amount, reason, note: v.str(b.note, { name: 'Note', max: 300, required: false }) || '', status: 'requested', requestedBy: admin.email, requestedAt: now(), rma: b.rma || null };
  r.needsApproval = amount > threshold;
  order.refunds = [...(order.refunds || []), r];
  return r;
}

/** Send an approved refund to the payment provider; the refund is only "succeeded" if the provider accepts it. */
export async function executeRefund(order, r, provider, approver) {
  r.approvedBy = approver.email; r.approvedAt = now(); r.status = 'processing';
  try {
    const res = await provider.refund(order, r.amount);
    Object.assign(r, { status: 'succeeded', providerRef: res.id || null, completedAt: now() });
  } catch (err) {
    Object.assign(r, { status: 'failed', error: String(err.message || err).slice(0, 200), completedAt: now() });
    return r;
  }
  order.payment = { ...order.payment, refund: { id: r.providerRef, status: 'processed', amount: refunded(order), requestedBy: r.requestedBy, at: r.completedAt } };
  if (refunded(order) >= order.totals.total - 0.001) setStatus(order, 'refunded', `Refunded ₦${r.amount.toLocaleString('en-NG')} (${r.reason.replace(/_/g, ' ')})`, approver.email);
  else order.history.push({ status: 'partially_refunded', at: r.completedAt, by: approver.email, note: `Refunded ₦${r.amount.toLocaleString('en-NG')} of ₦${order.totals.total.toLocaleString('en-NG')}` });
  return r;
}

/* ------------------------------------------------------------------ returns (RMA) */
export const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'faulty', 'late_delivery', 'other'];
const RETURN_NEXT = { requested: ['approved', 'rejected'], approved: ['received', 'rejected'], received: ['inspected'], inspected: ['refunded', 'exchanged', 'credited', 'rejected'], rejected: [], refunded: [], exchanged: [], credited: [] };
export const returnNext = (s) => RETURN_NEXT[s] || [];

export function createReturn(order, b, by) {
  if (!['delivered', 'dispatched', 'returned'].includes(order.status)) fail(422, 'transition', 'Returns can be opened once an order has been dispatched or delivered.');
  const kind = v.oneOf(b.kind || 'refund', ['refund', 'exchange', 'store_credit'], 'Resolution');
  const reason = v.oneOf(b.reason, RETURN_REASONS, 'Reason');
  if (!Array.isArray(b.lines) || !b.lines.length) fail(422, 'invalid', 'Choose at least one item to return.');
  const already = {};
  for (const rt of order.returns || []) if (rt.status !== 'rejected') for (const l of rt.lines) already[l.id] = (already[l.id] || 0) + l.qty;
  const lines = b.lines.map((x) => {
    const ol = order.lines.find((l) => l.id === x.id);
    const qty = Math.floor(Number(x.qty));
    if (!ol) fail(422, 'invalid', 'That item is not on this order.');
    if (!(qty > 0) || qty > ol.qty - (already[ol.id] || 0)) fail(422, 'invalid', `You can return at most ${ol.qty - (already[ol.id] || 0)} × ${ol.name}.`);
    return { id: ol.id, name: ol.name, qty, unitPrice: ol.unitPrice, value: r2(ol.unitPrice * qty) };
  });
  const n = (order.returns || []).length + 1;
  const rt = { rma: `RMA-${order.number.slice(4)}-${n}`, status: 'requested', kind, reason, note: v.str(b.note, { name: 'Note', max: 500, required: false }) || '', lines, value: r2(lines.reduce((s, l) => s + l.value, 0)), createdAt: now(), createdBy: by, history: [{ status: 'requested', at: now(), by }] };
  order.returns = [...(order.returns || []), rt];
  return rt;
}
export function moveReturn(order, rma, status, note, by) {
  const rt = (order.returns || []).find((x) => x.rma === rma);
  if (!rt) fail(404, 'not_found', 'Return not found.');
  if (!returnNext(rt.status).includes(status)) fail(422, 'transition', `A return can't go from ${rt.status} to ${status}.`);
  if (['refunded', 'exchanged', 'credited'].includes(status) && rt.kind !== { refunded: 'refund', exchanged: 'exchange', credited: 'store_credit' }[status]) fail(422, 'invalid', `This return was opened for a ${rt.kind.replace('_', ' ')}.`);
  rt.status = status;
  rt.history.push({ status, at: now(), by, note: v.str(note, { name: 'Note', max: 300, required: false }) || '' });
  return rt;
}

/* ------------------------------------------------------------------ search, customers, timeline, stats */
export const pickupStore = (o) => stores.find((st) => st.slug === o.delivery?.storeSlug) || null;
export const orderLocation = (o) => o.delivery?.address?.state || (o.delivery?.storeSlug ? `Pickup · ${pickupStore(o)?.city || o.delivery.storeSlug}` : '—');
const digits = (x) => String(x || '').replace(/\D/g, '');
export function matches(o, q) {
  if (!q) return true;
  const hay = [o.number, o.contact?.email, `${o.contact?.firstName} ${o.contact?.lastName}`, o.shipment?.trackingNumber, o.payment?.reference,
    ...(o.lines || []).flatMap((l) => [l.id, l.name]), ...(o.returns || []).map((r) => r.rma)].filter(Boolean).join(' ').toLowerCase();
  const phone = digits(o.contact?.phone).slice(-10);
  return q.toLowerCase().trim().split(/\s+/).every((w) => hay.includes(w) || (digits(w).length >= 6 && phone.includes(digits(w).replace(/^0/, '').slice(-10))));
}

export function filterOrders(all, f, scope) {
  return all.filter((o) => (!scope || scope.includes(o.companyId || 'essentials'))
    && (!f.company || f.company === 'all' || (o.companyId || 'essentials') === f.company)
    && (!f.status || f.status === 'all' || (f.status === 'open' ? ['paid', 'processing', 'dispatched'].includes(o.status) : o.status === f.status))
    && (!f.channel || f.channel === 'all' || (o.channel || 'web') === f.channel)
    && (!f.payment || f.payment === 'all' || o.payment?.method === f.payment)
    && (!f.location || f.location === 'all' || orderLocation(o) === f.location)
    && (!f.from || o.createdAt.slice(0, 10) >= f.from) && (!f.to || o.createdAt.slice(0, 10) <= f.to)
    && (!f.exception || hasOpenException(o))
    && (!f.shipment || f.shipment === 'all' || (o.shipment?.status || (FULFILLABLE.includes(o.status) ? 'awaiting_fulfilment' : '')) === f.shipment)
    && matches(o, f.q));
}

export function customerSummary(all, email) {
  const mine = all.filter((o) => o.contact?.email?.toLowerCase() === String(email).toLowerCase());
  const paid = mine.filter((o) => ['paid', 'processing', 'dispatched', 'delivered', 'refunded', 'returned'].includes(o.status));
  const spent = r2(paid.reduce((s, o) => s + o.totals.total - refunded(o), 0));
  const sorted = [...mine].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { orders: mine.length, paidOrders: paid.length, lifetimeValue: spent, aov: paid.length ? r2(spent / paid.length) : 0, firstOrderAt: sorted[0]?.createdAt || null, lastOrderAt: sorted.at(-1)?.createdAt || null,
    recent: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((o) => ({ number: o.number, status: o.status, total: o.totals.total, createdAt: o.createdAt })) };
}

/** One chronological story: order status changes, shipment events, payments, refunds, returns and staff notes. */
export function timeline(o) {
  const t = [];
  for (const h of o.history || []) t.push({ at: h.at, type: 'order', status: h.status, by: h.by || '', note: h.note || '' });
  for (const e of o.shipment?.events || []) t.push({ at: e.at, type: 'shipment', status: e.status, by: e.by || e.source || '', note: e.note || '' });
  if (o.shipment?.exception) t.push({ at: o.shipment.exception.openedAt, type: 'exception', status: o.shipment.exception.kind, by: o.shipment.exception.openedBy || '', note: o.shipment.exception.note || '' });
  for (const r of o.refunds || []) {
    t.push({ at: r.requestedAt, type: 'refund', status: 'refund_requested', by: r.requestedBy, note: `₦${r.amount.toLocaleString('en-NG')} · ${r.reason.replace(/_/g, ' ')}${r.needsApproval ? ' · needs approval' : ''}` });
    if (r.completedAt) t.push({ at: r.completedAt, type: 'refund', status: `refund_${r.status}`, by: r.approvedBy || '', note: r.error || `₦${r.amount.toLocaleString('en-NG')}` });
    if (r.status === 'rejected') t.push({ at: r.rejectedAt, type: 'refund', status: 'refund_rejected', by: r.rejectedBy, note: r.rejectReason || '' });
  }
  for (const rt of o.returns || []) for (const h of rt.history) t.push({ at: h.at, type: 'return', status: `${rt.rma} ${h.status}`, by: h.by || '', note: h.note || '' });
  for (const n of o.staffNotes || []) t.push({ at: n.at, type: 'note', status: 'note', by: n.by, note: n.text });
  return t.filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at));
}

/** Delivery performance for a set of orders (spec §8): success, speed, on-time, by courier and by state. */
export function deliveryStats(orders, couriers) {
  const shipped = orders.filter((o) => o.shipment && o.shipment.status !== 'awaiting_fulfilment');
  const done = shipped.filter((o) => ['delivered', 'returned_to_sender', 'lost'].includes(o.shipment.status));
  const delivered = done.filter((o) => o.shipment.status === 'delivered');
  const hours = delivered.map((o) => (Date.parse(o.shipment.deliveredAt) - Date.parse(o.history.find((h) => h.status === 'paid')?.at || o.createdAt)) / 36e5).filter((h) => h >= 0).sort((a, b) => a - b);
  const withPromise = delivered.filter((o) => o.shipment.promisedBy);
  const onTime = withPromise.filter((o) => o.shipment.deliveredAt.slice(0, 10) <= o.shipment.promisedBy);
  const firstTry = delivered.filter((o) => !o.shipment.attempts);
  const group = (keyOf, labelOf) => {
    const m = {};
    for (const o of done) { const k = keyOf(o); (m[k] ||= { key: k, label: labelOf(k), done: 0, delivered: 0 }); m[k].done += 1; if (o.shipment.status === 'delivered') m[k].delivered += 1; }
    return Object.values(m).map((x) => ({ ...x, successRate: x.done ? Math.round((x.delivered / x.done) * 1000) / 10 : null })).sort((a, b) => b.done - a.done);
  };
  return {
    shipped: shipped.length, completed: done.length, delivered: delivered.length,
    successRate: done.length ? Math.round((delivered.length / done.length) * 1000) / 10 : null,
    firstAttemptRate: delivered.length ? Math.round((firstTry.length / delivered.length) * 1000) / 10 : null,
    onTimeRate: withPromise.length ? Math.round((onTime.length / withPromise.length) * 1000) / 10 : null,
    avgHours: hours.length ? Math.round(hours.reduce((s, h) => s + h, 0) / hours.length) : null,
    p90Hours: hours.length ? Math.round(hours[Math.min(hours.length - 1, Math.floor(hours.length * 0.9))]) : null,
    openExceptions: orders.filter(hasOpenException).length,
    byCourier: group((o) => o.shipment.courier || 'unassigned', (k) => couriers.find((c) => c.id === k)?.name || 'Not set'),
    byState: group((o) => orderLocation(o), (k) => k),
  };
}

import { randomBytes } from 'node:crypto';
import { store } from './store.mjs';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function orderNumber(date = new Date()) {
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  const r = [...randomBytes(5)].map((b) => ALPHA[b % ALPHA.length]).join('');
  return `CNM-${d}-${r}`;
}

export const STATUSES = ['pending_payment', 'paid', 'processing', 'dispatched', 'delivered', 'payment_failed', 'cancelled', 'refunded'];

export async function saveOrder(order) {
  const s = await store('orders');
  await s.set(`order/${order.number}`, order);
  if (order.userId) await s.set(`user/${order.userId}/${order.number}`, { number: order.number });
  if (order.payment?.reference) await s.set(`ref/${order.payment.reference}`, { number: order.number });
}

export async function getOrder(number) {
  if (!/^CNM-\d{6}-[A-Z0-9]{5}$/.test(String(number))) return null;
  return (await store('orders')).get(`order/${number}`);
}

export async function orderByReference(ref) {
  const s = await store('orders');
  const r = await s.get(`ref/${ref}`);
  return r ? s.get(`order/${r.number}`) : null;
}

export async function listOrders({ userId } = {}) {
  const s = await store('orders');
  const keys = userId ? (await s.list(`user/${userId}/`)).map((k) => `order/${k.split('/').pop()}`) : await s.list('order/');
  const orders = (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean);
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const summary = (o) => ({ number: o.number, status: o.status, total: o.totals.total, createdAt: o.createdAt, items: o.lines.reduce((n, l) => n + l.qty, 0) });

/** Public (customer-facing) view of an order: no internal notes, no payment secrets. */
export const publicOrder = (o) => ({
  number: o.number, status: o.status, createdAt: o.createdAt, lines: o.lines, totals: o.totals, promoCode: o.promoCode,
  delivery: o.delivery, contact: { firstName: o.contact.firstName, lastName: o.contact.lastName, email: o.contact.email, phone: o.contact.phone },
  notes: o.notes || '',
  // For the customer's receipt: method, status and reference only (never provider secrets).
  payment: o.payment ? { method: o.payment.method, status: o.payment.status, reference: o.payment.reference, paidAt: o.payment.paidAt || null, channel: o.payment.channel || null, test: o.payment.provider === 'simulated' } : null,
  history: o.history.map(({ status, at }) => ({ status, at })),
});

export function setStatus(order, status, note = '', by = 'system') {
  order.status = status;
  order.updatedAt = new Date().toISOString();
  order.history.push({ status, at: order.updatedAt, note, by });
  return order;
}

/** Decrement stock for a paid order (live inventory in Blobs). */
export async function commitStock(order, baseProducts) {
  const s = await store('config');
  const inv = (await s.get('inventory')) || { products: {} };
  for (const l of order.lines) {
    const base = baseProducts.find((p) => p.id === l.id);
    const cur = inv.products[l.id]?.stock ?? base?.stock?.quantity;
    if (cur == null) continue;
    inv.products[l.id] = { ...(inv.products[l.id] || {}), stock: Math.max(0, cur - l.qty) };
  }
  await s.set('inventory', inv);
}

// /api/payments/* — Paystack verification & webhook, plus the staging simulator.
import { baseProducts } from '../lib/catalogue.mjs';
import { safeEqual } from '../lib/crypto.mjs';
import { orderConfirmationEmail, sendEmail } from '../lib/email.mjs';
import { assertCsrf, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { commitStock, getOrder, orderByReference, publicOrder, saveOrder, setStatus } from '../lib/orders.mjs';
import { paystackEnabled, validSignature, verifyTransaction } from '../lib/paystack.mjs';

const siteUrl = (req) => (process.env.CONTEXT === 'production' && process.env.URL) || new URL(req.url).origin;

/** Idempotently mark an order paid: stock is committed and the email is sent exactly once. */
export async function markPaid(order, req, meta = {}) {
  if (order.status !== 'pending_payment' && order.status !== 'payment_failed') return order;
  if (meta.amount != null && meta.amount !== Math.round(order.totals.total * 100)) {
    setStatus(order, 'payment_failed', `Amount mismatch: received ${meta.amount}`);
    await saveOrder(order);
    return order;
  }
  order.payment = { ...order.payment, status: 'paid', paidAt: new Date().toISOString(), channel: meta.channel || order.payment.provider };
  setStatus(order, 'paid', 'Payment confirmed');
  await saveOrder(order);
  await commitStock(order, baseProducts);
  await sendEmail(orderConfirmationEmail(order, siteUrl(req)));
  return order;
}

export default handler(async (req) => {
  const action = segments(req)[2];

  if (action === 'paystack-webhook') {
    if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
    const raw = await req.text();
    if (!validSignature(raw, req.headers.get('x-paystack-signature'))) return json({ error: 'invalid_signature' }, 401);
    const evt = JSON.parse(raw);
    if (evt.event === 'charge.success') {
      const order = await orderByReference(evt.data.reference);
      if (order) await markPaid(order, req, { amount: evt.data.amount, channel: evt.data.channel });
    }
    return json({ received: true });
  }

  if (action === 'verify' && req.method === 'GET') {
    const ref = new URL(req.url).searchParams.get('reference') || '';
    const order = await orderByReference(ref);
    if (!order) fail(404, 'not_found', 'Payment reference not found.');
    if (paystackEnabled() && order.status === 'pending_payment') {
      const tx = await verifyTransaction(ref);
      if (tx.status === 'success') await markPaid(order, req, { amount: tx.amount, channel: tx.channel });
      else if (tx.status === 'failed' || tx.status === 'abandoned') { setStatus(order, 'payment_failed', `Paystack: ${tx.status}`); await saveOrder(order); }
    }
    return json({ status: order.status });
  }

  if (action === 'simulate') {
    if (paystackEnabled() || process.env.CONTEXT === 'production') fail(404, 'not_found', 'Not available.');
    if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
    assertCsrf(req);
    const b = await readJson(req);
    const order = await getOrder(b.number);
    if (!order || !safeEqual(order.accessToken, b.accessToken || '')) fail(404, 'not_found', 'Order not found.');
    if (b.outcome === 'success') await markPaid(order, req, { channel: 'simulated' });
    else if (['pending_payment', 'payment_failed'].includes(order.status)) {
      order.payment.status = 'failed';
      setStatus(order, 'payment_failed', 'Simulated decline');
      await saveOrder(order);
    }
    return json({ order: publicOrder(order) });
  }

  fail(404, 'not_found', 'Unknown action.');
});

export const config = { path: '/api/payments/:action' };

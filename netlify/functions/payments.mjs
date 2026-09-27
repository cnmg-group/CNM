// /api/payments/* — verification on return, provider webhooks, and the staging simulator.
import { baseProducts } from '../lib/catalogue.mjs';
import { safeEqual } from '../lib/crypto.mjs';
import { orderConfirmationEmail, sendEmail } from '../lib/email.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { commitStock, getOrder, orderByReference, publicOrder, saveOrder, setStatus } from '../lib/orders.mjs';
import { activeProvider, providerFor, providers, toKobo } from '../lib/payments/index.mjs';

const siteUrl = (req) => (process.env.CONTEXT === 'production' && process.env.URL) || new URL(req.url).origin;

/** Idempotently mark an order paid: amount is checked, stock committed and the email sent exactly once. */
export async function markPaid(order, req, meta = {}) {
  if (order.status !== 'pending_payment' && order.status !== 'payment_failed') return order;
  if (meta.amountKobo != null && meta.amountKobo !== toKobo(order.totals.total)) {
    setStatus(order, 'payment_failed', `Amount mismatch: received ${meta.amountKobo} kobo, expected ${toKobo(order.totals.total)}`);
    await saveOrder(order);
    return order;
  }
  if (meta.currency && meta.currency !== 'NGN') {
    setStatus(order, 'payment_failed', `Unexpected currency ${meta.currency}`);
    await saveOrder(order);
    return order;
  }
  order.payment = { ...order.payment, status: 'paid', paidAt: meta.paidAt || new Date().toISOString(), channel: meta.channel || order.payment.provider };
  setStatus(order, 'paid', 'Payment confirmed');
  await saveOrder(order);
  await commitStock(order, baseProducts);
  await sendEmail(orderConfirmationEmail(order, siteUrl(req)));
  return order;
}

/** Ask the provider for the truth about a payment and apply it to the order. */
export async function reconcile(order, req) {
  if (order.status !== 'pending_payment') return order;
  const tx = await providerFor(order).verify(order.payment.reference);
  if (tx.status === 'success') return markPaid(order, req, tx);
  if (tx.status === 'failed' || tx.status === 'abandoned') {
    order.payment.status = tx.status;
    setStatus(order, 'payment_failed', `${order.payment.provider}: ${tx.status}${tx.gatewayResponse ? ` (${tx.gatewayResponse})` : ''}`);
    await saveOrder(order);
  }
  return order;
}

export default handler(async (req, context) => {
  const action = segments(req)[2];

  // POST /api/payments/paystack-webhook (and /api/payments/webhook/<provider> in future)
  if (action === 'paystack-webhook') {
    if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
    const raw = await req.text();
    const evt = providers.paystack.parseWebhook(raw, req.headers, clientIp(req, context));
    if (!evt) return json({ error: 'invalid_signature' }, 401);
    const order = evt.reference ? await orderByReference(evt.reference) : null;
    if (order && evt.type === 'payment.success') await markPaid(order, req, evt);
    if (order && evt.type.startsWith('refund.')) {
      order.payment.refund = { ...(order.payment.refund || {}), status: evt.type.split('.')[1], updatedAt: new Date().toISOString() };
      await saveOrder(order);
    }
    return json({ received: true }); // always 200 for authentic events so Paystack stops retrying
  }

  // GET /api/payments/verify?reference=  — called when the customer returns from the hosted payment page
  if (action === 'verify' && req.method === 'GET') {
    const ref = new URL(req.url).searchParams.get('reference') || '';
    const order = await orderByReference(ref);
    if (!order) fail(404, 'not_found', 'Payment reference not found.');
    await reconcile(order, req);
    return json({ status: order.status });
  }

  // POST /api/payments/simulate — staging only
  if (action === 'simulate') {
    if (activeProvider().name !== 'simulated') fail(404, 'not_found', 'Not available.');
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

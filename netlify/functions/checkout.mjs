// /api/checkout and /api/checkout/quote — server-authoritative pricing and order creation.
import { computeQuote } from '../../src/shared/pricing.mjs';
import { baseProducts, commerce, productsMap, stores } from '../lib/catalogue.mjs';
import { randomToken } from '../lib/crypto.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { parseContact, parseDelivery } from '../lib/order-input.mjs';
import { orderNumber, saveOrder, setStatus } from '../lib/orders.mjs';
import { PAYMENT_METHODS, activeProvider, paymentInfo } from '../lib/payments/index.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';
import { currentUser } from '../lib/session.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';

const siteUrl = (req) => (process.env.CONTEXT === 'production' && process.env.URL) || new URL(req.url).origin;

function cleanItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) fail(422, 'invalid', 'Your bag is empty.');
  return items.map((i) => ({ id: String(i?.id || '').slice(0, 80), qty: Number(i?.qty) }));
}

export default handler(async (req, context) => {
  if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
  assertCsrf(req);
  const isQuote = segments(req)[2] === 'quote';
  await rateLimit(isQuote ? 'quote' : 'checkout', clientIp(req, context));
  const body = await readJson(req);
  const [products, rules] = await Promise.all([productsMap(), commerce()]);
  const items = cleanItems(body.items);
  const promoCode = body.promoCode ? v.str(body.promoCode, { name: 'Promo code', max: 40 }) : undefined;

  if (isQuote) {
    return json({ ...computeQuote({ items, products, commerce: rules, promoCode, deliveryMethod: body.deliveryMethod }), payment: paymentInfo() });
  }

  // ---- create order ----
  const contact = parseContact(body.contact);
  const delivery = parseDelivery(body.delivery, rules, stores);
  const method = { id: delivery.method };

  const paymentMethod = PAYMENT_METHODS.find((m) => m.id === (body.paymentMethod || 'card'));
  if (!paymentMethod) fail(422, 'invalid', 'Please choose a payment method.');

  const quote = computeQuote({ items, products, commerce: rules, promoCode, deliveryMethod: method.id });
  const blocking = quote.errors.filter((e) => e.code !== 'qty_reduced');
  if (!quote.lines.length || blocking.length || quote.errors.length) {
    fail(409, 'bag_changed', quote.errors.map((e) => e.message).join(' ') || 'Your bag has changed. Please review it before paying.', { quote });
  }

  const user = await currentUser(req);
  const now = new Date().toISOString();
  const number = orderNumber();
  const order = {
    number, accessToken: randomToken(24), userId: user?.id || null, status: 'pending_payment', createdAt: now, updatedAt: now,
    companyId: 'essentials', channel: req.headers.get('x-cnm-client') === 'mobile' ? 'app' : 'web',
    contact, delivery, notes: v.str(body.notes, { name: 'Notes', max: 300, required: false }),
    lines: quote.lines, promoCode: quote.promo?.valid ? quote.promo.code : null,
    totals: { subtotal: quote.subtotal, discount: quote.discount, delivery: quote.delivery, vat: quote.vat, vatIncluded: quote.vatIncluded, total: quote.total, currency: 'NGN' },
    payment: { provider: activeProvider().name, method: paymentMethod.id, reference: `${number}-${randomToken(4)}`, status: 'pending' },
    history: [{ status: 'pending_payment', at: now, by: 'customer' }],
    catalogueVersion: baseProducts.length,
  };
  await saveOrder(order);

  if (contact.marketing) {
    await (await store('leads')).set(`newsletter/${contact.email}`, { email: contact.email, source: 'checkout', consentAt: now });
  }

  const provider = activeProvider();
  let pay;
  try {
    pay = await provider.initialize(order, { channels: paymentMethod.channels, callbackUrl: `${siteUrl(req)}/checkout/confirmation/?n=${encodeURIComponent(number)}&t=${encodeURIComponent(order.accessToken)}` });
  } catch (err) {
    console.error(`[checkout] ${provider.name} initialize failed`, err);
    setStatus(order, 'payment_failed', `Could not start payment: ${err.message}`);
    await saveOrder(order);
    fail(502, 'payment_unavailable', 'Our payment provider is unavailable right now. Your bag has been kept — please try again shortly.');
  }
  if (pay.reference !== order.payment.reference) { order.payment.reference = pay.reference; await saveOrder(order); }
  return json({ order: { number, accessToken: order.accessToken, total: order.totals.total, status: order.status }, payment: { mode: pay.mode, method: paymentMethod.id, testMode: paymentInfo().testMode, reference: pay.reference, ...(pay.authorizationUrl ? { authorizationUrl: pay.authorizationUrl } : {}) } }, 201);
});

export const config = { path: ['/api/checkout', '/api/checkout/quote'] };

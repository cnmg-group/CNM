// /api/checkout and /api/checkout/quote — server-authoritative pricing and order creation.
import { computeQuote } from '../../src/shared/pricing.mjs';
import { baseProducts, commerce, productsMap, stores } from '../lib/catalogue.mjs';
import { randomToken } from '../lib/crypto.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
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
  const c = body.contact || {};
  const contact = {
    email: v.email(c.email), phone: v.phone(c.phone),
    firstName: v.str(c.firstName, { name: 'First name', max: 80 }), lastName: v.str(c.lastName, { name: 'Last name', max: 80 }),
    marketing: v.bool(c.marketing),
  };
  const d = body.delivery || {};
  const method = rules.deliveryMethods.find((m) => m.id === d.method);
  if (!method) fail(422, 'invalid', 'Please choose a delivery method.');
  let delivery;
  if (method.id === 'store-pickup') {
    const st = stores.find((s) => s.slug === d.storeSlug);
    if (!st) fail(422, 'invalid', 'Please choose a store for collection.');
    delivery = { method: method.id, label: method.label, storeSlug: st.slug };
  } else {
    const a = d.address || {};
    const address = {
      line1: v.str(a.line1, { name: 'Address', max: 200 }), line2: v.str(a.line2, { name: 'Address line 2', max: 200, required: false }),
      city: v.str(a.city, { name: 'City', max: 80 }), state: v.str(a.state, { name: 'State', max: 40 }), country: 'NG',
    };
    if (!method.regions.includes('*') && !method.regions.includes(address.state)) fail(422, 'region', `${method.label} isn't available for ${address.state}. Please choose another delivery method.`);
    delivery = { method: method.id, label: method.label, address };
  }

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

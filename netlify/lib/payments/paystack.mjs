// Paystack adapter (NGN). Customers pay on Paystack's hosted page — card details never touch CNM servers.
// Docs: https://paystack.com/docs/api/
import { hmac, safeEqual } from '../crypto.mjs';

export const name = 'paystack';
const API = 'https://api.paystack.co';
const secret = () => process.env.PAYSTACK_SECRET_KEY || '';
export const enabled = () => !!secret();
export const isTestMode = () => secret().startsWith('sk_test_');

// Paystack's published webhook source IPs. Enforced only when PAYSTACK_ENFORCE_IPS=true (signature is always checked).
const WEBHOOK_IPS = ['52.31.139.75', '52.49.173.169', '52.214.14.220'];
const DEFAULT_CHANNELS = ['card', 'bank', 'ussd', 'bank_transfer', 'qr', 'mobile_money'];

export class PaystackError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

async function call(path, init = {}, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
    } catch (err) {
      if (attempt < retries) continue; // network blip or timeout: retry once
      throw new PaystackError(`Paystack unreachable: ${err.message}`, 0);
    }
    const body = await res.json().catch(() => ({}));
    if (res.status >= 500 && attempt < retries) continue;
    if (!res.ok || body.status === false) throw new PaystackError(body.message || `Paystack error ${res.status}`, res.status, body);
    return body.data;
  }
}

const channels = () => (process.env.PAYSTACK_CHANNELS ? process.env.PAYSTACK_CHANNELS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_CHANNELS);

// Put the shopper's chosen method first by restricting to it, as long as it's an allowed channel.
const channelsFor = (method) => {
  const all = channels();
  const picked = (method || []).filter((c) => all.includes(c));
  return picked.length ? picked : all;
};

export async function initialize(order, { callbackUrl, channels: preferred } = {}) {
  const payload = (reference) => ({
    email: order.contact.email,
    amount: Math.round(order.totals.total * 100),
    currency: 'NGN',
    reference,
    callback_url: callbackUrl,
    channels: channelsFor(preferred),
    metadata: {
      order_number: order.number,
      cancel_action: callbackUrl,
      custom_fields: [
        { display_name: 'Order', variable_name: 'order_number', value: order.number },
        { display_name: 'Customer', variable_name: 'customer_name', value: `${order.contact.firstName} ${order.contact.lastName}` },
        { display_name: 'Phone', variable_name: 'phone', value: order.contact.phone },
      ],
    },
  });
  let reference = order.payment.reference;
  let data;
  try {
    data = await call('/transaction/initialize', { method: 'POST', body: JSON.stringify(payload(reference)) });
  } catch (err) {
    if (!/duplicate/i.test(err.message)) throw err;
    reference = `${order.payment.reference}-r${Date.now().toString(36)}`; // retrying a failed payment needs a fresh reference
    data = await call('/transaction/initialize', { method: 'POST', body: JSON.stringify(payload(reference)) });
  }
  return { mode: 'paystack', reference, authorizationUrl: data.authorization_url, accessCode: data.access_code };
}

export async function verify(reference) {
  const tx = await call(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
  const status = tx.status === 'success' ? 'success' : ['failed', 'reversed'].includes(tx.status) ? 'failed' : tx.status === 'abandoned' ? 'abandoned' : 'pending';
  return { status, amountKobo: tx.amount, currency: tx.currency, channel: tx.channel, paidAt: tx.paid_at, gatewayResponse: tx.gateway_response };
}

/** Verify x-paystack-signature (HMAC-SHA512 of the raw body) and normalise the event. */
export function parseWebhook(raw, headers, ip) {
  const sig = headers.get('x-paystack-signature');
  if (!sig || !enabled() || !safeEqual(hmac(secret(), raw, 'sha512', 'hex'), sig)) return null;
  if (process.env.PAYSTACK_ENFORCE_IPS === 'true' && ip && !WEBHOOK_IPS.includes(ip)) return null;
  let evt;
  try { evt = JSON.parse(raw); } catch { return null; }
  const d = evt.data || {};
  const types = { 'charge.success': 'payment.success', 'refund.processed': 'refund.processed', 'refund.failed': 'refund.failed', 'refund.pending': 'refund.pending' };
  return {
    type: types[evt.event] || evt.event,
    reference: d.reference || d.transaction_reference || d.transaction?.reference,
    amountKobo: d.amount, currency: d.currency, channel: d.channel,
  };
}

export async function refund(order, amountNaira) {
  const body = { transaction: order.payment.reference, currency: 'NGN', ...(amountNaira ? { amount: Math.round(amountNaira * 100) } : {}), merchant_note: `CNM order ${order.number}` };
  const data = await call('/refund', { method: 'POST', body: JSON.stringify(body) });
  return { status: data.status === 'processed' ? 'processed' : 'pending', id: data.id };
}

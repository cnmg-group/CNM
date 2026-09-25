// Paystack integration (NGN). Card data is entered on Paystack's hosted page — never on CNM servers.
import { hmac, safeEqual } from './crypto.mjs';

export const paystackEnabled = () => !!process.env.PAYSTACK_SECRET_KEY;

async function call(path, init = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) throw new Error(data.message || `Paystack error ${res.status}`);
  return data.data;
}

export function initialize({ email, amountNaira, reference, callbackUrl, metadata }) {
  return call('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email, amount: Math.round(amountNaira * 100), currency: 'NGN', reference, callback_url: callbackUrl, metadata }) });
}

export const verifyTransaction = (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`);

/** x-paystack-signature = HMAC-SHA512(secret, raw body) in hex. */
export function validSignature(rawBody, signature) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  return safeEqual(hmac(process.env.PAYSTACK_SECRET_KEY, rawBody, 'sha512', 'hex'), signature);
}

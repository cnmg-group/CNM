// Payment adapter registry. Every provider implements the same interface:
//
//   name                      'paystack' | 'simulated'
//   enabled()                 true when the provider is configured
//   initialize(order, opts)   -> { mode, reference, authorizationUrl?, accessCode? }
//   verify(reference)         -> { status: 'success'|'failed'|'abandoned'|'pending', amountKobo, channel, paidAt }
//   parseWebhook(raw, headers)-> { type, reference, amountKobo, channel } | null   (null = rejected)
//   refund(order, amountNaira?)-> { status: 'pending'|'processed', id }
//
// Adding another provider (e.g. Flutterwave, Stripe) means one new file here — checkout, verification,
// webhooks and admin refunds already talk to the interface, not to Paystack directly.
import * as paystack from './paystack.mjs';
import * as simulated from './simulated.mjs';
import { PAYMENT_METHODS } from '../../../src/shared/payment-methods.mjs';

export const providers = { paystack, simulated };

/** Real money may only move on the approved production deploy. */
export const liveAllowed = () => process.env.CONTEXT === 'production' && process.env.CNM_LAUNCH_APPROVED === 'true';

export { PAYMENT_METHODS };

/**
 * The active provider: Paystack when PAYSTACK_SECRET_KEY is set, otherwise the staging simulator.
 * Safety: a live key (sk_live_) is ignored everywhere except the approved production deploy, so a
 * staging or preview build can never charge a real card even if the key is set site-wide.
 */
export function activeProvider() {
  if (paystack.enabled() && (paystack.isTestMode() || liveAllowed())) return paystack;
  if (paystack.enabled() && !warned) { warned = true; console.warn('[payments] live Paystack key ignored outside the approved production deploy — using the simulator'); }
  if (liveAllowed()) throw new Error('No payment provider configured for production.');
  return simulated;
}
let warned = false;

/** Public, non-secret description of how payment will be taken (for the checkout UI). */
export function paymentInfo() {
  const p = activeProvider();
  return { provider: p.name, testMode: p.name === 'simulated' || paystack.isTestMode(), methods: PAYMENT_METHODS.map(({ id, label, detail }) => ({ id, label, detail })) };
}

export const providerFor = (order) => providers[order?.payment?.provider] || activeProvider();

export const toKobo = (naira) => Math.round(Number(naira) * 100);

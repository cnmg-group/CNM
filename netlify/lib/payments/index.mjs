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

export const providers = { paystack, simulated };

/** The active provider: Paystack when PAYSTACK_SECRET_KEY is set, otherwise the staging simulator. */
export function activeProvider() {
  if (paystack.enabled()) return paystack;
  if (process.env.CONTEXT === 'production' && process.env.CNM_LAUNCH_APPROVED === 'true') {
    throw new Error('No payment provider configured for production.');
  }
  return simulated;
}

export const providerFor = (order) => providers[order?.payment?.provider] || activeProvider();

export const toKobo = (naira) => Math.round(Number(naira) * 100);

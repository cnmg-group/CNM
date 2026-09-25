import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api } from './api';
import type { Order } from './types';

export interface VerifyResult {
  paid: boolean;
  status: string;
  order?: Partial<Order> & { number?: string };
  message?: string;
}

/** Normalises the various shapes a verify/simulate endpoint may return. */
export function interpretPaymentResponse(res: unknown): VerifyResult {
  const r = (res ?? {}) as { status?: string; paid?: boolean; ok?: boolean; order?: Partial<Order>; message?: string };
  const status = String(r.order?.status ?? r.status ?? (r.paid ? 'paid' : 'unknown'));
  const paid = r.paid === true || ['paid', 'processing', 'dispatched', 'delivered', 'success'].includes(status);
  return { paid, status, order: r.order, message: r.message };
}

/** The URL Paystack's hosted page redirects back to (cnm://checkout/return in builds). */
export function paymentReturnUrl(): string {
  return Linking.createURL('checkout/return');
}

export function referenceFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /[?&](?:reference|trxref)=([^&#]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Opens the Paystack hosted page in an auth session. Whatever way the session
 * ends (redirect, cancel, dismiss) we then ask the server — it is the source of truth.
 */
export async function payWithPaystack(authorizationUrl: string, reference: string): Promise<VerifyResult> {
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, paymentReturnUrl());
  const ref = (result.type === 'success' ? referenceFromUrl(result.url) : null) ?? reference;
  return verifyPayment(ref);
}

export async function verifyPayment(reference: string): Promise<VerifyResult> {
  const res = await api(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, { timeoutMs: 30000 });
  return interpretPaymentResponse(res);
}

export async function simulatePayment(number: string, accessToken: string, outcome: 'success' | 'failure'): Promise<VerifyResult> {
  const res = await api('/api/payments/simulate', { method: 'POST', body: { number, accessToken, outcome } });
  const v = interpretPaymentResponse(res);
  // A simulate call that returns only { ok: true } still reflects the requested outcome.
  if (v.status === 'unknown') return { ...v, paid: outcome === 'success', status: outcome === 'success' ? 'paid' : 'payment_failed' };
  return v;
}

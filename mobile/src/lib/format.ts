/** Round to kobo (2 dp) without float drift, e.g. 0.1 + 0.2 → 0.3. */
export function roundKobo(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Naira with thousands separators. Whole amounts show no decimals (₦17,850);
 * amounts with kobo always show two (₦14,888.75, ₦14,888.80).
 */
export function formatNaira(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const kobo = Math.round(Math.abs(amount) * 100);
  const sign = amount < 0 && kobo > 0 ? '-' : '';
  const whole = Math.floor(kobo / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = kobo % 100;
  return `${sign}₦${whole}${fraction ? '.' + String(fraction).padStart(2, '0') : ''}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  processing: 'Processing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  payment_failed: 'Payment failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

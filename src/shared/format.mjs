// Formatting helpers shared by the build, the browser and functions.
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nairaKobo = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₦17,850 for whole amounts; ₦62,242.50 (always two decimals) when there are kobo. */
export const formatMoney = (amount) => (amount == null || Number.isNaN(amount) ? '—'
  : (Math.abs(Math.round(amount * 100) % 100) ? nairaKobo : naira).format(amount).replace('NGN', '₦').replace(/\s/g, ''));

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-');

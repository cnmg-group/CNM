// Transactional email. Uses Resend when RESEND_API_KEY is configured; otherwise logs (staging).
import { escapeHtml, formatMoney } from '../../src/shared/format.mjs';

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
const FROM = () => process.env.EMAIL_FROM || 'CNM Essentials <orders@cnmessentials.com>';

export async function sendEmail({ to, subject, html, text }) {
  if (!emailConfigured()) {
    console.log(`[email:not-configured] to=${to} subject="${subject}"`);
    return { sent: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to, subject, html, text }),
  });
  if (!res.ok) console.error('[email] send failed', res.status, await res.text().catch(() => ''));
  return { sent: res.ok };
}

const shell = (title, inner) => `<!doctype html><html><body style="margin:0;background:#f6f5f0;font-family:Helvetica,Arial,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px"><tr><td style="padding:28px 32px;border-bottom:1px solid #e4dfd4;letter-spacing:6px;font-weight:700;font-size:13px">${process.env.CNM_LOGO_URL ? `<img src="${process.env.CNM_LOGO_URL}" alt="CNM Essentials" height="28">` : 'CNM ESSENTIALS'}</td></tr>
<tr><td style="padding:32px"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px">${escapeHtml(title)}</h1>${inner}</td></tr>
<tr><td style="padding:20px 32px;background:#23221e;color:#f6f5f0;font-size:12px">CNM Essentials · Lagos &amp; Abuja</td></tr></table></td></tr></table></body></html>`;

export function orderConfirmationEmail(order, siteUrl) {
  const rows = order.lines.map((l) => `<tr><td style="padding:8px 0">${escapeHtml(l.name)} × ${l.qty}</td><td align="right">${formatMoney(l.lineTotal)}</td></tr>`).join('');
  return {
    to: order.contact.email,
    subject: `Your CNM Essentials order ${order.number}`,
    html: shell(`Thank you, ${order.contact.firstName}.`, `<p>We've received your order <strong>${order.number}</strong> and will let you know when it's on its way.</p>
<table width="100%" style="font-size:14px;border-top:1px solid #e4dfd4;margin-top:16px">${rows}
<tr><td style="padding-top:12px;border-top:1px solid #e4dfd4"><strong>Total</strong></td><td align="right" style="padding-top:12px;border-top:1px solid #e4dfd4"><strong>${formatMoney(order.totals.total)}</strong></td></tr></table>
<p style="margin-top:24px"><a href="${siteUrl}/checkout/confirmation/?n=${encodeURIComponent(order.number)}&t=${encodeURIComponent(order.accessToken)}" style="color:#23221e">View your order</a></p>`),
    text: `Thank you for your order ${order.number}. Total ${formatMoney(order.totals.total)}.`,
  };
}

export const statusEmail = (order, siteUrl) => ({
  to: order.contact.email,
  subject: `Order ${order.number}: ${order.status.replace(/_/g, ' ')}`,
  html: shell('Order update', `<p>Your order <strong>${order.number}</strong> is now <strong>${escapeHtml(order.status.replace(/_/g, ' '))}</strong>.</p><p><a href="${siteUrl}/checkout/confirmation/?n=${encodeURIComponent(order.number)}&t=${encodeURIComponent(order.accessToken)}" style="color:#23221e">Track your order</a></p>`),
  text: `Your order ${order.number} is now ${order.status}.`,
});

export const resetEmail = (to, link) => ({ to, subject: 'Reset your CNM Essentials password', html: shell('Reset your password', `<p>Use the link below within 30 minutes to choose a new password. If you didn't ask for this, you can ignore this email.</p><p><a href="${link}" style="color:#23221e">Reset password</a></p>`), text: `Reset your password: ${link}` });
export const otpEmail = (to, code) => ({ to, subject: `Your CNM Essentials sign-in code: ${code}`, html: shell('Your sign-in code', `<p style="font-size:32px;letter-spacing:8px;font-weight:700">${code}</p><p>This code expires in 10 minutes.</p>`), text: `Your sign-in code is ${code}` });
export const enquiryNotice = (e) => ({ to: process.env.CNM_NOTIFY_EMAIL, subject: `New Fragrance as a Service enquiry — ${e.sector}`, html: shell('New enquiry', `<p><strong>${escapeHtml(e.name)}</strong> (${escapeHtml(e.email)}${e.phone ? `, ${escapeHtml(e.phone)}` : ''})</p><p>${escapeHtml(e.company || '')} · ${escapeHtml(e.sector)} · ${escapeHtml(e.eventDate || '')} · ${escapeHtml(e.location || '')}</p><p>${escapeHtml(e.message)}</p>`), text: `${e.name} ${e.email}: ${e.message}` });

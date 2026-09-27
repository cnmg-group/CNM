// Enquiry forms across CNMGroup.com and the company sites (appointments, proposals, pledges, contact, FaaS).
import { track } from '../analytics.js';
import { api } from '../api.js';
import { formData, setBusy, validate } from '../ui.js';

const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

// Donation amount picker: preset chips or a custom amount, summarised into the enquiry.
function initAmounts(form) {
  const box = form.querySelector('[data-amounts]');
  if (!box) return () => true;
  const other = box.querySelector('[data-amount-other]');
  const otherInput = other.querySelector('input');
  box.addEventListener('change', () => {
    const custom = box.querySelector('input[name="amountPreset"]:checked')?.value === 'other';
    other.hidden = !custom;
    otherInput.required = custom;
    if (custom) otherInput.focus();
  });
  const preset = new URLSearchParams(location.search).get('amount');
  if (preset && /^\d+$/.test(preset)) { box.querySelector('input[value="other"]').checked = true; other.hidden = false; otherInput.value = preset; }
  return () => {
    const v = box.querySelector('input[name="amountPreset"]:checked')?.value;
    const amount = v === 'other' ? Number(otherInput.value) : Number(v);
    if (!amount || amount < 1000) { otherInput.setAttribute('aria-invalid', 'true'); otherInput.focus(); return false; }
    const freq = form.elements.frequency?.value || 'One-off';
    form.querySelector('[data-amount-summary]').value = `${naira(amount)} · ${freq}`;
    return true;
  };
}

// Prefill selects from links such as /spectra/book/?service=… or /foundation/donate/?programme=…
function prefill(form) {
  const q = new URLSearchParams(location.search);
  for (const [param, name] of [['service', 'interest'], ['interest', 'interest'], ['programme', 'interest'], ['location', 'location']]) {
    const v = q.get(param);
    const el = form.elements[name];
    if (!v || !el || el.tagName !== 'SELECT') continue;
    const opt = [...el.options].find((o) => o.value === v || o.textContent === v);
    if (opt) el.value = opt.value;
  }
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  form.querySelectorAll('[data-min-today]').forEach((d) => { d.min = today; });
}

function initForm(form) {
  const ok = form.querySelector('[data-enquiry-ok]');
  const err = form.querySelector('[data-enquiry-err]');
  const amountsOk = initAmounts(form);
  prefill(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!validate(form) || !amountsOk()) return;
    const btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true, 'Sending');
    try {
      const data = formData(form);
      delete data.amountPreset;
      delete data.frequency;
      // Some forms make the message optional; the API needs a short summary, so compose one from the choices.
      if (!data.message || data.message.length < 10) {
        const parts = [data.subject, data.interest, data.timeline, data.location, data.eventDate && `Preferred date ${data.eventDate}`, data.message].filter(Boolean);
        data.message = parts.join(' · ') || 'Request from the website';
      }
      await api('/api/enquiry', { method: 'POST', body: data });
      track('generate_lead', { lead_type: data.sector === 'group' ? `cnm_${data.division || 'group'}` : 'fragrance_as_a_service', sector: data.sector, subject: data.subject });
      form.querySelectorAll('.field, .form-row, .check, fieldset, button[type="submit"]').forEach((n) => { n.hidden = true; });
      ok.hidden = false;
      ok.textContent = form.dataset.success || (data.sector === 'group' ? 'Thank you. Your message has been received and CNM Group will be in touch.' : 'Thank you. Your enquiry has been received and the CNM team will be in touch.');
      ok.focus?.();
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message || 'We couldn’t send your request. Please try again.';
      setBusy(btn, false);
    }
  });
}

export function init() {
  document.querySelectorAll('[data-enquiry-form]').forEach(initForm);
}

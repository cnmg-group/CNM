import { track } from '../analytics.js';
import { api } from '../api.js';
import { formData, setBusy, validate } from '../ui.js';

export function init() {
  const form = document.querySelector('[data-enquiry-form]');
  if (!form) return;
  const ok = form.querySelector('[data-enquiry-ok]');
  const err = form.querySelector('[data-enquiry-err]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!validate(form)) return;
    const btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true, 'Sending');
    try {
      const data = formData(form);
      await api('/api/enquiry', { method: 'POST', body: data });
      track('generate_lead', { lead_type: 'fragrance_as_a_service', sector: data.sector });
      form.querySelectorAll('.field, .form-row, .check, button').forEach((n) => { n.hidden = true; });
      ok.hidden = false;
      ok.textContent = 'Thank you. Your enquiry has been received and the CNM team will be in touch.';
      ok.focus?.();
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message || 'We couldn’t send your enquiry. Please try again.';
      setBusy(btn, false);
    }
  });
}

// GA4-compatible e-commerce events. Pushed to dataLayer always; sent to GA only after consent; mirrored to the first-party collector.
window.dataLayer = window.dataLayer || [];
const CONSENT_KEY = 'cnm.consent';

export const consent = () => { try { return localStorage.getItem(CONSENT_KEY); } catch { return null; } };

export function item(p, extra = {}) {
  return { item_id: p.id, item_name: p.name, item_brand: 'CNM Essentials', item_category: p.category, price: p.price?.amount ?? p.price, ...extra };
}

export function track(name, params = {}) {
  window.dataLayer.push({ event: name, ...params });
  if (typeof window.gtag === 'function' && consent() === 'granted') window.gtag('event', name, params);
  try {
    const body = JSON.stringify({ name, params: { ...params, path: location.pathname } });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
  } catch { /* analytics must never break the page */ }
}

export function loadGA(id) {
  if (!id || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
}

export function initConsent() {
  const id = document.body.dataset.ga;
  const box = document.querySelector('[data-consent]');
  const render = () => {
    box.hidden = false;
    box.innerHTML = `<div class="toast" style="position:fixed;left:16px;right:16px;bottom:16px;max-width:560px;margin:auto;z-index:130;display:grid;gap:12px;background:#111" role="dialog" aria-label="Cookie preferences">
      <p style="margin:0">We use essential cookies to run the store. With your permission we also use analytics cookies to improve it.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--light" data-consent-yes type="button">Accept analytics</button><button class="btn btn--ghost-light" data-consent-no type="button">Essential only</button> <a class="textlink" href="/privacy/" style="align-self:center">Privacy</a></div></div>`;
  };
  const set = (v) => { try { localStorage.setItem(CONSENT_KEY, v); } catch { /* ignore */ } box.hidden = true; box.innerHTML = ''; if (v === 'granted') loadGA(id); };
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-consent-yes]')) set('granted');
    if (e.target.closest('[data-consent-no]')) set('denied');
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-consent-open]')) render(); });
  const c = consent();
  if (c === 'granted') loadGA(id);
  else if (!c && id) render();
}

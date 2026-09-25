// Panels (drawers, overlays), header behaviour, toasts, rails and scroll reveals.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
let openPanel = null;
let lastFocus = null;
const scrim = () => document.querySelector('[data-scrim]');

export function open(name) {
  const panel = document.querySelector(`[data-panel="${name}"]`);
  if (!panel) return;
  if (openPanel && openPanel !== panel) close();
  lastFocus = document.activeElement;
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  scrim()?.classList.add('is-on');
  document.documentElement.style.overflow = 'hidden';
  document.querySelectorAll(`[data-open="${name}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
  openPanel = panel;
  const target = panel.querySelector('[data-search-input]') || panel.querySelector(FOCUSABLE);
  setTimeout(() => target?.focus(), 60);
  panel.dispatchEvent(new CustomEvent('panel:open'));
}

export function close() {
  if (!openPanel) return;
  const panel = openPanel;
  panel.classList.remove('is-open');
  scrim()?.classList.remove('is-on');
  document.documentElement.style.overflow = '';
  document.querySelectorAll(`[data-open="${panel.dataset.panel}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
  setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 450);
  openPanel = null;
  lastFocus?.focus?.();
}

export function toast(message, { action, href } = {}) {
  const region = document.querySelector('[data-toasts]');
  if (!region) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span></span>${href ? `<a href="${href}">${action}</a>` : ''}`;
  t.firstChild.textContent = message;
  region.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

export function initUI() {
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) { e.preventDefault(); open(opener.dataset.open); return; }
    if (e.target.closest('[data-close]') || e.target.matches('[data-scrim]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); closeMega(); }
    if (e.key === 'Tab' && openPanel) {
      const f = [...openPanel.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Overlay header becomes solid after the hero
  const header = document.querySelector('[data-header]');
  if (header?.classList.contains('site-header--overlay')) {
    const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mega menu (hover on desktop pointers, click/keyboard everywhere)
  const toggle = document.querySelector('[data-mega-toggle]');
  const mega = document.querySelector('[data-mega]');
  if (toggle && mega) {
    let t;
    const show = () => { clearTimeout(t); mega.classList.add('is-open'); toggle.setAttribute('aria-expanded', 'true'); header?.classList.add('is-solid'); };
    const hide = () => { t = setTimeout(() => { mega.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); if (window.scrollY <= 40) header?.classList.remove('is-solid'); }, 120); };
    toggle.addEventListener('click', () => (mega.classList.contains('is-open') ? closeMega() : show()));
    if (matchMedia('(hover: hover)').matches) {
      [toggle, mega].forEach((n) => { n.addEventListener('mouseenter', show); n.addEventListener('mouseleave', hide); });
    }
    mega.addEventListener('focusout', (e) => { if (!mega.contains(e.relatedTarget) && e.relatedTarget !== toggle) closeMega(); });
  }

  // Rails
  document.querySelectorAll('[data-rail-controls]').forEach((c) => {
    const rail = document.querySelector(`[data-rail="${c.dataset.railControls}"]`);
    if (!rail) return;
    const step = () => rail.clientWidth * 0.8;
    c.querySelector('[data-rail-prev]')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    c.querySelector('[data-rail-next]')?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
  });

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach((r) => io.observe(r));
  } else reveals.forEach((r) => r.classList.add('is-in'));
}

function closeMega() {
  const mega = document.querySelector('[data-mega]');
  mega?.classList.remove('is-open');
  document.querySelector('[data-mega-toggle]')?.setAttribute('aria-expanded', 'false');
}

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${label || 'Please wait'}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

export function formData(form) {
  const o = {};
  for (const [k, v] of new FormData(form)) o[k] = typeof v === 'string' ? v.trim() : v;
  form.querySelectorAll('input[type="checkbox"][name]').forEach((c) => { o[c.name] = c.checked; });
  return o;
}

/** Native validation with accessible inline messages. Returns true when valid. */
export function validate(form) {
  let first = null;
  form.querySelectorAll('input, select, textarea').forEach((f) => {
    if (!f.name || f.type === 'hidden' || f.closest('[hidden]')) return;
    const field = f.closest('.field');
    field?.querySelector('.err')?.remove();
    f.removeAttribute('aria-invalid');
    if (!f.checkValidity()) {
      first ||= f;
      f.setAttribute('aria-invalid', 'true');
      if (field) {
        const m = document.createElement('span');
        m.className = 'err';
        m.id = `${f.id || f.name}-err`;
        m.textContent = f.validity.valueMissing ? 'This field is required.' : f.validity.typeMismatch ? 'Please enter a valid value.' : f.validity.tooShort ? `Use at least ${f.minLength} characters.` : f.validationMessage;
        field.appendChild(m);
        f.setAttribute('aria-describedby', m.id);
      }
    }
  });
  first?.focus();
  return !first;
}

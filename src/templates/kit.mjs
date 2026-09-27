// Shared building blocks for the CNM Group hub and every company site: sharp responsive images, form fields,
// enquiry forms, the floating CNM navigation and sister-company links.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';

// Photos are stored at 2000 px for sharp high-density screens, with a 1000 px copy for phones.
const PUBLIC = fileURLToPath(new URL('../../public', import.meta.url));
export const srcset = (src, sizes, full = 2000) => {
  if (!src?.endsWith('.webp')) return '';
  const small = src.replace(/\.webp$/, '-1000.webp');
  return existsSync(PUBLIC + small) ? ` srcset="${small} 1000w, ${src} ${full}w" sizes="${sizes}"` : '';
};

/** <img> for a photo: sharp source set, explicit size, optional focal point. */
export function photo(src, alt, { sizes = '100vw', width = 2000, height = 1530, position, lazy = true, cls = '', priority = false } = {}) {
  if (!src) return '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${src}"${srcset(src, sizes, width)} alt="${escapeHtml(alt || '')}" width="${width}" height="${height}"${lazy && !priority ? ' loading="lazy"' : ''}${priority ? ' fetchpriority="high"' : ''} decoding="async"${position ? ` style="object-position:${position}"` : ''}>`;
}

export const field = (id, label, input, hint = '') => `<div class="field"><label for="${id}">${label}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
export const select = (id, name, opts, { required = true, blank = 'Please choose' } = {}) =>
  `<select id="${id}" name="${name}"${required ? ' required' : ''}>${blank === null ? '' : `<option value="">${blank}</option>`}${opts.map((o) => (Array.isArray(o) ? `<option value="${escapeHtml(o[0])}">${escapeHtml(o[1])}</option>` : `<option>${escapeHtml(o)}</option>`)).join('')}</select>`;
export const phoneInput = (id, { required = true } = {}) => `<input id="${id}" name="phone" type="tel" autocomplete="tel" inputmode="tel"${required ? ' required' : ''} placeholder="+234">`;
export const message = (id, { required = true, placeholder = '', rows = 5 } = {}) => `<textarea id="${id}" name="message"${required ? ' required minlength="10"' : ''} maxlength="3000" rows="${rows}"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}></textarea>`;

/**
 * Enquiry form posting to /api/enquiry (stored in Admin → Enquiries, emailed when CNM_NOTIFY_EMAIL is set).
 * `fields(x)` renders the company-specific fields; name, email and consent are always included.
 */
export function enquiryForm({ key, division, title, intro = '', subject = '', success, fields, submit = 'Send', cls = '' }) {
  const x = `f-${key}`;
  return `<form class="form site-form${cls ? ` ${cls}` : ''}" data-enquiry-form data-division="${division}" data-success="${escapeHtml(success)}" novalidate>
    ${title ? `<h2 class="site-form__title">${escapeHtml(title)}</h2>` : ''}
    ${intro ? `<p class="muted" style="margin:0">${escapeHtml(intro)}</p>` : ''}
    <div class="alert alert--ok" role="status" data-enquiry-ok hidden tabindex="-1"></div>
    <div class="alert alert--err" role="alert" data-enquiry-err hidden></div>
    <input type="hidden" name="sector" value="group"><input type="hidden" name="division" value="${division}">${subject ? `<input type="hidden" name="subject" value="${escapeHtml(subject)}">` : ''}
    <div class="form-row">${field(`${x}-name`, 'Full name', `<input id="${x}-name" name="name" autocomplete="name" required>`)}${field(`${x}-email`, 'Email address', `<input id="${x}-email" name="email" type="email" autocomplete="email" required>`)}</div>
    ${fields(x)}
    <label class="check"><input type="checkbox" name="consent" value="true" required> I agree to CNM Group contacting me about this request. See the <a class="textlink" href="/privacy/">privacy notice</a>.</label>
    <input type="text" name="website" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">
    <button class="btn site-btn" type="submit">${escapeHtml(submit)}</button>
  </form>`;
}

export const COMPANY_LINKS = [
  { key: 'essentials', name: 'CNM Essentials', href: '/essentials/', label: 'Fragrance & Lifestyle', logo: '/assets/brand/cnm-logo-on-light.svg', tint: '#b99a5b' },
  { key: 'spectra', name: 'CNM Spectra', href: '/spectra/', label: 'Eyewear', logo: '/assets/brand/cnm-spectra-logo.webp', tint: '#1f9cc4' },
  { key: 'cnmworx', name: 'CNMWorX', href: '/cnmworx/', label: 'Engineering & Energy', logo: '/assets/brand/cnmworx-logo.webp', tint: '#d9921c' },
  { key: 'foundation', name: 'CNM Foundation', href: '/foundation/', label: 'Social Impact', logo: '/assets/brand/cnm-foundation-logo.webp', tint: '#3f8f2f' },
];

/**
 * The universal CNM navigation: one floating glass control on every page of every CNM website.
 * A click on the CNM Group emblem goes home to CNMGroup.com; hovering (mouse) or the switch button (touch)
 * fans out the sister companies for instant switching. Behaviour lives in motion.js (initCnmNav).
 */
export function cnmNav(current) {
  const others = COMPANY_LINKS.filter((c) => c.key !== current);
  const items = others.map((c, i) => `<li style="--i:${others.length - 1 - i};--tint:${c.tint}"><a class="cnmnav__item" href="${c.href}" data-track="cnmnav_switch" data-from="${current}" data-to="${c.key}" tabindex="-1">
      <span class="cnmnav__icon"><img src="${c.logo}" alt="" loading="lazy" decoding="async"></span>
      <span class="cnmnav__text"><strong>${c.name}</strong><small>${escapeHtml(c.label)}</small></span>
      <span class="cnmnav__go">${icon('arrow')}</span>
    </a></li>`).join('');
  return `<div class="cnmnav" data-cnmnav data-current="${current}">
  <nav class="cnmnav__panel" id="cnmnav-panel" aria-label="CNM Group companies">
    <p class="cnmnav__title">CNM Group companies</p>
    <ul class="cnmnav__list">${items}</ul>
  </nav>
  <div class="cnmnav__dock">
    <a class="cnmnav__home" href="/" data-cnmnav-home data-track="cnmnav_home" data-from="${current}" aria-label="CNM Group home">
      <span class="cnmnav__orb"><img src="/assets/brand/cnm-group-emblem-128.webp" alt="" width="128" height="134"></span>
      <span class="cnmnav__word"><strong>CNM</strong> Group</span>
    </a>
    <button type="button" class="cnmnav__toggle" data-cnmnav-toggle aria-expanded="false" aria-controls="cnmnav-panel" aria-label="Switch to another CNM company">
      <span class="cnmnav__dots" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </button>
  </div>
</div>`;
}

export const mailto = (email) => `<a class="textlink" href="mailto:${email}">${escapeHtml(email)}</a>`;
export const tel = (phone) => `<a class="textlink" href="tel:${phone.replace(/\s/g, '')}">${escapeHtml(phone)}</a>`;

/** Light/dark switch (sun ↔ moon). Behaviour in motion.js; the theme is applied early by /assets/theme.js. */
export const themeToggle = (cls = '') => `<button class="icon-btn theme-toggle${cls ? ` ${cls}` : ''}" type="button" data-theme-toggle aria-label="Switch to dark mode" title="Light / dark mode">
  <svg class="tt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/></svg>
  <svg class="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
</button>`;

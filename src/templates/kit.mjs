// Shared building blocks for the CNM Group hub and every company site: sharp responsive images, form fields,
// enquiry forms, the "Back to CNM Group" bar and sister-company links.
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
  { key: 'essentials', name: 'CNM Essentials', href: '/essentials/' },
  { key: 'spectra', name: 'CNM Spectra', href: '/spectra/' },
  { key: 'cnmworx', name: 'CNMWorX', href: '/cnmworx/' },
  { key: 'foundation', name: 'CNM Foundation', href: '/foundation/' },
];

/**
 * "Back to CNM Group" navigation on every company site (incl. CNM Essentials):
 * desktop shows the sister companies as tabs; phones get a compact company switcher; and a floating
 * "CNM Group" pill appears once the bar scrolls away (see motion.js).
 */
export function backBar(current) {
  const here = COMPANY_LINKS.find((c) => c.key === current);
  const emblem = '<img class="backbar__emblem" src="/assets/brand/cnm-group-emblem-128.webp" alt="" width="128" height="134">';
  return `<div class="backbar" data-backbar><div class="container backbar__row">
    <a class="backbar__home" href="/" data-track="back_to_group" data-from="${current}"><span class="backbar__arrow">${icon('arrowLeft')}</span>${emblem}<span class="backbar__label"><span class="backbar__hint">Back to</span> CNM Group</span></a>
    <nav class="backbar__switch" aria-label="CNM Group companies">
      <ul class="backbar__tabs">${COMPANY_LINKS.map((c) => `<li><a href="${c.href}"${c.key === current ? ' aria-current="true"' : ''}>${c.name}</a></li>`).join('')}</ul>
      <div class="backbar__drop" data-drop>
        <button type="button" class="backbar__dropbtn" data-drop-toggle aria-expanded="false" aria-controls="backbar-companies"><span class="backbar__hint">You’re in</span> <strong>${here ? here.name : 'CNM Group'}</strong>${icon('chevron')}</button>
        <div class="backbar__panel" id="backbar-companies" data-drop-panel>
          <a class="backbar__panel-home" href="/">${emblem}<span><strong>CNM Group</strong><span>Home of all our companies</span></span></a>
          ${COMPANY_LINKS.map((c) => `<a href="${c.href}"${c.key === current ? ' aria-current="true"' : ''}>${c.name}${c.key === current ? '<span class="backbar__here">You’re here</span>' : icon('arrow')}</a>`).join('')}
        </div>
      </div>
    </nav>
  </div></div>
  <a class="backpill" href="/" data-backpill aria-label="Back to CNM Group home" data-track="back_to_group_pill" data-from="${current}"><span class="backpill__arrow">${icon('arrowLeft')}</span>${emblem}<span>CNM Group</span></a>`;
}

export const mailto = (email) => `<a class="textlink" href="mailto:${email}">${escapeHtml(email)}</a>`;
export const tel = (phone) => `<a class="textlink" href="tel:${phone.replace(/\s/g, '')}">${escapeHtml(phone)}</a>`;

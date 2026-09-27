// Company websites (CNM Spectra, CNMWorX, CNM Foundation): each has its own identity (logo, colours, navigation,
// footer) and always shows a clear "Back to CNM Group" button. CNM Essentials uses the shop chrome in layout.mjs.
import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { breadcrumbs } from './layout.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { backBar, COMPANY_LINKS, mailto, photo, tel } from './kit.mjs';

// Use the cut-out logo when it has been generated; otherwise fall back to the original file.
const PUBLIC = fileURLToPath(new URL('../../public', import.meta.url));
const logo = (base) => (existsSync(`${PUBLIC}${base}.webp`) ? `${base}.webp` : `${base}.jpg`);

export const SITES = {
  spectra: {
    key: 'spectra', name: 'CNM Spectra', home: '/spectra/', logo: logo('/assets/brand/cnm-spectra-logo'),
    blurb: 'Premium eyewear from CNM Group. See better, feel better, look your best.',
    nav: [['eyewear', 'Eyewear', '/spectra/eyewear/', [['Prescription eyewear', '/spectra/eyewear/#prescription'], ['Sunglasses & fashion frames', '/spectra/eyewear/#sunglasses'], ['Contact lens solutions', '/spectra/eyewear/#contact-lenses'], ['Eyewear accessories', '/spectra/eyewear/#accessories']]], ['eye-care', 'Eye care', '/spectra/eye-care/'], ['about', 'About', '/spectra/about/'], ['contact', 'Visit & contact', '/spectra/contact/']],
    cta: ['Book an appointment', '/spectra/book/'],
  },
  cnmworx: {
    key: 'cnmworx', name: 'CNMWorX Limited', home: '/cnmworx/', logo: logo('/assets/brand/cnmworx-logo'),
    blurb: 'ISO 9001:2015-certified engineering and technical services from CNM Group.',
    nav: [['services', 'Services', '/cnmworx/services/', [['EPC project delivery', '/cnmworx/services/#epc'], ['Automation & control systems', '/cnmworx/services/#automation'], ['Instrumentation & power electronics', '/cnmworx/services/#instrumentation'], ['Lifecycle maintenance & O&M', '/cnmworx/services/#maintenance']]], ['industries', 'Industries', '/cnmworx/industries/', [['Oil & gas engineering', '/cnmworx/industries/#oil-gas'], ['Industrial automation', '/cnmworx/industries/#industrial'], ['Power & energy systems', '/cnmworx/industries/#power'], ['ICT & systems integration', '/cnmworx/industries/#ict']]], ['quality', 'Quality', '/cnmworx/quality/'], ['about', 'About', '/cnmworx/about/'], ['contact', 'Contact', '/cnmworx/contact/']],
    cta: ['Request a proposal', '/cnmworx/request/'],
  },
  foundation: {
    key: 'foundation', name: 'CNM Foundation', home: '/foundation/', logo: logo('/assets/brand/cnm-foundation-logo'),
    blurb: 'The social impact and philanthropic arm of CNM Group.',
    nav: [['programmes', 'Programmes', '/foundation/programmes/', [['Education & literacy', '/foundation/programmes/#education'], ["Women's economic empowerment", '/foundation/programmes/#women'], ['Youth development & skills', '/foundation/programmes/#youth'], ['Community health', '/foundation/programmes/#health']]], ['get-involved', 'Get involved', '/foundation/get-involved/'], ['about', 'About', '/foundation/about/'], ['contact', 'Contact', '/foundation/contact/']],
    cta: ['Donate', '/foundation/donate/'],
  },
};

export const profileOf = (ctx, key) => ctx.site.group.profiles.find((p) => p.slug === key);

export function companyHeader(ctx, key, current) {
  const s = SITES[key];
  const cur = (k) => (k === current ? ' aria-current="page"' : '');
  const links = s.nav.map(([k, label, href, kids]) => (kids
    ? `<li class="co-drop" data-drop><a href="${href}"${cur(k)}>${escapeHtml(label)}</a><button type="button" class="co-drop__btn" data-drop-toggle aria-expanded="false" aria-controls="drop-${k}" aria-label="${escapeHtml(label)} menu">${icon('chevron')}</button>
      <div class="co-drop__panel" id="drop-${k}" data-drop-panel><a class="co-drop__all" href="${href}">All ${escapeHtml(label.toLowerCase())} ${icon('arrow')}</a>${kids.map(([l, h]) => `<a href="${h}">${escapeHtml(l)}</a>`).join('')}</div></li>`
    : `<li><a href="${href}"${cur(k)}>${escapeHtml(label)}</a></li>`)).join('');
  const menu = [['home', 'Home', s.home], ...s.nav].map(([k, label, href, kids]) => `<li><a href="${href}"${cur(k)}>${escapeHtml(label)}</a>${kids ? `<ul class="co-menu__sub">${kids.map(([l, h]) => `<li><a href="${h}">${escapeHtml(l)}</a></li>`).join('')}</ul>` : ''}</li>`).join('');
  return `${backBar(key)}
<header class="co-header" data-co-header>
  <div class="container co-header__row">
    <a class="co-logo" href="${s.home}" aria-label="${escapeHtml(s.name)} — home"><img src="${s.logo}" alt="${escapeHtml(s.name)}" height="56"></a>
    <nav aria-label="${escapeHtml(s.name)}"><ul class="co-nav">${links}</ul></nav>
    <div class="co-header__right">
      <a class="btn site-btn co-cta" href="${s.cta[1]}"${current === 'cta' ? ' aria-current="page"' : ''}>${escapeHtml(s.cta[0])}</a>
      <details class="co-menu" data-co-menu>
        <summary class="icon-btn" aria-label="Menu"><span class="gm-open">${icon('menu')}</span><span class="gm-close">${icon('close')}</span></summary>
        <div class="co-menu__panel">
          <nav aria-label="${escapeHtml(s.name)} menu"><ul class="co-menu__list">${menu}</ul></nav>
          <a class="btn site-btn btn--block" href="${s.cta[1]}">${escapeHtml(s.cta[0])}</a>
          <a class="co-menu__back" href="/">${icon('arrowLeft')} Back to CNM Group</a>
        </div>
      </details>
    </div>
  </div>
</header>`;
}

export function companyFooter(ctx, key) {
  const s = SITES[key];
  const g = ctx.site.group;
  return `<footer class="co-footer">
  <div class="container">
    <div class="co-footer__grid">
      <div class="co-footer__brand">
        <a href="${s.home}" class="co-footer__logo" aria-label="${escapeHtml(s.name)} — home"><img src="${s.logo}" alt="${escapeHtml(s.name)}" loading="lazy"></a>
        <p>${escapeHtml(s.blurb)}</p>
        <a class="co-footer__back" href="/" data-track="back_to_group" data-from="${key}">${icon('arrowLeft')} Back to CNM Group</a>
      </div>
      <div><h2>${escapeHtml(s.name)}</h2><ul><li><a href="${s.home}">Home</a></li>${s.nav.map(([, label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('')}<li><a href="${s.cta[1]}">${escapeHtml(s.cta[0])}</a></li></ul></div>
      <div><h2>CNM Group</h2><ul><li><a href="/">CNMGroup.com</a></li>${COMPANY_LINKS.filter((c) => c.key !== key).map((c) => `<li><a href="${c.href}">${c.name}</a></li>`).join('')}</ul></div>
      <div><h2>Contact</h2><ul><li>${mailto(g.contact.email)}</li><li>${tel(g.contact.phone)}</li><li class="muted">${escapeHtml(g.contact.address)}</li></ul></div>
    </div>
    <div class="co-footer__bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(s.name)} · Part of CNM Group</span><span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <button type="button" data-consent-open class="textlink" style="font-size:inherit;color:inherit">Cookie settings</button></span></div>
  </div>
</footer>`;
}

/* ---------------- page sections shared by the company sites ---------------- */
export function crumbsFor(ctx, key, trail) {
  const s = SITES[key];
  return breadcrumbs(ctx, [{ name: s.name, path: s.home }, ...trail], { name: 'CNM Group', path: '/' });
}

/** Full-bleed photo hero with copy beside it (desktop) or below it (phone). No text is laid over artwork. */
export function coHero({ eyebrow, title, lead, image, imageAlt, position, width = 2000, height = 1530, ctas = [], note = '' }) {
  return `<section class="co-hero" aria-labelledby="co-hero-h"><div class="container co-hero__grid">
  <div class="co-hero__copy">
    ${eyebrow ? `<span class="co-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
    <h1 id="co-hero-h" class="co-title">${title}</h1>
    ${lead ? `<p class="co-lead">${escapeHtml(lead)}</p>` : ''}
    ${ctas.length ? `<div class="co-ctas">${ctas.map(([label, href, ghost]) => `<a class="btn site-btn${ghost ? ' site-btn--ghost' : ''}" href="${href}">${escapeHtml(label)}</a>`).join('')}</div>` : ''}
    ${note}
  </div>
  ${image ? `<div class="co-hero__media" style="--ar:${width} / ${height}">${photo(image, imageAlt, { sizes: '(max-width: 960px) 100vw, 50vw', position, priority: true, width, height })}</div>` : ''}
</div></section>`;
}

export function pageHead(ctx, key, { eyebrow, title, lead, trail }) {
  const crumbs = crumbsFor(ctx, key, trail);
  return { crumbs, html: `<section class="co-pagehead"><div class="container">${crumbs.html}
  ${eyebrow ? `<span class="co-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
  <h1 class="co-title co-title--page">${title}</h1>
  ${lead ? `<p class="co-lead">${escapeHtml(lead)}</p>` : ''}
</div></section>` };
}

export const sectionHead = (eyebrow, title, lead = '', id = '') => `<header class="co-sechead">${eyebrow ? `<span class="co-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}<h2${id ? ` id="${id}"` : ''} class="co-h2">${title}</h2>${lead ? `<p class="co-lead">${escapeHtml(lead)}</p>` : ''}</header>`;

/** Cards: [{ title, text, href?, cta?, icon?, id? }] */
export const cards = (items, { cols = 4 } = {}) => `<div class="co-cards co-cards--${cols}">${items.map((c, i) => {
  const inner = `<span class="co-card__num">${String(i + 1).padStart(2, '0')}</span><h3 class="co-card__title">${escapeHtml(c.title)}</h3>${c.text ? `<p>${escapeHtml(c.text)}</p>` : ''}${c.href ? `<span class="co-card__link">${escapeHtml(c.cta || 'Learn more')} ${icon('arrow')}</span>` : ''}`;
  return c.href ? `<a class="co-card" href="${c.href}"${c.id ? ` id="${c.id}"` : ''}>${inner}</a>` : `<article class="co-card"${c.id ? ` id="${c.id}"` : ''}>${inner}</article>`;
}).join('')}</div>`;

export const ctaBand = (title, text, ctas) => `<section class="co-band"><div class="container co-band__row"><div><h2 class="co-h2">${title}</h2>${text ? `<p class="co-lead">${escapeHtml(text)}</p>` : ''}</div><div class="co-ctas">${ctas.map(([label, href, ghost]) => `<a class="btn site-btn${ghost ? ' site-btn--ghost' : ' site-btn--invert'}" href="${href}">${escapeHtml(label)}</a>`).join('')}</div></div></section>`;

export const contactBlock = (ctx) => {
  const g = ctx.site.group;
  return `<div class="info-list">
    <div>${icon('mail')}<div><strong>Email</strong><br>${mailto(g.contact.email)}</div></div>
    <div>${icon('phone')}<div><strong>Call</strong><br>${tel(g.contact.phone)}</div></div>
    <div>${icon('pin')}<div><strong>CNM Group head office</strong><br>${escapeHtml(g.contact.address)}</div></div>
  </div>`;
};

export const orgLd = (ctx, key, extra = {}) => {
  const p = profileOf(ctx, key);
  const s = SITES[key];
  return { '@context': 'https://schema.org', '@type': 'Organization', name: p.name, ...(p.fullName ? { legalName: p.fullName } : {}), url: `${ctx.siteUrl}${s.home}`, logo: `${ctx.siteUrl}${s.logo}`, slogan: p.tagline, description: p.text, parentOrganization: { '@type': 'Organization', name: 'CNM Group', url: ctx.siteUrl }, ...extra };
};

/** "Continue exploring" card that leads to the next page in the site's natural order. */
export const nextPage = ({ href, label, eyebrow }) => `<section class="next-page" aria-label="Next page"><div class="container"><a class="next-page__link" href="${href}"><span class="next-page__eyebrow">${escapeHtml(eyebrow)}</span><span class="next-page__title">${escapeHtml(label)}</span><span class="next-page__arrow">${icon('arrow')}</span></a></div></section>`;

export function labelFor(key, current) {
  const s = SITES[key];
  if (current === 'home') return `${s.name} home`;
  if (current === 'cta') return s.cta[0];
  return s.nav.find(([k]) => k === current)?.[1] || s.name;
}

/* Icons for the company pillars (from the CNM banners): 24px, stroke-based. */
const PILLAR_ICONS = {
  glasses: '<circle cx="6.5" cy="13" r="3.5"/><circle cx="17.5" cy="13" r="3.5"/><path d="M10 13h4M3 13 2 9M21 13l1-4"/>',
  sunglasses: '<path d="M2 10h20M3 10c0 4 1.5 6 4.5 6S11 14 11 10M13 10c0 4 1.5 6 4.5 6S21 14 21 10" /><path d="M11 10.5h2"/>',
  lens: '<ellipse cx="12" cy="12" rx="8" ry="5" transform="rotate(-30 12 12)"/><path d="M8.5 13.5c2-3 5-4.5 7.5-4"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  hardhat: '<path d="M3 17h18M5 17v-2a7 7 0 0 1 14 0v2M10 8V5h4v3M8 10.5 9 8M16 10.5 15 8"/>',
  building: '<path d="M4 21V5l8-3v19M12 9h8v12M3 21h18M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z"/>',
  cap: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  people: '<circle cx="12" cy="8" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20a5.5 5.5 0 0 1 11 0M1.5 19a4 4 0 0 1 5-3.5M22.5 19a4 4 0 0 0-5-3.5"/>',
  book: '<path d="M12 6c-2-1.5-5-2-9-2v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2Z"/><path d="M12 6v14"/>',
  heart: '<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20Z"/>',
};
const pillarIcon = (k) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PILLAR_ICONS[k] || ''}</svg>`;

/** The company's three words, tagline and four pillars, as supplied on the CNM banners. */
export function pillarsStrip(p) {
  const b = p.banner;
  if (!b) return '';
  return `<section class="co-pillars" aria-label="${escapeHtml(b.words.join(', '))}"><div class="container">
  <div class="co-pillars__head"><p class="co-pillars__words">${b.words.map((w) => `<span>${escapeHtml(w)}</span>`).join('')}</p><p class="co-pillars__tagline">${escapeHtml(b.tagline)}</p></div>
  <ul class="co-pillars__list">${b.pillars.map(([k, label]) => `<li><span class="co-pillars__icon">${pillarIcon(k)}</span><span>${escapeHtml(label)}</span></li>`).join('')}</ul>
</div></section>`;
}

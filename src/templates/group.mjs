// CNMGroup.com — the main hub: group header/footer, Home, About and Contact.
// Each company has its own site (/essentials/, /spectra/, /cnmworx/, /foundation/) with its own identity.
// Company facts come from cnm-group.net (content/site.json → group). Anything unverified is marked for approval.
import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { approval, breadcrumbs } from './layout.mjs';
import { enquiryForm, field, mailto, message, phoneInput, photo, select, tel, themeToggle } from './kit.mjs';

const GROUP_HOME = { name: 'CNM Group', path: '/' };

export function groupHeader(ctx, current) {
  const g = ctx.site.group;
  const companiesActive = g.profiles.some((p) => p.slug === current);
  const drop = `<li class="gdrop" data-drop><button type="button" class="gdrop__btn" data-drop-toggle aria-expanded="false" aria-controls="gdrop-companies"${companiesActive ? ' aria-current="page"' : ''}>Companies ${icon('chevron')}</button>
    <div class="gdrop__panel" id="gdrop-companies" data-drop-panel><div class="container gdrop__grid">
      ${g.profiles.map((p) => `<a class="gdrop__co" href="${p.page}"><span class="gdrop__logo"><img src="${p.logo}" alt="" loading="lazy"></span><span><strong>${escapeHtml(p.name)}</strong><span class="gdrop__sub">${escapeHtml(p.menuLabel)}</span><span class="gdrop__tag">${escapeHtml(p.tagline)}</span></span></a>`).join('')}
    </div></div></li>`;
  const item = (key, label, href) => `<li><a href="${href}"${key === current ? ' aria-current="page"' : ''}>${label}</a></li>`;
  const links = `${item('about', 'About', '/about/')}${drop}${item('leadership', 'Leadership', '/about/#leadership')}${item('contact', 'Contact', '/contact/')}`;
  const menu = [
    { href: '/', name: 'Home', key: 'home' },
    { href: '/about/', name: 'About CNM Group', key: 'about' },
    ...g.profiles.map((p) => ({ href: p.page, name: p.name, sub: p.menuLabel, key: p.slug })),
    { href: '/contact/', name: 'Contact', key: 'contact' },
  ].map((m) => `<li><a href="${m.href}"${m.key === current ? ' aria-current="page"' : ''}><span class="gmenu__name">${escapeHtml(m.name)}</span>${m.sub ? `<span class="gmenu__sub">${escapeHtml(m.sub)}</span>` : ''}</a></li>`).join('');
  return `<header class="group-header" data-group-header>
  <div class="container group-header__row">
    <a class="group-logo" href="/" aria-label="CNM Group — home"><img src="${g.logo}" alt="" width="1600" height="1488"></a>
    <nav aria-label="CNM Group"><ul class="group-nav">${links}</ul></nav>
    <div class="group-header__right">
      ${themeToggle()}
      <a class="btn group-store" href="/essentials/shop/" data-track="group_visit_store">${icon('bag')} <span>Shop</span></a>
      <details class="group-menu" data-group-menu>
        <summary class="icon-btn" aria-label="Menu"><span class="gm-open">${icon('menu')}</span><span class="gm-close">${icon('close')}</span></summary>
        <div class="gmenu"><nav aria-label="CNM Group menu"><ul class="gmenu__list">${menu}</ul></nav>
          <a class="gbtn gbtn--gold gmenu__store" href="/essentials/shop/">Shop CNM Essentials ${icon('arrow')}</a></div>
      </details>
    </div>
  </div>
</header>`;
}

export function groupFooter(ctx) {
  const g = ctx.site.group;
  const HQ = { 'Lagos, Nigeria': 'Group HQ', 'Dallas, Texas': 'US operations' };
  return `<footer class="gfooter">
  <div class="container">
    <div class="gfooter__grid">
      <div class="gfooter__brand">
        <a class="gfooter__logo" href="/" aria-label="CNM Group — home"><img src="${g.logo}" alt="" width="1600" height="1488" loading="lazy"></a>
        <p class="gfooter__tagline">Creating sustainable businesses that transcend industries.</p>
        <p class="gfooter__motto">${escapeHtml(g.motto)}</p>
      </div>
      <div><h2>Companies</h2><ul>${g.profiles.map((p) => `<li><a href="${p.page}">${escapeHtml(p.name)}</a></li>`).join('')}</ul></div>
      <div><h2>Offices</h2><ul>${g.ecosystem.locations.map(([c]) => `<li>${escapeHtml(c)}${HQ[c] ? ` — ${HQ[c]}` : ''}</li>`).join('')}<li><a href="/about/">About CNM Group</a></li></ul></div>
      <div><h2>Get in touch</h2><ul>
        <li><a href="mailto:${g.contact.email}">${escapeHtml(g.contact.email)}</a></li>
        <li><a href="tel:${g.contact.phone.replace(/\s/g, '')}">${escapeHtml(g.contact.phone)}</a></li>
        <li class="gfooter__addr">${escapeHtml(g.contact.address)}</li>
        <li><a href="/contact/">Contact the Group</a></li>
      </ul></div>
    </div>
    <div class="gfooter__bottom">
      <span>© ${new Date().getFullYear()} CNM Group. All rights reserved.</span>
      <span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <button type="button" data-consent-open class="textlink" style="font-size:inherit;color:inherit">Cookie settings</button></span>
    </div>
  </div>
</footer>`;
}

/* ---------------- Home ---------------- */
function companyPanel(p, i) {
  const cta = p.internal ? 'Shop CNM Essentials' : `Visit ${p.name.replace(' Limited', '')}`;
  const media = p.image
    ? photo(p.image, p.imageAlt, { sizes: '(max-width: 960px) 100vw, 50vw', position: p.imagePosition, width: p.imageWidth || 2000, height: p.imageHeight || 1530 })
    : `<span class="gpanel__logo"><img src="${p.logo}" alt="" loading="lazy" width="200" height="200"></span>`;
  return `<a class="gpanel${p.image ? '' : ' gpanel--plain'}" href="${p.page}" data-track="group_company" data-company="${p.slug}">
    <span class="gpanel__media">${media}</span>
    ${p.image ? `<span class="gpanel__badge"><img src="${p.logo}" alt="${escapeHtml(p.name)} logo" loading="lazy"></span>` : ''}
    <span class="gpanel__copy">
      <span class="gpanel__eyebrow">${String(i + 1).padStart(2, '0')} — ${escapeHtml(p.menuLabel || p.sector)}</span>
      <span class="gpanel__name">${escapeHtml(p.name)}</span>
      <span class="gpanel__tag">${escapeHtml(p.tagline)}</span>
      <span class="gbtn gbtn--line">${cta} ${icon('arrow')}</span>
    </span>
  </a>`;
}

const founderFigure = (f, { priority = false } = {}) => (f.portrait
  ? `<figure class="ghero__portrait">${photo(f.portrait, `${f.name}, ${f.title}`, { sizes: '(max-width: 960px) 92vw, 45vw', width: 2000, height: 2186, priority, lazy: !priority })}<figcaption>${escapeHtml(f.name)} · ${escapeHtml(f.title)}</figcaption></figure>`
  : approval('Founder portrait.'));

export function groupHome(ctx) {
  const g = ctx.site.group;
  const f = g.founder;
  const body = `<section class="ghero" aria-labelledby="grp-h">
  <div class="container ghero__grid">
    ${founderFigure(f, { priority: true })}
    <div class="ghero__copy">
      <span class="geyebrow">CNM Group${g.since ? ` · Since ${g.since}` : ''}</span>
      <h1 id="grp-h" class="ghero__title">Creating sustainable businesses that <em>transcend</em> industries.</h1>
      <p class="ghero__lead">${escapeHtml(g.intro)}</p>
      <div class="ghero__cta"><a class="gbtn gbtn--gold" href="#companies">Our companies ${icon('arrow')}</a><a class="gbtn gbtn--line" href="/about/">About the Group</a></div>
      <dl class="gstats">${g.stats.map(([n, l]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(n)}</dd></div>`).join('')}</dl>
    </div>
  </div>
</section>
${(() => { const words = ['Energy', 'Retail', 'Impact', g.motto, ...g.profiles.map((p) => p.name)]; const row = words.map((w) => `<span>${escapeHtml(w)}</span>`).join(''); return `<div class="gticker" aria-hidden="true"><div class="gticker__track">${row}${row}</div></div>`; })()}
<section class="gdark" id="companies" aria-labelledby="co-h"><div class="container">
  <span class="geyebrow">Our companies · Energy · Retail · Impact</span>
  <h2 id="co-h" class="gtitle gtitle--light">Four businesses. <em>One vision.</em></h2>
  <p class="gdark__lead">${escapeHtml(g.companiesIntro.text)} Each company has its own website: choose one to step inside.</p>
  <div class="gpanels">${g.profiles.map(companyPanel).join('')}</div>
</div></section>
${f.quote ? `<section class="gquote" id="leadership" aria-label="From our founder"><div class="container gquote__inner">
  <blockquote><p>“${escapeHtml(f.quote)}”</p></blockquote>
  <div class="gquote__by"><strong>${escapeHtml(f.name)}</strong><span>${escapeHtml(f.title)}</span></div>
  <a class="gbtn gbtn--gold" href="/about/#leadership">Meet our founder ${icon('arrow')}</a>
</div></section>` : ''}
<section class="gcream" id="who-we-are" aria-labelledby="who-h"><div class="container group-split">
  <div class="stack">
    <span class="geyebrow geyebrow--ink">Who we are</span>
    <h2 id="who-h" class="gtitle">A founder-led family of companies across <em>lifestyle</em>, <em>engineering</em> and <em>social impact</em>.</h2>
    <p class="lead">${escapeHtml(g.about)} ${escapeHtml(g.ecosystem.text)}</p>
    <p class="gmotto">${escapeHtml(g.motto)}</p>
    <a class="btn site-btn" href="/about/" style="justify-self:start">More about CNM Group</a>
  </div>
  ${photo(g.ecosystem.image, 'CNM Group reception', { cls: 'group-split__img', sizes: '(max-width: 960px) 100vw, 50vw', height: 1659 })}
</div></section>
<section class="gdark gdark--cta"><div class="container center stack"><h2 class="gtitle gtitle--light">Interested in partnering with CNM Group?</h2><p class="gdark__lead" style="margin-inline:auto">Whether you're looking to collaborate, invest, or explore our companies, we'd love to hear from you.</p><div class="ghero__cta" style="justify-content:center"><a class="gbtn gbtn--gold" href="/contact/">Get in touch ${icon('arrow')}</a><a class="gbtn gbtn--line" href="/essentials/shop/">Shop CNM Essentials</a></div></div></section>`;
  return { body, jsonld: [organization(ctx)] };
}

function organization(ctx) {
  const g = ctx.site.group;
  const f = g.founder;
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'CNM Group', url: ctx.siteUrl, logo: `${ctx.siteUrl}${g.logoPng || g.logo}`, slogan: g.motto,
    ...(g.since ? { foundingDate: String(g.since) } : {}), email: g.contact.email, telephone: g.contact.phone,
    address: { '@type': 'PostalAddress', streetAddress: g.contact.address, addressCountry: 'NG' },
    founder: { '@type': 'Person', name: f.name, jobTitle: f.title, ...(f.portrait ? { image: `${ctx.siteUrl}${f.portrait}` } : {}) },
    subOrganization: g.profiles.map((p) => ({ '@type': 'Organization', name: p.name, url: `${ctx.siteUrl}${p.page}` })),
  };
}

/* ---------------- About ---------------- */
export function groupAbout(ctx) {
  const g = ctx.site.group;
  const f = g.founder;
  const crumbs = breadcrumbs(ctx, [{ name: 'About', path: '/about/' }], GROUP_HOME);
  const body = `<section class="gpage-hero"><div class="container">${crumbs.html}
  <span class="geyebrow">About CNM Group</span>
  <h1 class="gtitle gtitle--light">${escapeHtml(g.headline)}</h1>
  <p class="gdark__lead">${escapeHtml(g.intro)}</p>
</div></section>
<section class="gcream" aria-labelledby="ab-h"><div class="container group-split">
  <div class="stack">
    <span class="geyebrow geyebrow--ink">Who we are</span>
    <h2 id="ab-h" class="gtitle">${escapeHtml(g.ecosystem.title)}</h2>
    <p class="lead">${escapeHtml(g.about)}</p>
    <p>${escapeHtml(g.ecosystem.text)}</p>
    <div class="search-chips">${g.ecosystem.pills.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join('')}</div>
    <p class="gmotto">${escapeHtml(g.motto)}</p>
  </div>
  ${photo(g.ecosystem.image, 'CNM Group reception', { cls: 'group-split__img', sizes: '(max-width: 960px) 100vw, 50vw', height: 1659 })}
</div></section>
<section class="gdark" id="leadership" aria-labelledby="ld-h"><div class="container ghero__grid">
  ${founderFigure(f)}
  <div class="ghero__copy">
    <span class="geyebrow">Leadership</span>
    <h2 id="ld-h" class="gtitle gtitle--light">${escapeHtml(f.name)}</h2>
    <p class="gquote__by" style="border:0;padding:0"><span>${escapeHtml(f.title)}</span></p>
    ${f.quote ? `<blockquote class="gquote"><p>“${escapeHtml(f.quote)}”</p></blockquote>` : ''}
    <p class="ghero__lead">CNM Group is privately held and founder-led. ${escapeHtml(f.name)} leads the group across its lifestyle, engineering and social impact businesses.</p>
    ${approval('Founder biography.', 'Please supply the approved biography to publish here.')}
  </div>
</div></section>
<section class="section" aria-labelledby="dv-h"><div class="container">
  <span class="geyebrow geyebrow--ink">Energy · Retail · Impact</span>
  <h2 id="dv-h" class="gtitle">${escapeHtml(g.companiesIntro.title)}</h2>
  <div class="gdivisions">${g.divisions.map((d) => `<section class="gdivision" aria-labelledby="dv-${d.key}">
    <span class="geyebrow geyebrow--ink">${escapeHtml(d.name)}</span>
    <h3 id="dv-${d.key}" class="gdivision__title">${escapeHtml(d.summary)}</h3>
    ${d.companies.map((c) => { const p = g.profiles.find((x) => x.slug === c.slug); return `<a class="gdivision__co" href="${c.url}"><img src="${c.logo}" alt="" width="72" height="72" loading="lazy"><span><strong>${escapeHtml(c.name)}</strong><br><span class="muted">${escapeHtml(c.tagline)}</span></span>${icon('arrow')}</a>`; }).join('')}
  </section>`).join('')}</div>
</div></section>
<section class="gcream" aria-labelledby="loc-h"><div class="container group-split">
  <div class="stack">
    <span class="geyebrow geyebrow--ink">Where we operate</span>
    <h2 id="loc-h" class="gtitle">Rooted in Africa, <em>positioned for the world</em>.</h2>
    <dl class="gstats gstats--ink">${g.stats.map(([n, l]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(n)}</dd></div>`).join('')}</dl>
  </div>
  <ul class="gloc-list">${g.ecosystem.locations.map(([c, d]) => `<li class="group-loc">${icon('pin')}<span><strong>${escapeHtml(c)}</strong><br><span class="muted">${escapeHtml(d)}</span></span></li>`).join('')}</ul>
</div></section>`;
  return { body, jsonld: [crumbs.ld, organization(ctx)] };
}

/* ---------------- Contact ---------------- */
export function groupContactPage(ctx) {
  const g = ctx.site.group;
  const crumbs = breadcrumbs(ctx, [{ name: 'Contact', path: '/contact/' }], GROUP_HOME);
  const subjects = ['General Enquiry', 'Partnership', 'Investment', 'Collaboration', 'Media', 'Careers', ...g.profiles.map((p) => p.name)];
  const body = `<section class="gpage-hero gpage-hero--short"><div class="container">${crumbs.html}
  <span class="geyebrow">Contact us</span>
  <h1 class="gtitle gtitle--light">Get in touch</h1>
  <p class="gdark__lead">Whether you're looking to partner, invest, collaborate, or learn more about our companies, we'd love to hear from you.</p>
</div></section>
<section class="section" aria-label="Contact details and form"><div class="container group-split group-split--form">
  <div class="stack">
    <div class="info-list">
      <div>${icon('mail')}<div><strong>Email us</strong><br>${mailto(g.contact.email)}</div></div>
      <div>${icon('phone')}<div><strong>Call us</strong><br>${tel(g.contact.phone)}</div></div>
      <div>${icon('pin')}<div><strong>Head office</strong><br>${escapeHtml(g.contact.address)}</div></div>
    </div>
    <ul>${g.ecosystem.locations.map(([c, d]) => `<li class="group-loc">${icon('pin')}<span><strong>${escapeHtml(c)}</strong><br><span class="muted">${escapeHtml(d)}</span></span></li>`).join('')}</ul>
    <div class="box"><strong>Looking for one of our companies?</strong><ul class="gcontact-links">${g.profiles.map((p) => `<li><a class="textlink" href="${p.page}${p.slug === 'essentials' ? 'contact/' : 'contact/'}">${escapeHtml(p.name)}</a></li>`).join('')}</ul></div>
  </div>
  ${enquiryForm({ key: 'group', division: 'group', title: 'Send us a message', success: 'Thank you. Your message has been received and CNM Group will be in touch.', fields: (x) => `
    <div class="form-row">${field(`${x}-co`, 'Company / organisation (optional)', `<input id="${x}-co" name="company" autocomplete="organization">`)}${field(`${x}-phone`, 'Phone (optional)', phoneInput(`${x}-phone`, { required: false }))}</div>
    ${field(`${x}-subject`, 'Subject', select(`${x}-subject`, 'subject', subjects, { blank: 'Choose a subject' }))}
    ${field(`${x}-msg`, 'Message', message(`${x}-msg`, { placeholder: 'How can we help you?' }))}` })}
</div></section>`;
  return { body, jsonld: [crumbs.ld, { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact CNM Group', url: `${ctx.siteUrl}/contact/` }] };
}

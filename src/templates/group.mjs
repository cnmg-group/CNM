// CNM Group corporate pages: group chrome (header/footer), overview, company pages and contact.
// Company facts come from cnm-group.net (content/site.json → group). Anything unverified is marked for approval.
import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { approval, breadcrumbs } from './layout.mjs';

const GROUP_NAV = [
  { key: 'overview', label: 'Overview', href: '/cnm-group/' },
  { key: 'spectra', label: 'Spectra', href: '/cnm-group/spectra/' },
  { key: 'cnmworx', label: 'CNMWorX', href: '/cnm-group/cnmworx/' },
  { key: 'foundation', label: 'Foundation', href: '/cnm-group/foundation/' },
  { key: 'contact', label: 'Contact', href: '/cnm-group/contact/' },
];

export function groupHeader(ctx, current) {
  const g = ctx.site.group;
  const links = GROUP_NAV.map((n) => `<li><a href="${n.href}"${n.key === current ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('');
  const menu = [
    { href: '/cnm-group/', name: 'Home', key: 'overview' },
    ...g.profiles.map((p) => ({ href: p.page || '/', name: p.name, sub: p.menuLabel, key: p.slug })),
    { href: '/cnm-group/contact/', name: 'Contact', key: 'contact' },
  ].map((m) => `<li><a href="${m.href}"${m.key === current ? ' aria-current="page"' : ''}><span class="gmenu__name">${escapeHtml(m.name)}</span>${m.sub ? `<span class="gmenu__sub">${escapeHtml(m.sub)}</span>` : ''}</a></li>`).join('');
  return `<header class="group-header" data-group-header>
  <div class="container group-header__row">
    <a class="group-logo" href="/cnm-group/" aria-label="CNM Group — home"><img src="${g.logo}" alt="" width="480" height="480"><span>CNM Group</span></a>
    <nav aria-label="CNM Group"><ul class="group-nav">${links}</ul></nav>
    <div class="group-header__right">
      <a class="btn btn--green group-store" href="/" data-track="group_visit_store">${icon('bag')} <span>Visit store</span></a>
      <details class="group-menu" data-group-menu>
        <summary class="icon-btn" aria-label="Menu"><span class="gm-open">${icon('menu')}</span><span class="gm-close">${icon('close')}</span></summary>
        <div class="gmenu"><nav aria-label="CNM Group menu"><ul class="gmenu__list">${menu}</ul></nav>
          <a class="gbtn gbtn--gold gmenu__store" href="/">Visit the CNM Essentials store ${icon('arrow')}</a></div>
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
        <a class="gfooter__logo" href="/cnm-group/" aria-label="CNM Group — home"><img src="${g.logo}" alt="" width="480" height="480" loading="lazy"></a>
        <p class="gfooter__tagline">Creating sustainable businesses that transcend industries.</p>
        <p class="gfooter__motto">${escapeHtml(g.motto)}</p>
      </div>
      <div><h2>Companies</h2><ul>${g.profiles.map((p) => `<li><a href="${p.page || '/'}">${escapeHtml(p.name)}</a></li>`).join('')}</ul></div>
      <div><h2>Offices</h2><ul>${g.ecosystem.locations.map(([c]) => `<li>${escapeHtml(c)}${HQ[c] ? ` — ${HQ[c]}` : ''}</li>`).join('')}<li><a href="/cnm-group/contact/">Contact the Group</a></li></ul></div>
      <div><h2>Get in touch</h2><ul>
        <li><a href="mailto:${g.contact.email}">${escapeHtml(g.contact.email)}</a></li>
        <li><a href="tel:${g.contact.phone.replace(/\s/g, '')}">${escapeHtml(g.contact.phone)}</a></li>
        <li class="gfooter__addr">${escapeHtml(g.contact.address)}</li>
      </ul></div>
    </div>
    <div class="gfooter__bottom">
      <span>© ${new Date().getFullYear()} CNM Group. All rights reserved.</span>
      <span><a href="/privacy/">Privacy</a> · <button type="button" data-consent-open class="textlink" style="font-size:inherit;color:inherit">Cookie settings</button></span>
    </div>
  </div>
</footer>`;
}

/* ---------------- Overview ---------------- */
function companyPanel(p, i) {
  const href = p.page || '/';
  const cta = p.internal ? 'Visit the store' : 'Explore';
  const media = p.image
    ? `<img src="${p.image}" alt="${escapeHtml(p.imageAlt || '')}" loading="lazy" width="1179" height="900"${p.imagePosition ? ` style="object-position:${p.imagePosition}"` : ''}>`
    : `<span class="gpanel__logo"><img src="${p.logo}" alt="" loading="lazy" width="200" height="200"></span>`;
  return `<a class="gpanel${p.image ? '' : ' gpanel--plain'}" href="${href}" data-track="group_company" data-company="${p.slug}">
    <span class="gpanel__media">${media}</span>
    <span class="gpanel__copy">
      <span class="gpanel__eyebrow">${String(i + 1).padStart(2, '0')} — ${escapeHtml(p.menuLabel || p.sector)}</span>
      <span class="gpanel__name">${escapeHtml(p.name)}</span>
      <span class="gpanel__tag">${escapeHtml(p.tagline)}</span>
      <span class="gbtn gbtn--line">${cta} ${icon('arrow')}</span>
    </span>
  </a>`;
}

export function groupHome(ctx) {
  const g = ctx.site.group;
  const f = g.founder;
  const body = `<section class="ghero" aria-labelledby="grp-h">
  <div class="container ghero__grid">
    ${f.portrait ? `<figure class="ghero__portrait"><img src="${f.portrait}" alt="${escapeHtml(f.name)}, ${escapeHtml(f.title)}" width="1062" height="1142" fetchpriority="high"><figcaption>${escapeHtml(f.name)} · ${escapeHtml(f.title)}</figcaption></figure>` : ''}
    <div class="ghero__copy">
      <span class="geyebrow">CNM Group${g.since ? ` · Since ${g.since}` : ''}</span>
      <h1 id="grp-h" class="ghero__title">Creating sustainable businesses that <em>transcend</em> industries.</h1>
      <p class="ghero__lead">${escapeHtml(g.intro)}</p>
      <div class="ghero__cta"><a class="gbtn gbtn--gold" href="#companies">Our companies ${icon('arrow')}</a><a class="gbtn gbtn--line" href="/cnm-group/contact/">Get in touch</a></div>
      <dl class="gstats">${g.stats.map(([n, l]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(n)}</dd></div>`).join('')}</dl>
    </div>
  </div>
</section>
${f.quote ? `<section class="gquote" id="leadership" aria-label="From our founder"><div class="container gquote__inner">
  <blockquote><p>“${escapeHtml(f.quote)}”</p></blockquote>
  <div class="gquote__by"><strong>${escapeHtml(f.name)}</strong><span>${escapeHtml(f.title)}</span></div>
  <a class="gbtn gbtn--gold" href="#who-we-are">Discover CNM ${icon('arrow')}</a>
</div></section>` : ''}
<section class="gcream" id="who-we-are" aria-labelledby="who-h"><div class="container group-split">
  <div class="stack">
    <span class="geyebrow geyebrow--ink">Who we are</span>
    <h2 id="who-h" class="gtitle">A founder-led family of companies across <em>lifestyle</em>, <em>engineering</em> and <em>social impact</em>.</h2>
    <p class="lead">${escapeHtml(g.about)} ${escapeHtml(g.ecosystem.text)}</p>
    <p class="gmotto">${escapeHtml(g.motto)}</p>
    <ul>${g.ecosystem.locations.map(([c, d]) => `<li class="group-loc">${icon('pin')}<span><strong>${escapeHtml(c)}</strong><br><span class="muted">${escapeHtml(d)}</span></span></li>`).join('')}</ul>
  </div>
  <img class="group-split__img" src="${g.ecosystem.image}" alt="CNM Group reception" width="1020" height="846" loading="lazy">
</div></section>
<section class="gdark" id="companies" aria-labelledby="co-h"><div class="container">
  <span class="geyebrow">Our companies · Energy · Retail · Impact</span>
  <h2 id="co-h" class="gtitle gtitle--light">Four businesses. <em>One vision.</em></h2>
  <p class="gdark__lead">${escapeHtml(g.companiesIntro.text)}</p>
  <div class="gpanels">${g.profiles.map(companyPanel).join('')}</div>
</div></section>
${f.quote ? '' : `<section class="gcream" id="leadership"><div class="container">${approval('Founder quote.', 'Please supply approved words.')}</div></section>`}
<section class="gdark gdark--cta"><div class="container center stack"><h2 class="gtitle gtitle--light">Interested in partnering with CNM Group?</h2><p class="gdark__lead" style="margin-inline:auto">Whether you're looking to collaborate, invest, or explore our companies, we'd love to hear from you.</p><div class="ghero__cta" style="justify-content:center"><a class="gbtn gbtn--gold" href="/cnm-group/contact/">Get in touch ${icon('arrow')}</a><a class="gbtn gbtn--line" href="/">Visit CNM Essentials</a></div></div></section>`;
  return { body, jsonld: [{ '@context': 'https://schema.org', '@type': 'Organization', name: 'CNM Group', url: g.url, logo: `${ctx.siteUrl}${g.logo}`, slogan: g.motto, ...(g.since ? { foundingDate: String(g.since) } : {}), founder: { '@type': 'Person', name: f.name, jobTitle: f.title, ...(f.portrait ? { image: `${ctx.siteUrl}${f.portrait}` } : {}) }, subOrganization: g.divisions.flatMap((d) => d.companies.map((c) => ({ '@type': 'Organization', name: c.name }))) }] };
}

/* ---------------- Company pages ---------------- */
const field = (id, label, input, hint = '') => `<div class="field"><label for="${id}">${label}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const select = (id, name, opts, { required = true, blank = 'Please choose' } = {}) => `<select id="${id}" name="${name}"${required ? ' required' : ''}><option value="">${blank}</option>${opts.map((o) => `<option>${escapeHtml(o)}</option>`).join('')}</select>`;

const FORMS = {
  spectra: (p) => ({
    title: 'Book an optical consultation',
    intro: 'Tell us what you’re looking for and where you’d like to visit. The CNM Spectra team will contact you to confirm a time.',
    subject: 'Spectra consultation',
    success: 'Thank you. CNM Spectra has your request and will contact you to confirm your consultation.',
    fields: (x) => `
      <div class="form-row">${field(`${x}-phone`, 'Phone', `<input id="${x}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+234">`)}${field(`${x}-loc`, 'Preferred location', select(`${x}-loc`, 'location', p.places))}</div>
      <div class="form-row">${field(`${x}-int`, 'I’m interested in', select(`${x}-int`, 'interest', [...p.lists[0][1], 'Something else']))}${field(`${x}-date`, 'Preferred date (optional)', `<input id="${x}-date" name="eventDate" type="date">`)}</div>
      ${field(`${x}-msg`, 'Anything we should know?', `<textarea id="${x}-msg" name="message" required minlength="10" maxlength="3000" placeholder="e.g. I need new prescription frames and would like to see sunglasses too."></textarea>`, 'Please don’t include medical records here. We’ll discuss details in person.')}`,
  }),
  cnmworx: (p) => ({
    title: 'Request a project or tender',
    intro: 'Share the scope, location and timing of your project. CNMWorX will respond to qualified project and tender requests.',
    subject: 'CNMWorX project request',
    success: 'Thank you. CNMWorX has received your project request and will be in touch.',
    fields: (x) => `
      <div class="form-row">${field(`${x}-co`, 'Company / organisation', `<input id="${x}-co" name="company" autocomplete="organization" required>`)}${field(`${x}-phone`, 'Phone', `<input id="${x}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+234">`)}</div>
      <div class="form-row">${field(`${x}-int`, 'Service area', select(`${x}-int`, 'interest', [...p.lists[0][1], ...p.lists[1][1].filter((s) => s.startsWith('ICT'))]))}${field(`${x}-loc`, 'Project location', `<input id="${x}-loc" name="location" placeholder="Site, city or state" required>`)}</div>
      <div class="form-row">${field(`${x}-time`, 'Timeline', select(`${x}-time`, 'timeline', ['Immediate', 'Within 3 months', '3–6 months', '6 months or more', 'Tender / bid with a deadline']))}${field(`${x}-date`, 'Tender or bid deadline (optional)', `<input id="${x}-date" name="eventDate" type="date">`)}</div>
      ${field(`${x}-msg`, 'Scope of work', `<textarea id="${x}-msg" name="message" required minlength="10" maxlength="3000" placeholder="Describe the scope, facility, systems involved and any standards or certifications required."></textarea>`, 'Don’t attach or paste confidential tender documents here. The team will arrange a secure exchange.')}`,
  }),
  foundation: (p) => ({
    title: 'Partner, volunteer or support',
    intro: 'Whether you represent an organisation or want to give your time, tell us how you’d like to get involved.',
    subject: 'Foundation enquiry',
    success: 'Thank you. CNM Foundation has your message and will be in touch.',
    fields: (x) => `
      <div class="form-row">${field(`${x}-phone`, 'Phone (optional)', `<input id="${x}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+234">`)}${field(`${x}-co`, 'Organisation (optional)', `<input id="${x}-co" name="company" autocomplete="organization">`)}</div>
      <div class="form-row">${field(`${x}-int`, 'I’d like to', select(`${x}-int`, 'interest', ['Partner with the Foundation', 'Volunteer', 'Donate or sponsor a programme', 'Ask about a programme']))}${field(`${x}-area`, 'Focus area', select(`${x}-area`, 'location', p.lists[0][1], { required: false, blank: 'Any' }))}</div>
      ${field(`${x}-msg`, 'Message', `<textarea id="${x}-msg" name="message" required minlength="10" maxlength="3000"></textarea>`)}`,
  }),
};

function enquiryForm({ key, division, title, intro, subject, success, fields }) {
  const x = `f-${key}`;
  return `<form class="form group-form" data-enquiry-form data-division="${division}" data-success="${escapeHtml(success)}" novalidate>
    <h2 class="h3">${escapeHtml(title)}</h2>
    ${intro ? `<p class="muted" style="margin:0">${escapeHtml(intro)}</p>` : ''}
    <div class="alert alert--ok" role="status" data-enquiry-ok hidden tabindex="-1"></div>
    <div class="alert alert--err" role="alert" data-enquiry-err hidden></div>
    <input type="hidden" name="sector" value="group"><input type="hidden" name="division" value="${division}">${subject ? `<input type="hidden" name="subject" value="${escapeHtml(subject)}">` : ''}
    <div class="form-row">${field(`${x}-name`, 'Full name', `<input id="${x}-name" name="name" autocomplete="name" required>`)}${field(`${x}-email`, 'Email address', `<input id="${x}-email" name="email" type="email" autocomplete="email" required>`)}</div>
    ${fields(x)}
    <label class="check"><input type="checkbox" name="consent" value="true" required> I agree to CNM Group contacting me about this message. See our <a class="textlink" href="/privacy/">privacy notice</a>.</label>
    <input type="text" name="website" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">
    <button class="btn btn--green" type="submit">Send</button>
  </form>`;
}

export function companyPage(ctx, slug) {
  const g = ctx.site.group;
  const p = g.profiles.find((x) => x.slug === slug);
  const division = g.divisions.find((d) => d.companies.some((c) => c.slug === slug));
  const form = FORMS[slug](p);
  const crumbs = breadcrumbs(ctx, [{ name: 'CNM Group', path: '/cnm-group/' }, { name: p.name, path: p.page }]);
  const others = g.profiles.filter((x) => x.slug !== slug);
  const body = `<div class="container">${crumbs.html}</div>
<section class="company-hero" aria-labelledby="co-h"><div class="container company-hero__grid">
  <div class="stack">
    <span class="label muted">${escapeHtml(division?.name || '')} · ${escapeHtml(p.sector)}</span>
    <h1 id="co-h" class="h1">${escapeHtml(p.name)}</h1>
    ${p.fullName ? `<p class="muted" style="margin:0">${escapeHtml(p.fullName)}</p>` : ''}
    <p class="h3" style="color:var(--gold-ink);margin:0">${escapeHtml(p.tagline)}</p>
    <p class="lead">${escapeHtml(p.text)}</p>
    <div class="search-chips">${p.places.map((pl) => `<span class="chip">${escapeHtml(pl)}</span>`).join('')}</div>
    <div class="hero__cta"><a class="btn btn--green" href="#enquire">${escapeHtml(form.title)}</a><a class="btn btn--ghost" href="/cnm-group/contact/">Contact the group</a></div>
  </div>
  <div class="company-hero__media">${p.image ? `<img class="company-hero__photo" src="${p.image}" alt="${escapeHtml(p.imageAlt || '')}" width="1179" height="900"${p.imagePosition ? ` style="object-position:${p.imagePosition}"` : ''}>` : ''}<img class="company-hero__logo" src="${p.logo}" alt="${escapeHtml(p.name)} logo" width="480" height="480"><div class="profile__card"><strong>${escapeHtml(p.card[0])}</strong><span class="muted">${escapeHtml(p.card[1])}</span></div></div>
</div></section>
<section class="section section--cream section--tight"><div class="container">
  <div class="cards-2 company-lists">${p.lists.map(([h, items]) => `<div><h2 class="label">${escapeHtml(h)}</h2><ul>${items.map((i) => `<li>${icon('check')} ${escapeHtml(i)}</li>`).join('')}</ul></div>`).join('')}</div>
  <div class="box" style="margin-top:32px"><span class="label">Key value proposition</span><p style="margin:0">${escapeHtml(p.value)}</p></div>
</div></section>
<section class="section" id="enquire" aria-label="${escapeHtml(form.title)}"><div class="container group-split group-split--form">
  <div class="stack">
    <span class="label muted">${escapeHtml(p.name)}</span><h2 class="h1">${escapeHtml(form.title)}</h2><p class="lead">${escapeHtml(form.intro)}</p>
    <div class="info-list">
      <div>${icon('mail')}<div><strong>Email</strong><br><a class="textlink" href="mailto:${g.contact.email}">${escapeHtml(g.contact.email)}</a></div></div>
      <div>${icon('phone')}<div><strong>Call</strong><br><a class="textlink" href="tel:${g.contact.phone.replace(/\s/g, '')}">${escapeHtml(g.contact.phone)}</a></div></div>
    </div>
    ${approval(`A dedicated ${p.name} email, phone and address.`, 'Requests go to the CNM Group inbox and the admin enquiries list until CNM confirms company contacts.')}
  </div>
  ${enquiryForm({ key: slug, division: slug, ...form, intro: '' })}
</div></section>
<section class="section section--tight" aria-labelledby="oth-h"><div class="container">
  <h2 id="oth-h" class="label muted" style="margin-bottom:16px">More from CNM Group</h2>
  <div class="company-others">${others.map((o) => `<a class="group-company group-company--compact" href="${o.page || '/'}"><img src="${o.logo}" alt="" width="64" height="64" loading="lazy"><span><strong>${escapeHtml(o.name)}</strong><br><span class="muted">${escapeHtml(o.tagline)}</span></span></a>`).join('')}</div>
</div></section>`;
  return { body, jsonld: [crumbs.ld, { '@context': 'https://schema.org', '@type': 'Organization', name: p.name, ...(p.fullName ? { legalName: p.fullName } : {}), slogan: p.tagline, description: p.text, logo: `${ctx.siteUrl}${p.logo}`, parentOrganization: { '@type': 'Organization', name: 'CNM Group', url: g.url } }] };
}

/* ---------------- Contact ---------------- */
export function groupContactPage(ctx) {
  const g = ctx.site.group;
  const crumbs = breadcrumbs(ctx, [{ name: 'CNM Group', path: '/cnm-group/' }, { name: 'Contact', path: '/cnm-group/contact/' }]);
  const subjects = ['General Enquiry', 'Partnership', 'Investment', 'Collaboration', 'Media', 'Careers', ...g.profiles.map((p) => p.name)];
  const body = `<div class="container">${crumbs.html}</div>
<section class="section" style="padding-top:16px" aria-labelledby="gc-h"><div class="container group-split group-split--form">
  <div class="stack">
    <span class="label muted">Contact us</span><h1 id="gc-h" class="h1">Get in touch</h1>
    <p class="lead">Whether you're looking to partner, invest, collaborate, or learn more about our companies, we'd love to hear from you.</p>
    <div class="info-list">
      <div>${icon('mail')}<div><strong>Email us</strong><br><a class="textlink" href="mailto:${g.contact.email}">${escapeHtml(g.contact.email)}</a></div></div>
      <div>${icon('phone')}<div><strong>Call us</strong><br><a class="textlink" href="tel:${g.contact.phone.replace(/\s/g, '')}">${escapeHtml(g.contact.phone)}</a></div></div>
      <div>${icon('pin')}<div><strong>Head office</strong><br>${escapeHtml(g.contact.address)}</div></div>
    </div>
    <ul>${g.ecosystem.locations.map(([c, d]) => `<li class="group-loc">${icon('pin')}<span><strong>${escapeHtml(c)}</strong><br><span class="muted">${escapeHtml(d)}</span></span></li>`).join('')}</ul>
    <p class="muted" style="font-size:.875rem">Shopping enquiry? <a class="textlink" href="/contact/">Contact CNM Essentials customer care</a>.</p>
  </div>
  ${enquiryForm({ key: 'group', division: 'group', title: 'Send us a message', intro: '', subject: '', success: 'Thank you. Your message has been received and CNM Group will be in touch.', fields: (x) => `
    <div class="form-row">${field(`${x}-co`, 'Company / organisation (optional)', `<input id="${x}-co" name="company" autocomplete="organization">`)}${field(`${x}-phone`, 'Phone (optional)', `<input id="${x}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+234">`)}</div>
    ${field(`${x}-subject`, 'Subject', select(`${x}-subject`, 'subject', subjects, { blank: 'Choose a subject' }))}
    ${field(`${x}-msg`, 'Message', `<textarea id="${x}-msg" name="message" required minlength="10" maxlength="3000" placeholder="How can we help you?"></textarea>`)}` })}
</div></section>`;
  return { body, jsonld: [crumbs.ld, { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact CNM Group', url: `${ctx.siteUrl}/cnm-group/contact/` }] };
}

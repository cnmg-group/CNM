import { productCardHTML } from '../shared/card.mjs';
import { escapeHtml, formatDate } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { articleCard } from './home.mjs';
import { approval, breadcrumbs, butterflySVG } from './layout.mjs';

const art = (name, extra = '') => `<img src="/assets/art/${name}.svg" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${extra}">`;

/* ---------------- Our story ---------------- */
export function storyPage(ctx) {
  const s = ctx.story;
  const { site } = ctx;
  const g = site.group;
  const { html, ld } = breadcrumbs(ctx, [{ name: 'Our story', path: '/our-story/' }]);
  const body = `
<section class="hero" style="min-height:88svh" aria-labelledby="story-h">
  <div class="hero__media" aria-hidden="true"><img src="${s.image.src}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:.45"></div>
  <div class="container hero__inner"><span class="label hero__eyebrow">About CNM Essentials</span><h1 id="story-h" class="display" style="max-width:12ch">${escapeHtml(s.headline.value)}</h1>
    <div class="stat-row" style="margin-top:32px">${s.stats.value.map(([n, l]) => `<div><strong>${escapeHtml(n)}</strong><span class="label">${escapeHtml(l)}</span></div>`).join('')}</div></div>
</section>
<div class="container">${html}</div>
<section class="section"><div class="container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:clamp(32px,6vw,96px);align-items:center">
  <div class="stack"><span class="label muted">Lifestyle &amp; wellness</span><h2 class="h1">CNM Essentials</h2><p class="h3" style="color:var(--gold-ink)">${escapeHtml(site.groupTagline.value)}</p></div>
  <div class="prose"><p>${escapeHtml(s.intro.value)}</p><p><strong>${escapeHtml(site.motto.value)}</strong></p></div>
</div></section>
<section class="section section--cream"><div class="container">
  <div class="cards-2">
    <div class="box"><span class="label">Core activities</span><ul>${site.coreActivities.value.map((x) => `<li style="padding:6px 0;display:flex;gap:10px">${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>
    <div class="box"><span class="label">Key products</span><ul>${site.keyProducts.value.map((x) => `<li style="padding:6px 0;display:flex;gap:10px">${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>
  </div>
  <div class="box" style="margin-top:16px"><span class="label">Key value proposition</span><p class="h3" style="font-family:var(--serif);font-weight:400;font-size:1.75rem;line-height:1.25">${escapeHtml(s.philosophy.brand)}</p></div>
</div></section>
<section class="split" aria-labelledby="founder-h">
  <div class="split__media">${s.founder.portrait ? `<img src="${s.founder.portrait}" alt="${escapeHtml(s.founder.name || 'Founder')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : `<img src="/assets/brand/cnm-logo.png" alt="CNM Essentials logo" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#23221e;padding:12%">`}</div>
  <div class="split__copy">
    <span class="label muted">Founder-led</span>
    <h2 id="founder-h" class="h2">${escapeHtml(s.founder.name || 'Part of CNM Group')}</h2>
    <p class="lead">${escapeHtml(s.roots.value)}</p>
    ${s.founder.quote ? `<blockquote class="h3" style="font-family:var(--serif);font-size:2rem;margin:0">“${escapeHtml(s.founder.quote)}”</blockquote>` : approval('Founder name, portrait and personal story.', 'Supply the original founder photograph and CNM-approved words.')}
  </div>
</section>
<section class="section section--green"><div class="container">
  <div class="cards-2" style="gap:48px">
    <div class="stack"><span class="label">Our mission</span><h2 class="h2">Why we exist</h2><p class="lead">${escapeHtml(s.mission.value)}</p></div>
    <div class="stack"><span class="label">Our vision</span><h2 class="h2">Where we're headed</h2><p class="lead">${escapeHtml(s.vision.value)}</p></div>
  </div>
</div></section>
<section class="section"><div class="container">
  <div class="section-head"><div><span class="label muted">Core values</span><h2 class="h2">The principles that define us</h2></div></div>
  <div class="values">${s.values.value.map(([t, d]) => `<div><p class="h3">${escapeHtml(t)}</p><p class="muted" style="margin:0">${escapeHtml(d)}</p></div>`).join('')}</div>
  <p class="muted" style="margin-top:24px;font-size:.8125rem">Mission, vision and values of CNM Group (<a class="textlink" href="/cnm-group/">about the group</a>). ${s.timeline.length ? '' : 'A dated CNM Essentials timeline is pending CNM approval.'}</p>
</div></section>
<section class="section section--cream section--tight"><div class="container center stack"><p class="h2" style="font-family:var(--serif)">${escapeHtml(g.motto)}</p><a class="link" href="/cnm-group/" style="justify-self:center">Discover CNM Group ${icon('arrow')}</a></div></section>`;
  return { body, jsonld: [ld, { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About CNM Essentials', url: `${ctx.siteUrl}/our-story/` }] };
}

/* ---------------- Stores ---------------- */
export function storesIndex(ctx) {
  const { html, ld } = breadcrumbs(ctx, [{ name: 'Stores', path: '/stores/' }]);
  const body = `<div class="container">${html}
  <header class="plp-head"><span class="label muted">Visit CNM</span><h1 class="display" style="font-size:clamp(3rem,8vw,7rem)">Our stores</h1><p class="lead">Experience our fragrances in person, collect online orders and ask about our Lease-to-Own commercial diffusers.</p></header>
  <div class="store-cards" style="padding-bottom:96px">${ctx.stores.map((s) => `<a class="store-card" href="/stores/${s.slug}/" style="background:var(--ink);color:#fff">${s.images?.[0] ? `<img src="${s.images[0].src}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5">` : ''}<div style="position:relative" class="stack"><p class="store-card__city">${escapeHtml(s.city)}</p><p>${escapeHtml(s.address)}${s.region === 'FCT' ? ', FCT' : `, ${escapeHtml(s.region)} State`}</p><p>${escapeHtml(s.phone || '')}</p><span class="link">Store details ${icon('arrow')}</span></div></a>`).join('')}</div>
</div>`;
  return { body, jsonld: [ld] };
}

export function storePage(ctx, s) {
  const { html, ld } = breadcrumbs(ctx, [{ name: 'Stores', path: '/stores/' }, { name: s.city, path: `/stores/${s.slug}/` }]);
  const hours = s.hours ? `<ul>${s.hours.map((h) => `<li style="display:flex;justify-content:space-between;gap:24px"><span>${escapeHtml(h.days)}</span><span>${escapeHtml(h.open)} – ${escapeHtml(h.close)}</span></li>`).join('')}</ul>` : '<span class="muted">Opening hours pending CNM approval</span>';
  const mapQ = encodeURIComponent(s.address ? `${s.address}, ${s.city}` : s.mapQuery);
  const body = `<div class="container">${html}</div>
<section class="store-hero" aria-labelledby="store-h">
  <div class="store-hero__media">${s.images?.[0] ? `<img src="${s.images[0].src}" alt="${escapeHtml(s.images[0].alt)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">${s.images[0].note ? `<div style="position:absolute;inset:auto 24px 24px">${approval(s.images[0].note)}</div>` : ''}` : `<img src="/assets/brand/cnm-logo.png" alt="" style="width:50%;max-width:280px"><div style="position:absolute;inset:auto 24px 24px">${approval(`Original ${s.city} store photography.`)}</div>`}</div>
  <div class="store-hero__copy">
    <span class="label muted">CNM Essentials</span>
    <h1 id="store-h" class="display" style="font-size:clamp(3.5rem,8vw,7rem)">${escapeHtml(s.city)}</h1>
    <div class="info-list">
      <div>${icon('pin')}<div><strong>Address</strong><br>${s.address ? `${escapeHtml(s.address)}, ${escapeHtml(s.region === 'FCT' ? 'FCT' : `${s.region} State`)}` : '<span class="muted">Address pending CNM approval</span>'}</div></div>
      <div>${icon('clock')}<div><strong>Opening hours</strong><br>${hours}</div></div>
      <div>${icon('phone')}<div><strong>Contact</strong><br>${s.phone ? `<a class="textlink" href="tel:${escapeHtml(s.phone)}">${escapeHtml(s.phone)}</a>` : '<span class="muted">Phone pending CNM approval</span>'}</div></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${mapQ}" target="_blank" rel="noopener" data-track="store_directions" data-store="${s.slug}">Get directions</a>${s.phone ? `<a class="btn btn--ghost" href="tel:${escapeHtml(s.phone)}">Call store</a>` : ''}</div>
    ${s.verified ? '' : approval('Store details (NAP) must match the Google Business Profile exactly.', 'LocalBusiness structured data is withheld until verified.')}
    ${s.hours ? '' : approval('Opening hours.', 'Add in Admin → Stores; they also feed the LocalBusiness structured data.')}
  </div>
</section>
<section class="section"><div class="container">
  <div class="cards-2">
    <div class="box"><span class="label">Services in store</span><ul>${s.services.map((x) => `<li style="padding:6px 0;display:flex;gap:10px">${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul>${s.servicesStatus === 'NEEDS_CNM_APPROVAL' ? '<p class="muted" style="font-size:.75rem">Service list pending CNM approval.</p>' : ''}</div>
    <div class="box"><span class="label">Map</span>${s.address ? `<iframe class="map-frame" title="Map of CNM Essentials ${escapeHtml(s.city)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${mapQ}&output=embed"></iframe>` : `<div class="map-frame" style="display:grid;place-items:center;color:var(--mute)">Map shown once the address is approved</div>`}</div>
  </div>
</div></section>
<section class="section section--cream section--tight"><div class="container">
  <div class="section-head"><div><span class="label muted">In store</span><h2 class="h2">Discover in ${escapeHtml(s.city)}</h2></div><a class="link" href="/shop/">Shop online ${icon('arrow')}</a></div>
  <div class="grid-products">${ctx.products.filter((_, i) => i % 5 === 0).slice(0, 4).map((p, i) => productCardHTML(p, { position: i + 1, list: `store_${s.slug}` })).join('')}</div>
</div></section>`;

  const jsonld = [ld];
  if (s.verified && s.address) {
    jsonld.push({
      '@context': 'https://schema.org', '@type': 'Store', name: s.name, url: `${ctx.siteUrl}/stores/${s.slug}/`,
      address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: s.city === 'Lagos' ? 'Lekki, Lagos' : 'Garki, Abuja', addressRegion: s.region, postalCode: s.postalCode, addressCountry: s.country },
      ...(s.geo ? { geo: { '@type': 'GeoCoordinates', latitude: s.geo.lat, longitude: s.geo.lng } } : {}),
      ...(s.phone ? { telephone: s.phone } : {}),
      ...(s.hours ? { openingHours: s.hours.map((h) => `${h.schema} ${h.open}-${h.close}`) } : {}),
      parentOrganization: { '@type': 'Organization', name: 'CNM Essentials', url: ctx.siteUrl },
    });
  }
  return { body, jsonld };
}

/* ---------------- Fragrance as a Service ---------------- */
export function servicesPage(ctx) {
  const sv = ctx.services;
  const { html, ld } = breadcrumbs(ctx, [{ name: 'Fragrance as a Service', path: '/fragrance-as-a-service/' }]);
  const body = `
<section class="hero" style="min-height:92svh" aria-labelledby="svc-h">
  <div class="hero__media" aria-hidden="true"><div class="hero__atmos"></div></div>
  <div class="container hero__inner"><span class="label hero__eyebrow">For business · Fragrance as a Service</span><h1 id="svc-h" class="display" style="max-width:12ch">${escapeHtml(sv.programme.value.name)}</h1><p class="lead">${escapeHtml(sv.programme.value.text)}, in Lagos and Abuja.</p><div class="hero__cta"><a class="btn btn--light" href="#enquire">Start an enquiry</a></div></div>
</section>
<div class="container">${html}</div>
<section class="section section--cream section--tight"><div class="container cards-2">
  <div class="box"><span class="label">What we offer</span><ul>${ctx.site.keyProducts.value.map((x) => `<li style="padding:6px 0;display:flex;gap:10px">${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>
  <div class="box"><span class="label">Lease-to-Own</span><p>${escapeHtml(sv.programme.value.text)}. Terms, pricing and machine specifications are shared on enquiry.</p>${approval('Programme terms and machine specifications.')}</div>
</div></section>
<section class="section"><div class="container">
  <div class="section-head"><div><span class="label muted">Who we scent for</span><h2 class="h2">Spaces &amp; occasions</h2></div></div>
  <div class="sector-grid">${sv.sectors.map((x, i) => `<div><span class="label muted">${String(i + 1).padStart(2, '0')}</span><div><p class="h3">${escapeHtml(x.name)}</p>${x.status === 'NEEDS_CNM_APPROVAL' ? '<span class="demo-tag" style="margin:8px 0 0">Confirm offered</span>' : ''}</div></div>`).join('')}</div>
</div></section>
<section class="section section--green"><div class="container">
  <div class="section-head"><div><span class="label">How it works</span><h2 class="h2" style="margin-top:12px">From brief to atmosphere</h2></div></div>
  <ol class="process">${sv.process.map((p) => `<li><p class="h3">${escapeHtml(p.step)}</p><p class="muted">${escapeHtml(p.text)}</p></li>`).join('')}</ol>
  <div style="margin-top:32px;max-width:560px">${approval('Service process wording.')}</div>
</div></section>
<section class="section"><div class="container">
  <div class="section-head"><div><span class="label muted">Gallery &amp; case studies</span><h2 class="h2">Recent work</h2></div></div>
  ${sv.caseStudies.length ? '' : approval('Service gallery and case studies.', 'Only real, client-approved projects will be shown.')}
</div></section>
<section class="section section--cream" id="enquire" aria-labelledby="enq-h"><div class="container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:clamp(32px,6vw,96px)">
  <div class="stack"><span class="label muted">Enquire</span><h2 id="enq-h" class="h1">Tell us about your space.</h2><p class="lead">We'll respond with next steps. For events, share your date and venue so we can check availability.</p></div>
  <form class="form" data-enquiry-form novalidate>
    <div class="alert alert--ok" role="status" data-enquiry-ok hidden></div>
    <div class="alert alert--err" role="alert" data-enquiry-err hidden></div>
    <div class="form-row"><div class="field"><label for="e-name">Name</label><input id="e-name" name="name" autocomplete="name" required></div><div class="field"><label for="e-company">Company (optional)</label><input id="e-company" name="company" autocomplete="organization"></div></div>
    <div class="form-row"><div class="field"><label for="e-email">Email</label><input id="e-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="e-phone">Phone (optional)</label><input id="e-phone" name="phone" type="tel" autocomplete="tel"></div></div>
    <div class="form-row"><div class="field"><label for="e-sector">Type of project</label><select id="e-sector" name="sector" required><option value="">Select</option>${sv.sectors.map((x) => `<option value="${x.key}">${escapeHtml(x.name)}</option>`).join('')}<option value="other">Other</option></select></div><div class="field"><label for="e-date">Event date (if applicable)</label><input id="e-date" name="eventDate" type="date"></div></div>
    <div class="field"><label for="e-loc">Location</label><input id="e-loc" name="location" placeholder="City / venue"></div>
    <div class="field"><label for="e-msg">Tell us more</label><textarea id="e-msg" name="message" required maxlength="3000"></textarea></div>
    <label class="check"><input type="checkbox" name="consent" value="true" required> I agree to CNM contacting me about this enquiry.</label>
    <input type="text" name="website" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">
    <button class="btn btn--green" type="submit">Send enquiry</button>
  </form>
</div></section>
<section class="section"><div class="container container--narrow">
  <div class="section-head"><h2 class="h2">FAQs</h2></div>
  <div class="accordion">${sv.faqs.map((f) => `<details><summary>${escapeHtml(f.q)}</summary><div class="acc-body">${f.a ? escapeHtml(f.a) : approval('Answer to be supplied by CNM.')}</div></details>`).join('')}</div>
</div></section>`;
  return {
    body,
    jsonld: [ld, { '@context': 'https://schema.org', '@type': 'Service', name: 'Fragrance as a Service', provider: { '@type': 'Organization', name: 'CNM Essentials' }, areaServed: 'NG', serviceType: 'Commercial and event scenting' }],
  };
}

/* ---------------- Journal ---------------- */
export function journalIndex(ctx) {
  const { html, ld } = breadcrumbs(ctx, [{ name: 'Journal', path: '/journal/' }]);
  const [first, ...rest] = ctx.articles;
  const body = `<div class="container">${html}
  <header class="plp-head"><span class="label muted">The CNM Journal</span><h1 class="display" style="font-size:clamp(3rem,8vw,7rem)">Notes on scent</h1></header>
  ${first ? `<a class="split" href="/journal/${first.slug}/" style="min-height:60vh;margin-bottom:64px"><div class="split__media">${art('tile-green')}</div><div class="split__copy" style="background:var(--cream)"><span class="label muted">${escapeHtml(first.category)}</span><h2 class="h1">${escapeHtml(first.title)}</h2><p class="lead">${escapeHtml(first.excerpt)}</p><span class="link">Read ${icon('arrow')}</span></div></a>` : ''}
  <div class="journal-grid" style="padding-bottom:96px">${rest.map((a, i) => articleCard(a, i + 1)).join('')}</div>
</div>`;
  return { body, jsonld: [ld] };
}

export function articlePage(ctx, a) {
  const { html, ld } = breadcrumbs(ctx, [{ name: 'Journal', path: '/journal/' }, { name: a.title, path: `/journal/${a.slug}/` }]);
  const related = (a.related || []).map((id) => ctx.products.find((p) => p.id === id)).filter(Boolean);
  const body = `<div class="container">${html}</div>
<article>
  <header class="section section--tight"><div class="container container--narrow center stack">
    <span class="label muted">${escapeHtml(a.category)}</span>
    <h1 class="h1">${escapeHtml(a.title)}</h1>
    <p class="lead" style="margin-inline:auto">${escapeHtml(a.excerpt)}</p>
    <p class="muted" style="font-size:.8125rem">${escapeHtml(a.author)} · <time datetime="${a.date}">${formatDate(a.date)}</time></p>
    ${a.status?.startsWith('DRAFT') ? approval('Draft article.', 'Editorial copy awaiting CNM review before publication.') : ''}
  </div></header>
  <div style="position:relative;aspect-ratio:21/9;max-height:70vh;overflow:hidden">${art('tile-green')}</div>
  <div class="section section--tight"><div class="container"><div class="prose" style="margin-inline:auto">${a.html}</div></div></div>
</article>
${related.length ? `<section class="section section--cream section--tight"><div class="container"><div class="section-head"><h2 class="h2">Shop the story</h2></div><div class="grid-products">${related.map((p, i) => productCardHTML(p, { position: i + 1, list: `article_${a.slug}` })).join('')}</div></div></section>` : ''}`;
  return {
    body,
    jsonld: [ld, {
      '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt,
      datePublished: a.date, dateModified: a.date, author: { '@type': 'Organization', name: a.author },
      publisher: { '@type': 'Organization', name: 'CNM Essentials', url: ctx.siteUrl },
      mainEntityOfPage: `${ctx.siteUrl}/journal/${a.slug}/`,
    }],
  };
}

/* ---------------- CNM Group hub ---------------- */
export function groupPage(ctx) {
  const g = ctx.site.group;
  const body = `<section class="hero" style="min-height:72svh;background:#1d2b4a" aria-labelledby="grp-h">
  <div class="container hero__inner hero__inner--split">
    <div><img src="${g.logo}" alt="CNM Group — Driven by excellence. Defined by trust." width="480" height="480" style="width:120px;margin-bottom:24px"><span class="label hero__eyebrow">About CNM Group</span><h1 id="grp-h" class="h1" style="max-width:16ch">${escapeHtml(g.headline)}</h1><p class="lead">${escapeHtml(g.intro)}</p>
      <div class="hero__cta"><a class="btn btn--light" href="#divisions">Explore our companies</a><a class="btn btn--ghost-light" href="${g.url}" rel="noopener">cnm-group.net</a></div></div>
    <div class="stat-row">${g.stats.map(([n, l]) => `<div><strong>${escapeHtml(n)}</strong><span class="label">${escapeHtml(l)}</span></div>`).join('')}</div>
  </div>
</section>
<section class="section section--tight"><div class="container center stack"><p class="lead" style="margin-inline:auto">${escapeHtml(g.about)}</p><p class="h2" style="font-family:var(--serif)">${escapeHtml(g.motto)}</p></div></section>
<div class="divisions" id="divisions">${g.divisions.map((d) => `<section class="division" aria-labelledby="div-${d.key}">
  <div class="stack"><span class="label">${escapeHtml(d.name)}</span><p class="display" id="div-${d.key}">${escapeHtml(d.name)}</p><p class="muted">${escapeHtml(d.summary)}</p></div>
  <div>${d.companies.map((c) => `<a class="company" href="${c.url}"${c.internal ? '' : ' rel="noopener"'} data-track="group_division" data-division="${d.key}"><img src="${c.logo}" alt="${escapeHtml(c.name)} logo" loading="lazy"><div><strong>${escapeHtml(c.name)}</strong><p class="muted" style="margin:4px 0">${escapeHtml(c.tagline)}</p>${c.text ? `<p style="font-size:.875rem;margin:0">${escapeHtml(c.text)}</p>` : ''}<span class="link" style="margin-top:8px">${c.internal ? 'Enter the store' : 'Visit'} ${icon('arrow')}</span></div></a>`).join('')}</div>
</section>`).join('')}</div>
<section class="section section--cream section--tight"><div class="container center stack">
  <span class="label muted">Contact CNM Group</span>
  <p><a class="textlink" href="mailto:${g.contact.email}">${escapeHtml(g.contact.email)}</a> · <a class="textlink" href="tel:${g.contact.phone.replace(/\s/g, '')}">${escapeHtml(g.contact.phone)}</a></p>
  <p class="muted">${escapeHtml(g.contact.address)}</p>
  <p class="muted" style="font-size:.75rem">On cnm-group.net, the Retail division's CNM Essentials "Visit Site" link should point to this store.</p>
</div></section>`;
  return { body, jsonld: [{ '@context': 'https://schema.org', '@type': 'Organization', name: 'CNM Group', url: g.url, logo: `${ctx.siteUrl}${g.logo}`, slogan: g.motto, subOrganization: g.divisions.flatMap((d) => d.companies.map((c) => ({ '@type': 'Organization', name: c.name }))) }] };
}

/* ---------------- Info pages ---------------- */
export function infoPage(ctx, { title, path, intro, sections }) {
  const { html, ld } = breadcrumbs(ctx, [{ name: title, path }]);
  const body = `<div class="container">${html}
  <header class="plp-head"><h1 class="h1">${escapeHtml(title)}</h1>${intro ? `<p class="lead">${intro}</p>` : ''}</header>
  <div class="container--narrow stack" style="padding:0 0 96px;margin:0">${sections.join('')}</div>
</div>`;
  return { body, jsonld: [ld] };
}

export function notFoundPage(ctx) {
  return `<section class="section"><div class="container center stack">
  <span class="label muted">404</span><h1 class="h1">This page has drifted away.</h1>
  <p class="lead">The page you're looking for doesn't exist or has moved.</p>
  <div class="hero__cta" style="justify-content:center"><a class="btn" href="/shop/">Shop all</a><button class="btn btn--ghost" type="button" data-open="search">Search</button></div>
  <div class="grid-products" style="margin-top:64px;text-align:left">${ctx.products.slice(0, 4).map((p, i) => productCardHTML(p, { position: i + 1, list: '404' })).join('')}</div>
</div></section>`;
}

/* ---------------- Design system / QA ---------------- */
export function styleguidePage(ctx) {
  const swatches = [['--gold', '#fbcc39'], ['--sage', '#d3dbce'], ['--green (charcoal)', '#23221e'], ['--green-deep', '#121110'], ['--green-soft', '#4a4843'], ['--cream', '#f6f5f0'], ['--sand', '#e9ece4'], ['--stone', '#d3dbce'], ['--ink', '#111111'], ['--mute', '#6d6b66']];
  return `<div class="container" style="padding-block:48px 96px">
  <span class="label muted">Staging · internal</span><h1 class="h1" style="margin:12px 0 48px">CNM design system</h1>
  <section class="stack" style="margin-bottom:64px"><h2 class="label">Colour</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">${swatches.map(([n, v]) => `<div><div style="height:96px;background:${v};border:1px solid var(--line)"></div><p style="font-size:.8125rem;margin-top:8px">${n}<br><span class="muted">${v}</span></p></div>`).join('')}</div></section>
  <section class="stack" style="margin-bottom:64px"><h2 class="label">Typography</h2><p class="display">Display</p><p class="h1">Heading one</p><p class="h2">Heading two</p><p class="h3">Heading three</p><p class="lead">Lead paragraph — calm, generous and brief.</p><p>Body copy in CNM Sans. The quick brown fox jumps over the lazy dog.</p><p class="label">Label / eyebrow</p></section>
  <section class="stack" style="margin-bottom:64px"><h2 class="label">Buttons</h2><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn">Primary</button><button class="btn btn--green">Green</button><button class="btn btn--ghost">Ghost</button><a class="link" href="#">Text link ${icon('arrow')}</a></div></section>
  <section class="stack" style="margin-bottom:64px"><h2 class="label">Form</h2><div class="form" style="max-width:420px"><div class="field"><label for="sg1">Email</label><input id="sg1" type="email" placeholder="name@example.com"></div><label class="toggle"><span>Order updates</span><input type="checkbox" checked></label></div></section>
  <section class="stack" style="margin-bottom:64px"><h2 class="label">Approval slot</h2><div style="max-width:420px">${approval('Any unverified fact.', 'Shown until CNM approves the content.')}</div></section>
  <section class="stack" style="margin-bottom:64px" id="loader"><h2 class="label">Butterfly loader</h2><p class="muted">Two wings drift together and merge into a droplet. Shown only after 250 ms of real network latency, removed the moment content is ready. Reduced-motion users see a gentle fade.</p>
    <div style="display:flex;gap:48px;flex-wrap:wrap;align-items:center"><div class="cnm-loader cnm-loader--inline" style="min-height:160px;width:200px;background:var(--cream)"><div>${butterflySVG()}<div class="cnm-loader__label">Loading</div></div></div><button class="btn btn--ghost" type="button" data-demo-loader>Show full-screen loader for 2s</button></div></section>
  <section class="stack"><h2 class="label">Product card</h2><div class="grid-products">${ctx.products.slice(0, 4).map((p, i) => productCardHTML(p, { position: i + 1, list: 'styleguide' })).join('')}</div></section>
</div>`;
}

export function adminPage() {
  return `<div data-admin style="min-height:70vh"><div class="container" style="padding-block:48px"><div class="cnm-loader cnm-loader--inline"><div>${butterflySVG()}</div></div></div></div>`;
}

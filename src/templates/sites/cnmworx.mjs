// CNMWorX Limited — engineering & technical services. Facts from cnm-group.net; case studies, certificate details and
// HSE documentation await CNM.
import { escapeHtml } from '../../shared/format.mjs';
import { icon } from '../../shared/icons.mjs';
import { approval } from '../layout.mjs';
import { cards, contactBlock, coHero, ctaBand, orgLd, pageHead, profileOf, sectionHead } from '../company.mjs';
import { enquiryForm, field, message, phoneInput, select } from '../kit.mjs';

const K = 'cnmworx';
const SERVICES = [
  { id: 'epc', title: 'EPC project delivery', text: 'Engineering, procurement and construction delivered as one accountable project, from scope to handover.' },
  { id: 'automation', title: 'Automation & control systems', text: 'Industrial and process automation and control, integrated as a trusted system integrator.' },
  { id: 'instrumentation', title: 'Instrumentation & power electronics', text: 'Instrumentation and power electronics engineered for reliable measurement and control.' },
  { id: 'maintenance', title: 'Lifecycle maintenance & O&M', text: 'Operations and maintenance support that keeps systems performing across their lifecycle.' },
];
const INDUSTRIES = [
  { id: 'oil-gas', title: 'Oil & gas engineering', text: 'Serving IOCs, Independent Oil Companies and industrial services companies.' },
  { id: 'industrial', title: 'Industrial automation', text: 'Process automation and control for industrial operations.' },
  { id: 'power', title: 'Power & energy systems', text: 'Power electronics and energy systems engineering.' },
  { id: 'ict', title: 'ICT & systems integration', text: 'Bringing control, instrumentation and ICT together as one integrated system.' },
];
const TRUST = ['Registered in Nigeria in 2019', 'ISO 9001:2015 certified', 'Serving IOCs across West & Central Africa', 'Weekly reporting on every project'];

function requestForm(p, key = 'request') {
  return enquiryForm({
    key, division: K, title: '', subject: 'CNMWorX project request', submit: 'Submit request',
    success: 'Thank you. CNMWorX has received your project request and will be in touch.',
    fields: (x) => `
      <div class="form-row">${field(`${x}-co`, 'Company / organisation', `<input id="${x}-co" name="company" autocomplete="organization" required>`)}${field(`${x}-phone`, 'Phone', phoneInput(`${x}-phone`))}</div>
      <div class="form-row">${field(`${x}-svc`, 'Service area', select(`${x}-svc`, 'interest', [...SERVICES.map((s) => s.title), 'ICT & systems integration', 'Not sure yet']))}${field(`${x}-loc`, 'Project location', `<input id="${x}-loc" name="location" placeholder="Site, city or state" required>`)}</div>
      <div class="form-row">${field(`${x}-time`, 'Timeline', select(`${x}-time`, 'timeline', ['Immediate', 'Within 3 months', '3–6 months', '6 months or more', 'Tender / bid with a deadline']))}${field(`${x}-date`, 'Tender or bid deadline (optional)', `<input id="${x}-date" name="eventDate" type="date" data-min-today>`)}</div>
      ${field(`${x}-msg`, 'Scope of work', message(`${x}-msg`, { rows: 6, placeholder: 'Describe the scope, facility, systems involved and any standards or certifications required.' }), 'Don’t paste confidential tender documents here. The team will arrange a secure exchange.')}`,
  });
}

export function cnmworxPages(ctx) {
  const p = profileOf(ctx, K);
  const pages = [];

  pages.push({
    path: '/cnmworx/', current: 'home', title: 'CNMWorX Limited — engineering, automation & control', description: p.text.slice(0, 155),
    body: `${coHero({
      eyebrow: `CNMWorX Limited · ${p.sector}`, title: 'Engineering the future, <em>one project at a time.</em>', lead: p.text,
      image: p.image, imageAlt: p.imageAlt, position: p.imagePosition,
      ctas: [['Request a proposal', '/cnmworx/request/'], ['Our services', '/cnmworx/services/', true]],
      note: `<p class="co-badge">${icon('check')} ISO 9001:2015 certified</p>`,
    })}
<section class="co-trust" aria-label="Credentials"><div class="container"><ul>${TRUST.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div></section>
<section class="co-section" aria-labelledby="wx-svc"><div class="container">
  ${sectionHead('Services', 'Multidisciplinary engineering, <em>end to end</em>', '', 'wx-svc')}
  ${cards(SERVICES.map((s) => ({ title: s.title, text: s.text, href: `/cnmworx/services/#${s.id}` })))}
</div></section>
<section class="co-section co-section--soft" aria-labelledby="wx-way"><div class="container co-split">
  ${sectionHead('How we work', 'Embedded in your team, <em>or managed independently</em>', p.value, 'wx-way')}
  <ul class="co-ticks">${['Weekly reporting', 'Full project management flexibility', 'Tailor-made solutions', 'Embedded in your organisation or managed end-to-end'].map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul>
</div></section>
<section class="co-section" aria-labelledby="wx-ind"><div class="container">
  ${sectionHead('Industries', 'Where we work', '', 'wx-ind')}
  ${cards(INDUSTRIES.map((s) => ({ title: s.title, text: s.text, href: `/cnmworx/industries/#${s.id}` })))}
</div></section>
${ctaBand('Have a project or tender?', 'Share the scope and timing, and the CNMWorX team will respond.', [['Request a proposal', '/cnmworx/request/'], ['Contact us', '/cnmworx/contact/', true]])}`,
    jsonld: [orgLd(ctx, K, { foundingDate: '2019', hasCredential: { '@type': 'EducationalOccupationalCredential', name: 'ISO 9001:2015' } })],
  });

  {
    const h = pageHead(ctx, K, { eyebrow: 'Services', title: 'Engineering & technical services', lead: 'Industrial and process automation & control, instrumentation, power electronics and ICT — delivered as a trusted system integrator.', trail: [{ name: 'Services', path: '/cnmworx/services/' }] });
    pages.push({
      path: '/cnmworx/services/', current: 'services', title: 'Services — EPC, automation, instrumentation, O&M', description: 'CNMWorX services: EPC project delivery, automation & control systems, instrumentation & power electronics, lifecycle maintenance & O&M.',
      body: `${h.html}
<section class="co-section"><div class="container co-range">${SERVICES.map((s, i) => `<article class="co-range__item" id="${s.id}">
  <span class="co-card__num">${String(i + 1).padStart(2, '0')}</span>
  <div><h2 class="co-h3">${escapeHtml(s.title)}</h2><p>${escapeHtml(s.text)}</p><div class="co-ctas"><a class="btn site-btn" href="/cnmworx/request/?service=${encodeURIComponent(s.title)}">Request a proposal</a></div></div>
</article>`).join('')}</div></section>
${ctaBand('Tell us about your project', '', [['Request a proposal', '/cnmworx/request/']])}`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Industries', title: 'Industries we serve', lead: 'Bespoke solutions for IOCs, Independent Oil Companies and Industrial Services Companies across West and Central Africa.', trail: [{ name: 'Industries', path: '/cnmworx/industries/' }] });
    pages.push({
      path: '/cnmworx/industries/', current: 'industries', title: 'Industries — oil & gas, industrial automation, power, ICT', description: 'CNMWorX serves oil & gas, industrial automation, power & energy and ICT & systems integration across West and Central Africa.',
      body: `${h.html}<section class="co-section"><div class="container">${cards(INDUSTRIES.map((s) => ({ ...s })), { cols: 2 })}</div></section>
${ctaBand('Working in one of these sectors?', '', [['Request a proposal', '/cnmworx/request/']])}`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Quality', title: 'ISO 9001:2015 certified', lead: 'Certified engineering precision, weekly reporting and full project management flexibility.', trail: [{ name: 'Quality', path: '/cnmworx/quality/' }] });
    pages.push({
      path: '/cnmworx/quality/', current: 'quality', title: 'Quality — ISO 9001:2015', description: 'CNMWorX Limited is ISO 9001:2015 certified, with weekly reporting and full project management flexibility.',
      body: `${h.html}
<section class="co-section"><div class="container co-split">
  <div class="stack"><p class="co-lead">${escapeHtml(p.value)}</p></div>
  <div class="co-facts"><div><h2 class="co-eyebrow">Track record</h2><ul class="co-ticks"><li>${icon('check')} ${escapeHtml(p.card[0])}</li><li>${icon('check')} ${escapeHtml(p.card[1])}</li><li>${icon('check')} Registered in Nigeria in 2019</li></ul></div></div>
</div>
<div class="container">${approval('ISO 9001:2015 certificate number and certifying body, HSE policy, and project case studies with client permission.')}</div></section>
${ctaBand('Work with a certified team', '', [['Request a proposal', '/cnmworx/request/']])}`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'About', title: 'A trusted system integrator', lead: p.text, trail: [{ name: 'About', path: '/cnmworx/about/' }] });
    pages.push({
      path: '/cnmworx/about/', current: 'about', title: 'About CNMWorX Limited', description: p.text.slice(0, 155),
      body: `${h.html}
<section class="co-section"><div class="container co-split">
  <div class="stack"><p class="co-lead">${escapeHtml(p.value)}</p><p>CNMWorX is CNM Group’s Energy division.</p><div class="co-ctas"><a class="btn site-btn" href="/cnmworx/request/">Request a proposal</a><a class="btn site-btn site-btn--ghost" href="/">Discover CNM Group</a></div></div>
  <div class="co-facts">${p.lists.map(([hd, items]) => `<div><h2 class="co-eyebrow">${escapeHtml(hd)}</h2><ul class="co-ticks">${items.map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('')}</div>
</div></section>`,
      jsonld: [h.crumbs.ld, orgLd(ctx, K, { foundingDate: '2019' })],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Request a proposal', title: 'Tell us about your project', lead: 'Share the scope, location and timing. CNMWorX responds to qualified project and tender requests.', trail: [{ name: 'Request a proposal', path: '/cnmworx/request/' }] });
    pages.push({
      path: '/cnmworx/request/', current: 'cta', title: 'Request a proposal or submit a tender', description: 'Request a proposal from CNMWorX for EPC, automation & control, instrumentation, power electronics or O&M projects.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container co-split co-split--form">
  <div class="stack"><h2 class="co-h3">What happens next</h2><ol class="co-steps co-steps--compact"><li><strong>We review your request</strong><span>The team checks the scope and service area.</span></li><li><strong>We get in touch</strong><span>We contact you to discuss requirements and arrange any document exchange.</span></li><li><strong>Proposal</strong><span>You receive a tailored proposal for your project.</span></li></ol>${contactBlock(ctx)}</div>
  ${requestForm(p)}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Contact', title: 'Contact CNMWorX', lead: 'For projects, tenders, partnerships and general enquiries.', trail: [{ name: 'Contact', path: '/cnmworx/contact/' }] });
    pages.push({
      path: '/cnmworx/contact/', current: 'contact', title: 'Contact CNMWorX Limited', description: 'Contact CNMWorX Limited about engineering projects, tenders and partnerships.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container co-split co-split--form">
  <div class="stack">${contactBlock(ctx)}${approval('A dedicated CNMWorX email, phone and office address.', 'Messages go to the CNM Group inbox and Admin → Enquiries until then.')}</div>
  ${enquiryForm({ key: 'wx-contact', division: K, title: 'Send a message', subject: 'CNMWorX enquiry', success: 'Thank you. CNMWorX has your message and will be in touch.', fields: (x) => `<div class="form-row">${field(`${x}-co`, 'Company (optional)', `<input id="${x}-co" name="company" autocomplete="organization">`)}${field(`${x}-phone`, 'Phone (optional)', phoneInput(`${x}-phone`, { required: false }))}</div>${field(`${x}-msg`, 'Message', message(`${x}-msg`))}` })}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }
  return pages;
}

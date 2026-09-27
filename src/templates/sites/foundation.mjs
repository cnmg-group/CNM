// CNM Foundation — the social impact and philanthropic arm of CNM Group. Facts from cnm-group.net.
// Online giving (payment account, receipts, tax status) awaits CNM: the donate page records pledges and the team follows up.
import { escapeHtml } from '../../shared/format.mjs';
import { icon } from '../../shared/icons.mjs';
import { approval } from '../layout.mjs';
import { cards, contactBlock, coHero, ctaBand, orgLd, pageHead, profileOf, sectionHead } from '../company.mjs';
import { enquiryForm, field, message, phoneInput, select } from '../kit.mjs';

const K = 'foundation';
const PROGRAMMES = [
  { id: 'education', title: 'Education & literacy programmes', text: 'Because every child deserves an education.' },
  { id: 'women', title: "Women's economic empowerment", text: 'Because every woman deserves an opportunity.' },
  { id: 'youth', title: 'Youth development & skills training', text: 'Building skills and capacity for the next generation.' },
  { id: 'health', title: 'Community health initiatives', text: 'Because every community deserves to thrive.' },
];
const AMOUNTS = [5000, 10000, 25000, 50000, 100000];
const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

export function foundationPages(ctx) {
  const p = profileOf(ctx, K);
  const pages = [];

  pages.push({
    path: '/foundation/', current: 'home', title: 'CNM Foundation — education, empowerment and community health', description: p.text.slice(0, 155),
    body: `${coHero({
      eyebrow: p.fullName, title: 'Zero percent of zero is zero — <em>so we give everything.</em>', lead: p.text,
      image: p.image, imageAlt: p.imageAlt, position: p.imagePosition,
      ctas: [['Donate', '/foundation/donate/'], ['Get involved', '/foundation/get-involved/', true]],
    })}
<section class="co-section" aria-labelledby="fd-prog"><div class="container">
  ${sectionHead('Our programmes', 'Where we <em>invest</em>', '', 'fd-prog')}
  ${cards(PROGRAMMES.map((x) => ({ title: x.title, text: x.text, href: `/foundation/programmes/#${x.id}` })))}
</div></section>
<section class="co-section co-section--soft" aria-labelledby="fd-belief"><div class="container co-split">
  ${sectionHead('What we believe', 'Transformation begins where investment meets <em>intentionality</em>', '', 'fd-belief')}
  <div class="stack"><p class="co-lead">${escapeHtml(p.value)}</p><ul class="co-ticks">${p.lists[1][1].map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>
</div></section>
<section class="co-section" aria-labelledby="fd-inv"><div class="container">
  ${sectionHead('Get involved', 'Three ways to help', '', 'fd-inv')}
  ${cards([
    { title: 'Partner with us', text: 'Organisations, churches and businesses: work with us to scale a programme.', href: '/foundation/get-involved/?interest=Partner%20with%20the%20Foundation', cta: 'Partner' },
    { title: 'Volunteer', text: 'Give your time and skills to our programmes in Nigeria and the diaspora.', href: '/foundation/get-involved/?interest=Volunteer', cta: 'Volunteer' },
    { title: 'Donate', text: 'Pledge a gift to a programme, once or every month.', href: '/foundation/donate/', cta: 'Donate' },
  ], { cols: 3 })}
</div></section>
${ctaBand('Every gift makes a difference', 'Pledge a one-off or monthly gift to the programme you care about most.', [['Donate', '/foundation/donate/'], ['Contact us', '/foundation/contact/', true]])}`,
    jsonld: [orgLd(ctx, K, { '@type': 'NGO' })],
  });

  {
    const h = pageHead(ctx, K, { eyebrow: 'Programmes', title: 'Our programmes', lead: 'Education, women’s economic empowerment, youth development and community health across Nigeria and the African diaspora.', trail: [{ name: 'Programmes', path: '/foundation/programmes/' }] });
    pages.push({
      path: '/foundation/programmes/', current: 'programmes', title: 'Programmes — education, empowerment, youth, health', description: 'CNM Foundation programmes: education & literacy, women’s economic empowerment, youth development & skills training, community health.',
      body: `${h.html}
<section class="co-section"><div class="container co-range">${PROGRAMMES.map((x, i) => `<article class="co-range__item" id="${x.id}">
  <span class="co-card__num">${String(i + 1).padStart(2, '0')}</span>
  <div><h2 class="co-h3">${escapeHtml(x.title)}</h2><p>${escapeHtml(x.text)}</p><div class="co-ctas"><a class="btn site-btn" href="/foundation/donate/?programme=${encodeURIComponent(x.title)}">Support this programme</a><a class="btn site-btn site-btn--ghost" href="/foundation/get-involved/">Get involved</a></div></div>
</article>`).join('')}
${approval('Programme stories, photographs, locations and results for each programme.')}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Get involved', title: 'Partner, volunteer or support', lead: 'Whether you represent an organisation or want to give your time, tell us how you’d like to help.', trail: [{ name: 'Get involved', path: '/foundation/get-involved/' }] });
    pages.push({
      path: '/foundation/get-involved/', current: 'get-involved', title: 'Get involved — partner or volunteer', description: 'Partner with CNM Foundation, volunteer with our programmes or support our work.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container co-split co-split--form">
  <div class="stack">
    ${cards([
      { title: 'Partner', text: 'Work with us to fund, host or scale a programme.' },
      { title: 'Volunteer', text: 'Mentor, teach or support community outreach.' },
      { title: 'Donate', text: 'Pledge a gift to a programme you care about.', href: '/foundation/donate/', cta: 'Donate' },
    ], { cols: 1 })}
  </div>
  ${enquiryForm({
    key: 'involve', division: K, title: 'Tell us how you’d like to help', subject: 'Foundation — get involved', submit: 'Send',
    success: 'Thank you. CNM Foundation has your message and will be in touch.',
    fields: (x) => `
      <div class="form-row">${field(`${x}-phone`, 'Phone (optional)', phoneInput(`${x}-phone`, { required: false }))}${field(`${x}-co`, 'Organisation (optional)', `<input id="${x}-co" name="company" autocomplete="organization">`)}</div>
      <div class="form-row">${field(`${x}-int`, 'I’d like to', select(`${x}-int`, 'interest', ['Partner with the Foundation', 'Volunteer', 'Donate or sponsor a programme', 'Ask about a programme']))}${field(`${x}-area`, 'Programme', select(`${x}-area`, 'location', PROGRAMMES.map((pr) => pr.title), { required: false, blank: 'Any programme' }))}</div>
      ${field(`${x}-msg`, 'Message', message(`${x}-msg`, { placeholder: 'Tell us a little about you and how you’d like to help.' }))}`,
  })}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Donate', title: 'Make a gift', lead: 'Choose an amount and a programme. We’ll contact you with secure ways to complete your gift and send your receipt.', trail: [{ name: 'Donate', path: '/foundation/donate/' }] });
    pages.push({
      path: '/foundation/donate/', current: 'cta', title: 'Donate to CNM Foundation', description: 'Pledge a one-off or monthly gift to CNM Foundation programmes in education, women’s empowerment, youth development and community health.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container co-split co-split--form">
  <div class="stack">
    <p class="co-lead">${escapeHtml(p.value)}</p>
    <ul class="co-ticks">${PROGRAMMES.map((x) => `<li>${icon('check')} ${escapeHtml(x.title)}</li>`).join('')}</ul>
    ${approval('Online giving: the Foundation’s payment account, receipts and registration details.', 'Until then, pledges are recorded and the team contacts each donor directly. No payment is taken on this page.')}
  </div>
  ${enquiryForm({
    key: 'donate', division: K, title: 'Your gift', subject: 'Donation pledge', submit: 'Pledge my gift', cls: 'donate-form',
    success: 'Thank you for your generosity. CNM Foundation will contact you shortly to complete your gift.',
    fields: (x) => `
      <fieldset class="amount-picker" data-amounts><legend class="field-label">Amount</legend>
        <div class="amount-picker__row">${AMOUNTS.map((a, i) => `<label class="amount-chip"><input type="radio" name="amountPreset" value="${a}"${i === 1 ? ' checked' : ''}><span>${naira(a)}</span></label>`).join('')}<label class="amount-chip"><input type="radio" name="amountPreset" value="other"><span>Other</span></label></div>
        <div class="field" data-amount-other hidden><label for="${x}-other">Other amount (₦)</label><input id="${x}-other" type="number" inputmode="numeric" min="1000" step="500" placeholder="e.g. 15000"></div>
      </fieldset>
      <input type="hidden" name="timeline" data-amount-summary>
      <div class="form-row">${field(`${x}-freq`, 'How often', select(`${x}-freq`, 'frequency', ['One-off', 'Monthly'], { blank: null }))}${field(`${x}-prog`, 'Programme', select(`${x}-prog`, 'interest', ['Where it’s needed most', ...PROGRAMMES.map((pr) => pr.title)], { blank: null }))}</div>
      ${field(`${x}-phone`, 'Phone (optional)', phoneInput(`${x}-phone`, { required: false }))}
      ${field(`${x}-msg`, 'Message (optional)', message(`${x}-msg`, { required: false, rows: 3, placeholder: 'A dedication or note to the team.' }))}`,
  })}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'About', title: p.fullName, lead: p.tagline, trail: [{ name: 'About', path: '/foundation/about/' }] });
    pages.push({
      path: '/foundation/about/', current: 'about', title: 'About CNM Foundation', description: p.text.slice(0, 155),
      body: `${h.html}
<section class="co-section"><div class="container co-split">
  <div class="stack"><p class="co-lead">${escapeHtml(p.text)}</p><p>${escapeHtml(p.value)}</p><p>CNM Foundation is CNM Group’s Impact division.</p><div class="co-ctas"><a class="btn site-btn" href="/foundation/donate/">Donate</a><a class="btn site-btn site-btn--ghost" href="/">Discover CNM Group</a></div></div>
  <div class="co-facts"><div><h2 class="co-eyebrow">Who we are</h2><ul class="co-ticks">${[...p.card, ...p.places].map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>${p.lists.map(([hd, items]) => `<div><h2 class="co-eyebrow">${escapeHtml(hd)}</h2><ul class="co-ticks">${items.map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('')}</div>
</div></section>`,
      jsonld: [h.crumbs.ld, orgLd(ctx, K, { '@type': 'NGO' })],
    });
  }

  {
    const h = pageHead(ctx, K, { eyebrow: 'Contact', title: 'Contact CNM Foundation', lead: 'For partnerships, volunteering, donations and general enquiries.', trail: [{ name: 'Contact', path: '/foundation/contact/' }] });
    pages.push({
      path: '/foundation/contact/', current: 'contact', title: 'Contact CNM Foundation', description: 'Contact CNM Foundation about partnerships, volunteering and donations.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container co-split co-split--form">
  <div class="stack">${contactBlock(ctx)}${approval('A dedicated CNM Foundation email and phone.', 'Messages go to the CNM Group inbox and Admin → Enquiries until then.')}</div>
  ${enquiryForm({ key: 'fd-contact', division: K, title: 'Send a message', subject: 'Foundation enquiry', success: 'Thank you. CNM Foundation has your message and will be in touch.', fields: (x) => `${field(`${x}-phone`, 'Phone (optional)', phoneInput(`${x}-phone`, { required: false }))}${field(`${x}-msg`, 'Message', message(`${x}-msg`))}` })}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }
  return pages;
}

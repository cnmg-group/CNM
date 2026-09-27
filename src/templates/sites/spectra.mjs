// CNM Spectra — premium eyewear. Facts from cnm-group.net; collections, prices, store addresses and hours await CNM.
import { escapeHtml } from '../../shared/format.mjs';
import { icon } from '../../shared/icons.mjs';
import { approval } from '../layout.mjs';
import { cards, contactBlock, coHero, ctaBand, orgLd, pageHead, pillarsStrip, profileOf, sectionHead } from '../company.mjs';
import { enquiryForm, field, message, phoneInput, select } from '../kit.mjs';

const K = 'spectra';
const LOGO_TAGLINE = 'See better. Feel better. Look your best.'; // printed on the CNM Spectra logo
const RANGE = [
  { id: 'prescription', title: 'Prescription eyewear', text: 'Frames and lenses made up to your prescription, chosen for how you look and how you see.' },
  { id: 'sunglasses', title: 'Sunglasses & fashion frames', text: 'Statement and everyday frames that bring optical precision to contemporary style.' },
  { id: 'contact-lenses', title: 'Contact lens solutions', text: 'Contact lenses and the solutions to care for them, with advice on what suits your eyes.' },
  { id: 'accessories', title: 'Eyewear accessories', text: 'Cases, cloths and the finishing touches that keep your eyewear at its best.' },
];
const SERVICES = ['Eye test & prescription', 'Prescription eyewear', 'Sunglasses & fashion frames', 'Contact lens advice', 'Eyewear accessories', 'Something else'];

function bookingForm(p, { key = 'book', title = 'Book an appointment' } = {}) {
  return enquiryForm({
    key, division: K, title, subject: 'Spectra appointment', submit: 'Request appointment',
    success: 'Thank you. CNM Spectra has your appointment request and will contact you to confirm the time.',
    fields: (x) => `
      <div class="form-row">${field(`${x}-phone`, 'Phone', phoneInput(`${x}-phone`))}${field(`${x}-loc`, 'Location', select(`${x}-loc`, 'location', p.places))}</div>
      <div class="form-row">${field(`${x}-svc`, 'Reason for your visit', select(`${x}-svc`, 'interest', SERVICES))}${field(`${x}-date`, 'Preferred date', `<input id="${x}-date" name="eventDate" type="date" required data-min-today>`)}</div>
      ${field(`${x}-time`, 'Preferred time', select(`${x}-time`, 'timeline', ['Morning', 'Afternoon', 'Evening'], { blank: 'Any time', required: false }))}
      ${field(`${x}-msg`, 'Anything we should know? (optional)', message(`${x}-msg`, { required: false, rows: 3, placeholder: 'e.g. I wear varifocals, or I’d like to see sunglasses too.' }), 'Please don’t include medical records. We’ll discuss details in person.')}`,
  });
}

export function spectraPages(ctx) {
  const p = profileOf(ctx, K);
  const pages = [];

  // Home
  pages.push({
    path: '/spectra/', current: 'home', title: 'CNM Spectra — premium eyewear in Lagos & Abuja',
    description: p.text.slice(0, 155),
    body: `${coHero({
      eyebrow: `CNM Spectra · ${p.banner.words.join(' · ')}`, title: `See clearly. <em>Look extraordinary.</em>`, lead: p.text,
      image: p.image, imageAlt: p.imageAlt, position: p.imagePosition, width: p.imageWidth, height: p.imageHeight,
      ctas: [['Book an appointment', '/spectra/book/'], ['Explore eyewear', '/spectra/eyewear/', true]],
      note: `<p class="co-note">${escapeHtml(p.banner.tagline)}. ${escapeHtml(LOGO_TAGLINE)}</p>`,
    })}
${pillarsStrip(p)}
<section class="co-section" aria-labelledby="sp-range">
  <div class="container">${sectionHead('The range', 'Eyewear for how you see <em>and</em> how you’re seen', '', 'sp-range')}
  ${cards(RANGE.map((r) => ({ title: r.title, text: r.text, href: `/spectra/eyewear/#${r.id}`, cta: 'See the range' })))}</div>
</section>
<section class="co-section co-section--soft" aria-labelledby="sp-why"><div class="container co-split">
  ${sectionHead('Why CNM Spectra', 'Precision optics, <em>tailored for the African market</em>', p.value, 'sp-why')}
  <ul class="co-ticks">${p.lists[1][1].map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul>
</div></section>
<section class="co-section" aria-labelledby="sp-visit"><div class="container">
  ${sectionHead('Your visit', 'Three simple steps', '', 'sp-visit')}
  <ol class="co-steps">
    <li><strong>Book online</strong><span>Choose a location, the reason for your visit and a time that suits you.</span></li>
    <li><strong>We confirm</strong><span>The CNM Spectra team contacts you to confirm your appointment.</span></li>
    <li><strong>See and choose</strong><span>Meet the team, try frames on and choose what’s right for you.</span></li>
  </ol>
</div></section>
${ctaBand('Visit us in Lagos or Abuja', 'Book an appointment and we’ll confirm a time with you.', [['Book an appointment', '/spectra/book/'], ['Visit & contact', '/spectra/contact/', true]])}`,
    jsonld: [orgLd(ctx, K)],
  });

  // Eyewear
  {
    const h = pageHead(ctx, K, { eyebrow: 'Eyewear', title: 'The CNM Spectra range', lead: 'Prescription frames, sunglasses, contact lenses and accessories, curated for style and visual clarity.', trail: [{ name: 'Eyewear', path: '/spectra/eyewear/' }] });
    pages.push({
      path: '/spectra/eyewear/', current: 'eyewear', title: 'Eyewear — prescription frames, sunglasses & contact lenses', description: 'The CNM Spectra range: prescription eyewear, sunglasses and fashion frames, contact lens solutions and eyewear accessories.',
      body: `${h.html}
<section class="co-section"><div class="container co-range">${RANGE.map((r, i) => `<article class="co-range__item" id="${r.id}">
  <span class="co-card__num">${String(i + 1).padStart(2, '0')}</span>
  <div><h2 class="co-h3">${escapeHtml(r.title)}</h2><p>${escapeHtml(r.text)}</p>
  <div class="co-ctas"><a class="btn site-btn" href="/spectra/book/?service=${encodeURIComponent(r.title)}">Book to try on</a></div></div>
</article>`).join('')}
${approval('Frame collections, brands, photographs and prices for each range.', 'The range is shown by category until CNM Spectra supplies its catalogue.')}
</div></section>
${ctaBand('Try frames on in person', 'Book a visit and the team will have a selection ready for you.', [['Book an appointment', '/spectra/book/']])}`,
      jsonld: [h.crumbs.ld],
    });
  }

  // Eye care
  {
    const h = pageHead(ctx, K, { eyebrow: 'Eye care', title: 'Professional visual health', lead: 'Optical retail and optometry under one roof: advice, prescriptions and the right lenses for the way you live.', trail: [{ name: 'Eye care', path: '/spectra/eye-care/' }] });
    pages.push({
      path: '/spectra/eye-care/', current: 'eye-care', title: 'Eye care — optometry and visual health', description: 'Optical retail, optometry and professional visual health from CNM Spectra in Lagos and Abuja.',
      body: `${h.html}
<section class="co-section"><div class="container">
  ${cards([
    { title: 'Eye test & prescription', text: 'Talk to the team about an eye test and an up-to-date prescription.', href: '/spectra/book/?service=Eye%20test%20%26%20prescription', cta: 'Book' },
    { title: 'Prescription eyewear', text: 'Find frames that suit your face, your prescription and your style.', href: '/spectra/book/?service=Prescription%20eyewear', cta: 'Book' },
    { title: 'Contact lens advice', text: 'Guidance on contact lenses and how to care for them.', href: '/spectra/book/?service=Contact%20lens%20advice', cta: 'Book' },
  ], { cols: 3 })}
  ${approval('Which eye-care services are offered at each location, who provides them, and any fees.')}
</div></section>
${ctaBand('Book your visit', '', [['Book an appointment', '/spectra/book/']])}`,
      jsonld: [h.crumbs.ld],
    });
  }

  // Book
  {
    const h = pageHead(ctx, K, { eyebrow: 'Appointments', title: 'Book an appointment', lead: 'Choose a location, the reason for your visit and a time that suits you. We’ll confirm by phone or email.', trail: [{ name: 'Book an appointment', path: '/spectra/book/' }] });
    pages.push({
      path: '/spectra/book/', current: 'cta', title: 'Book an eyewear appointment', description: 'Book an appointment with CNM Spectra in Lagos or Abuja for eyewear, eye care and contact lens advice.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container co-split co-split--form">
  <div class="stack">
    <h2 class="co-h3">What to bring</h2>
    <ul class="co-ticks"><li>${icon('check')} Your current glasses or contact lenses</li><li>${icon('check')} Any recent prescription you have</li><li>${icon('check')} Sunglasses you’d like to match or replace</li></ul>
    ${contactBlock(ctx)}
  </div>
  ${bookingForm(p, { title: '' })}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }

  // About
  {
    const h = pageHead(ctx, K, { eyebrow: 'About', title: 'Redefining how Africans see the world', lead: p.value, trail: [{ name: 'About', path: '/spectra/about/' }] });
    pages.push({
      path: '/spectra/about/', current: 'about', title: 'About CNM Spectra', description: p.text.slice(0, 155),
      body: `${h.html}
<section class="co-section"><div class="container co-split">
  <div class="stack"><p class="co-lead">${escapeHtml(p.text)}</p><p>CNM Spectra is part of CNM Group’s Retail division, alongside CNM Essentials.</p>
  <div class="co-ctas"><a class="btn site-btn" href="/spectra/book/">Book an appointment</a><a class="btn site-btn site-btn--ghost" href="/">Discover CNM Group</a></div></div>
  <div class="co-facts">${p.lists.map(([hd, items]) => `<div><h2 class="co-eyebrow">${escapeHtml(hd)}</h2><ul class="co-ticks">${items.map((x) => `<li>${icon('check')} ${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('')}</div>
</div></section>`,
      jsonld: [h.crumbs.ld, orgLd(ctx, K)],
    });
  }

  // Visit & contact
  {
    const h = pageHead(ctx, K, { eyebrow: 'Visit & contact', title: 'Find CNM Spectra', lead: 'We serve clients in Lagos and Abuja.', trail: [{ name: 'Visit & contact', path: '/spectra/contact/' }] });
    pages.push({
      path: '/spectra/contact/', current: 'contact', title: 'Visit & contact CNM Spectra', description: 'Contact CNM Spectra and book an eyewear appointment in Lagos or Abuja.',
      body: `${h.html}
<section class="co-section co-section--tight"><div class="container">
  <div class="co-cards co-cards--2">${p.places.map((pl) => `<article class="co-card"><h2 class="co-card__title">${escapeHtml(pl)}</h2><p>Address and opening hours are being confirmed.</p><a class="co-card__link" href="/spectra/book/">Book in ${escapeHtml(pl)} ${icon('arrow')}</a></article>`).join('')}</div>
  ${approval('CNM Spectra addresses, opening hours, phone and map for Lagos and Abuja.')}
</div></section>
<section class="co-section"><div class="container co-split co-split--form">
  <div class="stack">${sectionHead('Get in touch', 'Questions before you visit?')}${contactBlock(ctx)}</div>
  ${enquiryForm({ key: 'sp-contact', division: K, title: 'Send a message', subject: 'Spectra enquiry', success: 'Thank you. CNM Spectra has your message and will be in touch.', fields: (x) => `${field(`${x}-phone`, 'Phone (optional)', phoneInput(`${x}-phone`, { required: false }))}${field(`${x}-msg`, 'Message', message(`${x}-msg`))}` })}
</div></section>`,
      jsonld: [h.crumbs.ld],
    });
  }
  return pages;
}

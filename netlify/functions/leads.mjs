// /api/enquiry, /api/newsletter, /api/back-in-stock — lead capture with consent, validation and spam controls.
import { randomToken } from '../lib/crypto.mjs';
import { enquiryNotice, sendEmail } from '../lib/email.mjs';
import { baseProducts } from '../lib/catalogue.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';

const SECTORS = ['events', 'weddings', 'corporate', 'hospitality', 'retail', 'offices', 'activations', 'machines', 'other'];

export default handler(async (req, context) => {
  if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
  assertCsrf(req);
  await rateLimit('lead', clientIp(req, context));
  const b = await readJson(req);
  const leads = await store('leads');
  const now = new Date().toISOString();

  switch (segments(req)[1]) {
    case 'enquiry': {
      if (b.website) return json({ ok: true }); // honeypot: silently accept bots
      if (!v.bool(b.consent)) fail(422, 'consent', 'Please confirm we may contact you about this enquiry.');
      const e = {
        id: `${now.slice(0, 10)}-${randomToken(6)}`, status: 'new', createdAt: now,
        name: v.str(b.name, { name: 'Name', max: 120 }), email: v.email(b.email), phone: v.phone(b.phone, { required: false }),
        company: v.str(b.company, { name: 'Company', max: 120, required: false }), sector: v.oneOf(b.sector, SECTORS, 'Project type'),
        eventDate: v.str(b.eventDate, { name: 'Date', max: 10, required: false }), location: v.str(b.location, { name: 'Location', max: 160, required: false }),
        message: v.str(b.message, { name: 'Message', min: 10, max: 3000 }),
      };
      await leads.set(`enquiry/${e.id}`, e);
      if (process.env.CNM_NOTIFY_EMAIL) await sendEmail(enquiryNotice(e));
      return json({ ok: true, id: e.id }, 201);
    }
    case 'newsletter': {
      const email = v.email(b.email);
      if (!v.bool(b.consent)) fail(422, 'consent', 'Consent is required to subscribe.');
      await leads.set(`newsletter/${email}`, { email, source: v.str(b.source, { name: 'Source', max: 40, required: false }) || 'site', consentAt: now });
      return json({ ok: true }, 201);
    }
    case 'back-in-stock': {
      const email = v.email(b.email);
      const productId = v.oneOf(b.productId, baseProducts.map((p) => p.id), 'Product');
      await leads.set(`bis/${productId}/${email}`, { email, productId, createdAt: now });
      return json({ ok: true }, 201);
    }
    default:
      fail(404, 'not_found', 'Unknown endpoint.');
  }
});

export const config = { path: ['/api/enquiry', '/api/newsletter', '/api/back-in-stock'] };

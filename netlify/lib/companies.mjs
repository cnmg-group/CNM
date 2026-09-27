// Company registry for the CNM Group operating system.
// Each company (CNM Essentials, CNM Spectra, CNMWorX, CNM Foundation, and any added later) has its own settings and its
// own data (orders, leads, products, stock carry a companyId); the Command Center rolls them up to group level.
// Stored as one document (config/companies) — small, strongly consistent, and every change is audited.
import site from '../../content/site.json' with { type: 'json' };
import { store } from './store.mjs';
import * as v from './validate.mjs';
import { fail } from './http.mjs';

export const PAYMENT_METHOD_IDS = ['card', 'bank_transfer', 'ussd', 'cash_on_delivery', 'pay_in_store', 'invoice'];
export const DELIVERY_OPTION_IDS = ['lagos-standard', 'lagos-express', 'abuja-standard', 'nationwide', 'pickup', 'on-site-service', 'none'];
export const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];
export const KINDS = ['retail', 'services', 'engineering', 'nonprofit', 'marketplace', 'digital'];

/** The four live companies, from content/site.json (brand facts stay in one place). */
function seed() {
  const profiles = site.group?.profiles || [];
  const logo = (slug) => profiles.find((p) => p.slug === slug)?.logo;
  const base = [
    { id: 'essentials', name: 'CNM Essentials', kind: 'retail', color: '#b99a5b', domains: ['cnmessentials.com', 'cnmgroup.com/essentials'], paymentMethods: ['card', 'bank_transfer', 'ussd'], deliveryOptions: ['lagos-standard', 'lagos-express', 'abuja-standard', 'nationwide', 'pickup'] },
    { id: 'spectra', name: 'CNM Spectra', kind: 'retail', color: '#1f9cc4', domains: ['cnmgroup.com/spectra'], paymentMethods: ['pay_in_store'], deliveryOptions: ['pickup'] },
    { id: 'cnmworx', name: 'CNMWorX Limited', kind: 'engineering', color: '#d9921c', domains: ['cnmgroup.com/cnmworx'], paymentMethods: ['invoice'], deliveryOptions: ['on-site-service'] },
    { id: 'foundation', name: 'CNM Foundation', kind: 'nonprofit', color: '#3f8f2f', domains: ['cnmgroup.com/foundation'], paymentMethods: ['bank_transfer'], deliveryOptions: ['none'] },
  ];
  return base.map((c) => ({ ...c, logo: logo(c.id) || null, currency: 'NGN', status: 'active', admins: [], createdAt: '2026-09-27T00:00:00.000Z', createdBy: 'system', updatedAt: null, updatedBy: null }));
}

export async function listCompanies({ includeArchived = true } = {}) {
  const doc = await (await store('config')).get('companies');
  const list = doc?.companies?.length ? doc.companies : seed();
  return includeArchived ? list : list.filter((c) => c.status !== 'archived');
}

async function saveAll(list) { await (await store('config')).set('companies', { companies: list }); }

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40);
const color = (c, name) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : fail(422, 'invalid', `${name} must be a hex colour like #1f9cc4.`));
const list = (x, allowed, name) => {
  if (x == null) return undefined;
  if (!Array.isArray(x) || x.length > 20) fail(422, 'invalid', `${name} must be a list.`);
  const bad = x.find((i) => !allowed.includes(i));
  if (bad) fail(422, 'invalid', `${name}: “${bad}” is not supported.`);
  return [...new Set(x)];
};
const domains = (x) => {
  if (x == null) return undefined;
  if (!Array.isArray(x) || x.length > 10) fail(422, 'invalid', 'Domains must be a list.');
  return x.map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean).map((d) => (/^[a-z0-9.-]+\.[a-z]{2,}(\/[a-z0-9/_-]*)?$/.test(d) ? d : fail(422, 'invalid', `“${d}” is not a valid domain.`)));
};
const emails = (x) => (x == null ? undefined : (Array.isArray(x) ? x : fail(422, 'invalid', 'Admins must be a list.')).slice(0, 50).map((e) => v.email(e)));

/** Validate a create/update payload. Only provided fields are applied on update. */
export function validateCompany(b, { creating }) {
  const out = {};
  if (creating || b.name != null) out.name = v.str(b.name, { name: 'Company name', max: 80 });
  if (creating) {
    out.id = slug(b.id || b.name);
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(out.id)) fail(422, 'invalid', 'Company ID must be 2–40 letters, numbers or hyphens.');
  }
  if (creating || b.kind != null) out.kind = v.oneOf(b.kind || 'retail', KINDS, 'Business type');
  if (creating || b.color != null) out.color = color(b.color || '#16161a', 'Brand colour');
  if (b.logo != null) out.logo = b.logo === '' ? null : (/^(\/|https:\/\/)[^\s"'<>]{1,400}$/.test(b.logo) ? b.logo : fail(422, 'invalid', 'Logo must be a site path (/assets/…) or an https URL.'));
  if (creating || b.currency != null) out.currency = v.oneOf(b.currency || 'NGN', CURRENCIES, 'Currency');
  const pm = list(b.paymentMethods, PAYMENT_METHOD_IDS, 'Payment methods'); if (pm) out.paymentMethods = pm;
  const dl = list(b.deliveryOptions, DELIVERY_OPTION_IDS, 'Delivery options'); if (dl) out.deliveryOptions = dl;
  const dm = domains(b.domains); if (dm) out.domains = dm;
  const ad = emails(b.admins); if (ad) out.admins = ad;
  if (creating) { out.paymentMethods ||= []; out.deliveryOptions ||= []; out.domains ||= []; out.admins ||= []; out.logo ??= null; }
  return out;
}

export async function createCompany(b, by) {
  const all = await listCompanies();
  const c = validateCompany(b, { creating: true });
  if (all.some((x) => x.id === c.id)) fail(409, 'exists', `A company with the ID “${c.id}” already exists.`);
  if (all.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) fail(409, 'exists', `“${c.name}” already exists.`);
  const now = new Date().toISOString();
  const rec = { ...c, status: 'active', createdAt: now, createdBy: by, updatedAt: null, updatedBy: null };
  await saveAll([...all, rec]);
  return rec;
}

export async function updateCompany(id, b, by) {
  const all = await listCompanies();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) fail(404, 'not_found', 'Company not found.');
  const patch = validateCompany(b, { creating: false });
  if (b.status != null) patch.status = v.oneOf(b.status, ['active', 'archived'], 'Status');
  if (patch.name && all.some((x, j) => j !== i && x.name.toLowerCase() === patch.name.toLowerCase())) fail(409, 'exists', `“${patch.name}” already exists.`);
  const before = all[i];
  all[i] = { ...before, ...patch, updatedAt: new Date().toISOString(), updatedBy: by };
  await saveAll(all);
  const changed = Object.keys(patch).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k]));
  return { company: all[i], changed, before };
}

/** Which companies an admin may see. Owners (super admins) see all; others are limited when scoped. */
export function scopeFor(admin, companies) {
  if (admin.role === 'owner') return null; // null = no restriction
  const fromEnv = Array.isArray(admin.companies) && admin.companies.length ? admin.companies : null;
  const assigned = companies.filter((c) => c.admins?.includes(admin.email?.toLowerCase())).map((c) => c.id);
  const ids = [...new Set([...(fromEnv || []), ...assigned])];
  return ids.length ? ids : null;
}

/** Which company an enquiry/lead belongs to. */
export const leadCompany = (e) => e.companyId || (e.division && e.division !== 'group' ? e.division : e.sector && e.sector !== 'group' ? 'essentials' : 'group');

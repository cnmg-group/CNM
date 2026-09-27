// Local-only demo activity for reviewing the CNM Group OS (Command Center) — never runs against a real database.
//   node scripts/seed-demo.mjs [dataDir]      (default ./.data, the dev server's store)
// Uses real catalogue products and their catalogue prices; customers, orders, traffic and enquiries are synthetic and
// every record is flagged { demo: true }. Deterministic (seeded PRNG) so screenshots are reproducible.
import path from 'node:path';

if (process.env.SUPABASE_URL || process.env.NETLIFY || process.env.CONTEXT) {
  console.error('Refusing to seed demo data outside local development.');
  process.exit(1);
}
process.env.CNM_LOCAL_STORE = '1';
process.env.CNM_DATA_DIR = path.resolve(process.argv[2] || '.data');
const { store } = await import('../netlify/lib/store.mjs');
const { saveOrder } = await import('../netlify/lib/orders.mjs');
const products = (await import('../content/products.json', { with: { type: 'json' } })).default.filter((p) => p.price?.amount);

// mulberry32: small, well-distributed seeded PRNG (the plain LCG it replaces produced correlated statuses)
let seed = 20260927;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const NAMES = [['Adaeze', 'Okafor'], ['Tunde', 'Bakare'], ['Chioma', 'Nwosu'], ['Ibrahim', 'Musa'], ['Funmi', 'Adeyemi'], ['Emeka', 'Eze'], ['Zainab', 'Bello'], ['Kelechi', 'Obi'], ['Bisi', 'Ogunleye'], ['Ngozi', 'Umeh']];
const PLACES = [['Lagos', 'Ikoyi', 'lagos-standard', 3500], ['Lagos', 'Lekki', 'lagos-express', 6000], ['FCT', 'Garki', 'abuja-standard', 5000], ['Rivers', 'Port Harcourt', 'nationwide', 7500], ['Oyo', 'Ibadan', 'nationwide', 7500]];
const now = Date.now();
const DAYS = 400;
const iso = (t) => new Date(t).toISOString();

let n = 0;
let demoException = false;
for (let d = DAYS; d >= 0; d--) {
  const growth = 0.6 + ((DAYS - d) / DAYS) * 0.9; // the business grows over the year
  const weekend = [0, 6].includes(new Date(now - d * 864e5).getUTCDay()) ? 1.35 : 1;
  const count = Math.floor(rnd() * 5 * growth * weekend);
  for (let i = 0; i < count; i++) {
    const t = now - d * 864e5 - Math.floor(rnd() * 20) * 36e5;
    const lines = [...Array(1 + Math.floor(rnd() * 3))].map(() => { const p = pick(products); const qty = 1 + Math.floor(rnd() * 2); return { id: p.id, name: p.name, slug: p.slug, qty, unitPrice: p.price.amount, lineTotal: p.price.amount * qty }; });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const discount = rnd() < 0.18 ? Math.round(subtotal * 0.1) : 0;
    const [state, city, method, fee] = rnd() < 0.12 ? ['Lagos', 'Lekki', 'pickup', 0] : pick(PLACES);
    const total = subtotal - discount + fee;
    const [firstName, lastName] = pick(NAMES);
    const age = d;
    const r = rnd();
    let status = age > 6 ? (r < 0.04 ? 'refunded' : r < 0.07 ? 'cancelled' : r < 0.1 ? 'payment_failed' : 'delivered') : age > 2 ? (r < 0.5 ? 'delivered' : r < 0.8 ? 'dispatched' : 'processing') : (r < 0.15 ? 'pending_payment' : r < 0.55 ? 'paid' : r < 0.85 ? 'processing' : 'dispatched');
    if (d === 3 && i === 0) status = 'paid'; // one order late to dispatch, so "Needs attention" has something real to show
    const history = [{ status: 'pending_payment', at: iso(t), by: 'customer' }];
    const step = (s, h) => history.push({ status: s, at: iso(t + h * 36e5), by: s === 'paid' ? 'paystack' : 'ops@cnm.local' });
    if (!['pending_payment', 'payment_failed', 'cancelled'].includes(status)) step('paid', 0.02);
    if (['processing', 'dispatched', 'delivered', 'refunded'].includes(status)) step('processing', 6);
    if (['dispatched', 'delivered', 'refunded'].includes(status)) step('dispatched', 26);
    if (['delivered', 'refunded'].includes(status)) step('delivered', 26 + 24 + Math.floor(rnd() * 72));
    if (status === 'refunded') step('refunded', 26 + 24 * 6);
    if (status === 'payment_failed') step('payment_failed', 0.05);
    if (status === 'cancelled') step('cancelled', 30);
    if (status === 'delivered' && rnd() < 0.05) history.splice(-1, 0, { status: 'delivery_failed', at: iso(t + 50 * 36e5), by: 'courier', note: 'Customer unavailable; rescheduled' });
    const number = `CNM-${iso(t).slice(2, 10).replace(/-/g, '')}-D${String(++n).padStart(4, '0')}`;
    // Delivery record for anything past packing (couriers are CNM's own riders in demo data)
    const shipStatus = { processing: 'packed', dispatched: rnd() < 0.5 ? 'in_transit' : 'out_for_delivery', delivered: 'delivered', refunded: 'delivered' }[status];
    const shipment = method === 'pickup' || !shipStatus ? null : {
      id: `SHP-${number.slice(4)}`, courier: 'in-house', trackingNumber: `RDR-${String(n).padStart(5, '0')}`, status: shipStatus, eta: iso(t + 72 * 36e5).slice(0, 10), promisedBy: iso(t + 96 * 36e5).slice(0, 10),
      attempts: history.some((h) => h.status === 'delivery_failed') ? 1 : 0, exception: null, pod: null,
      events: history.filter((h) => ['processing', 'dispatched', 'delivered'].includes(h.status)).map((h) => ({ status: { processing: 'packed', dispatched: 'handed_over', delivered: 'delivered' }[h.status], at: h.at, by: 'ops@cnm.local', source: 'admin', note: '' })),
    };
    if (shipment?.status === 'delivered') { shipment.deliveredAt = history.findLast((h) => h.status === 'delivered')?.at; shipment.pod = { recipient: `${firstName} ${lastName}`, note: null, photoUrl: null, at: shipment.deliveredAt, by: 'ops@cnm.local' }; }
    if (shipment && status === 'dispatched' && d <= 4 && !demoException && (demoException = true)) { shipment.status = 'failed_attempt'; shipment.attempts = 1; shipment.exception = { kind: 'failed_attempt', note: 'Customer not reachable on phone', openedAt: iso(now - 20 * 36e5), openedBy: 'ops@cnm.local', resolvedAt: null, resolution: null }; }
    await saveOrder({
      demo: true, number, accessToken: 'demo', userId: null, status, createdAt: iso(t), updatedAt: history.at(-1).at, companyId: 'essentials', channel: rnd() < 0.22 ? 'app' : rnd() < 0.08 ? 'manual' : 'web',
      contact: { firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`, phone: '+2348000000000' },
      delivery: method === 'pickup' ? { method, label: 'Collect in store', storeSlug: 'lagos' } : { method, label: `${state} delivery`, address: { line1: `${1 + Math.floor(rnd() * 90)} Demo Street`, city, state } },
      lines, promoCode: discount ? 'WELCOME10' : null,
      totals: { subtotal, discount, delivery: fee, vat: Math.round(((total * 7.5) / 107.5) * 100) / 100, vatIncluded: true, total, currency: 'NGN' },
      payment: { provider: 'simulated', method: pick(['card', 'card', 'bank_transfer', 'ussd']), reference: `${number}-demo`, status: status === 'pending_payment' ? 'pending' : 'paid', ...(status === 'refunded' ? { refund: { amount: rnd() < 0.5 ? total : Math.round(total / 2), at: history.at(-1).at, status: 'success' } } : {}) },
      history, ...(shipment ? { shipment } : {}),
      ...(d === 1 && i === 0 && ['paid', 'processing', 'dispatched'].includes(status) ? { refunds: [{ id: 'RF-demo1', amount: Math.min(total, 120000), reason: 'damaged', note: 'Bottle arrived cracked (photo on WhatsApp)', status: 'requested', requestedBy: 'ops@cnm.local', requestedAt: iso(now - 5 * 36e5), needsApproval: true }] } : {}),
      ...(d === 9 && i === 0 && status === 'delivered' ? { returns: [{ rma: `RMA-${number.slice(4)}-1`, status: 'received', kind: 'refund', reason: 'wrong_item', note: 'Ordered Midnight Vanilla, received Petalrich', lines: [{ id: lines[0].id, name: lines[0].name, qty: 1, unitPrice: lines[0].unitPrice, value: lines[0].unitPrice }], value: lines[0].unitPrice, createdAt: iso(now - 3 * 864e5), createdBy: 'ops@cnm.local', history: [{ status: 'requested', at: iso(now - 3 * 864e5), by: 'ops@cnm.local' }, { status: 'approved', at: iso(now - 2.8 * 864e5), by: 'ops@cnm.local' }, { status: 'received', at: iso(now - 864e5), by: 'ops@cnm.local' }] }] } : {}),
    });
  }
}

// Demo refund approval threshold (local only), so the sample refund above shows the approval flow.
await (await store('config')).set('ops', { refundApprovalThreshold: 25000 });

// Traffic: cookie-less daily active users and funnel events, per company.
const ev = await store('events');
for (let d = DAYS; d >= 0; d--) {
  const day = new Date(now - d * 864e5 + 3600e3).toISOString().slice(0, 10);
  const g = 0.6 + ((DAYS - d) / DAYS) * 0.9;
  const co = (base) => Math.round(base * g * (0.8 + rnd() * 0.4));
  const byCompany = {
    essentials: { active_user: co(140), view_item: co(260), add_to_cart: co(38), begin_checkout: co(16), add_payment_info: co(11), purchase: co(3) },
    spectra: { active_user: co(45), generate_lead: co(1) }, cnmworx: { active_user: co(22) }, foundation: { active_user: co(30) }, group: { active_user: co(70) },
  };
  const counts = {};
  for (const c of Object.values(byCompany)) for (const [k, v] of Object.entries(c)) counts[k] = (counts[k] || 0) + v;
  const pages = Object.fromEntries(products.slice(0, 14).map((p, i) => [`/products/${p.slug}/`, Math.round(co(40) / (1 + i * 0.35))]));
  await ev.set(`daily/${day}`, { demo: true, counts, byCompany, pages, searches: {}, zeroSearches: {} });
}

// Leads for the service companies.
const leads = await store('leads');
const LEADS = [
  ['spectra', 'Eye test and new frames', 'Spectra appointment'], ['cnmworx', 'Control system upgrade for a bottling line', 'CNMWorX proposal request'], ['foundation', 'Volunteering at the education programme', 'Foundation enquiry'],
  ['cnmworx', 'Instrumentation maintenance contract', 'CNMWorX proposal request'], ['spectra', 'Contact lens fitting', 'Spectra appointment'], ['essentials', 'Scenting for a hotel lobby', 'Fragrance as a Service'],
];
for (let i = 0; i < 22; i++) {
  const [companyId, message, subject] = LEADS[i % LEADS.length];
  const t = now - Math.floor(rnd() * 40) * 864e5 - Math.floor(rnd() * 20) * 36e5;
  const [first, last] = pick(NAMES);
  const id = `${iso(t).slice(0, 10)}-demo${i}`;
  await leads.set(`enquiry/${id}`, { demo: true, id, status: i < 4 ? 'new' : pick(['contacted', 'quoted', 'won', 'new']), createdAt: iso(t), name: `${first} ${last}`, email: `${first.toLowerCase()}@example.com`, sector: companyId === 'essentials' ? 'hospitality' : 'group', division: companyId === 'essentials' ? undefined : companyId, companyId, subject, message });
}
console.log(`Seeded ${n} demo orders, ${DAYS + 1} days of traffic and 22 leads into ${process.env.CNM_DATA_DIR}`);

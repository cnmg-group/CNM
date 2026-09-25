// /api/admin/* — operations back office. Role-based access; every route checks permissions server-side.
import { baseProducts, commerce } from '../lib/catalogue.mjs';
import { randomToken, verifyPassword } from '../lib/crypto.mjs';
import { sendEmail, statusEmail } from '../lib/email.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { getOrder, listOrders, saveOrder, setStatus, STATUSES, summary } from '../lib/orders.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';
import { clearAdminCookie, currentAdmin, issueAdminSession } from '../lib/session.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';

export const ROLES = {
  owner: ['dashboard', 'orders', 'customers', 'inventory', 'discounts', 'content', 'enquiries', 'subscribers', 'analytics', 'publish', 'users', 'media'],
  manager: ['dashboard', 'orders', 'customers', 'inventory', 'discounts', 'content', 'enquiries', 'subscribers', 'analytics', 'publish', 'media'],
  fulfilment: ['dashboard', 'orders'],
  editor: ['dashboard', 'content', 'enquiries', 'publish', 'media', 'analytics'],
};
const CONTENT_KEYS = ['homepage', 'seo', 'redirects', 'stores', 'announcements'];
const TRANSITIONS = {
  pending_payment: ['cancelled'], payment_failed: ['cancelled'], paid: ['processing', 'cancelled', 'refunded'],
  processing: ['dispatched', 'cancelled', 'refunded'], dispatched: ['delivered'], delivered: ['refunded'], cancelled: [], refunded: [],
};

/** Admin accounts come from the ADMIN_USERS env var (JSON). A staging-only bootstrap owner can be enabled with ADMIN_STAGING_PASSWORD. */
function adminUsers() {
  let list = [];
  try { list = JSON.parse(process.env.ADMIN_USERS || '[]'); } catch { console.error('[admin] ADMIN_USERS is not valid JSON'); }
  return list.filter((u) => u.email && u.passwordHash && ROLES[u.role]);
}
async function authenticate(email, password) {
  const u = adminUsers().find((x) => x.email.toLowerCase() === email);
  if (u) return (await verifyPassword(password, u.passwordHash)) ? u : null;
  const staging = process.env.CONTEXT !== 'production';
  if (staging && process.env.ADMIN_STAGING_PASSWORD && email === 'staging@cnmessentials.com' && password === process.env.ADMIN_STAGING_PASSWORD) return { email, role: 'owner', name: 'Staging owner' };
  if (process.env.CNM_LOCAL_STORE === '1' && email === 'admin@cnm.local' && password === 'cnm-local-admin') return { email, role: 'owner', name: 'Local owner' };
  return null;
}

const can = (admin, perm) => ROLES[admin.role]?.includes(perm);
const need = (admin, perm) => { if (!can(admin, perm)) fail(403, 'forbidden', 'Your role does not have access to this area.'); };

async function dashboard() {
  const orders = await listOrders();
  const paid = orders.filter((o) => ['paid', 'processing', 'dispatched', 'delivered'].includes(o.status));
  const revenue = paid.reduce((s, o) => s + o.totals.total, 0);
  const days = [...Array(14)].map((_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const series = days.map((d) => ({ date: d, revenue: paid.filter((o) => o.createdAt.startsWith(d)).reduce((s, o) => s + o.totals.total, 0), orders: paid.filter((o) => o.createdAt.startsWith(d)).length }));
  const inv = (await (await store('config')).get('inventory'))?.products || {};
  const lowStock = baseProducts.map((p) => ({ id: p.id, name: p.name, stock: inv[p.id]?.stock ?? p.stock.quantity })).filter((p) => p.stock != null && p.stock <= 5);
  const leads = await store('leads');
  const [enquiries, subs] = await Promise.all([leads.list('enquiry/'), leads.list('newsletter/')]);
  const enquiryRecs = await Promise.all(enquiries.map((k) => leads.get(k)));
  return {
    kpis: { revenue, orders: paid.length, aov: paid.length ? Math.round(revenue / paid.length) : 0, awaitingFulfilment: orders.filter((o) => ['paid', 'processing'].includes(o.status)).length, pendingPayment: orders.filter((o) => o.status === 'pending_payment').length, newEnquiries: enquiryRecs.filter((e) => e?.status === 'new').length, subscribers: subs.length },
    series, lowStock, recentOrders: orders.slice(0, 8).map((o) => ({ ...summary(o), customer: `${o.contact.firstName} ${o.contact.lastName}` })),
  };
}

async function analytics() {
  const s = await store('events');
  const keys = (await s.list('daily/')).sort().slice(-30);
  const days = await Promise.all(keys.map(async (k) => ({ date: k.slice(6), ...(await s.get(k)) })));
  const total = {};
  const searches = {};
  const zero = {};
  for (const d of days) {
    for (const [k, n] of Object.entries(d.counts || {})) total[k] = (total[k] || 0) + n;
    for (const [k, n] of Object.entries(d.searches || {})) searches[k] = (searches[k] || 0) + n;
    for (const [k, n] of Object.entries(d.zeroSearches || {})) zero[k] = (zero[k] || 0) + n;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const funnel = ['view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase'].map((k) => ({ step: k, count: total[k] || 0 }));
  return { days: days.map((d) => ({ date: d.date, counts: d.counts })), totals: total, funnel, topSearches: top(searches), zeroResultSearches: top(zero) };
}

export default handler(async (req, context) => {
  assertCsrf(req);
  const parts = segments(req).slice(2); // after api/admin
  const [area, id] = parts;

  if (area === 'login' && req.method === 'POST') {
    await rateLimit('admin', clientIp(req, context));
    const b = await readJson(req);
    const u = await authenticate(v.email(b.email), v.str(b.password, { name: 'Password', max: 200 }));
    if (!u) fail(401, 'invalid_credentials', 'Email or password is incorrect.');
    return json({ admin: { email: u.email, role: u.role, name: u.name || u.email, permissions: ROLES[u.role] } }, 200, { 'Set-Cookie': await issueAdminSession(req, u) });
  }
  if (area === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearAdminCookie(req) });

  const admin = await currentAdmin(req);
  if (!admin) fail(401, 'unauthenticated', 'Please sign in to the admin.');
  const b = ['PUT', 'PATCH', 'POST'].includes(req.method) ? await readJson(req, area === 'media' ? 6 * 1024 * 1024 : 256 * 1024) : null;
  const cfg = await store('config');
  const audit = async (action, detail) => (await store('audit')).set(`${new Date().toISOString()}-${randomToken(4)}`, { admin: admin.email, role: admin.role, action, detail });

  switch (area) {
    case 'me': return json({ admin: { email: admin.email, role: admin.role, name: admin.name, permissions: ROLES[admin.role] } });
    case 'dashboard': need(admin, 'dashboard'); return json(await dashboard());
    case 'analytics': need(admin, 'analytics'); return json(await analytics());

    case 'orders': {
      need(admin, 'orders');
      if (!id) {
        const status = new URL(req.url).searchParams.get('status');
        const all = await listOrders();
        return json({ orders: all.filter((o) => !status || o.status === status).map((o) => ({ ...summary(o), customer: `${o.contact.firstName} ${o.contact.lastName}`, email: o.contact.email, delivery: o.delivery.label })) });
      }
      const order = await getOrder(decodeURIComponent(id));
      if (!order) fail(404, 'not_found', 'Order not found.');
      if (req.method === 'PATCH') {
        const next = v.oneOf(b.status, STATUSES, 'Status');
        if (!TRANSITIONS[order.status]?.includes(next)) fail(422, 'transition', `An order cannot move from ${order.status} to ${next}.`);
        setStatus(order, next, v.str(b.note, { name: 'Note', max: 300, required: false }), admin.email);
        await saveOrder(order);
        await sendEmail(statusEmail(order, new URL(req.url).origin));
        await audit('order.status', { number: order.number, status: next });
      }
      const { accessToken, ...safe } = order;
      return json({ order: safe, transitions: TRANSITIONS[order.status] });
    }

    case 'customers': {
      need(admin, 'customers');
      const users = await store('users');
      const recs = (await Promise.all((await users.list('user/')).map((k) => users.get(k)))).filter(Boolean);
      const orders = await listOrders();
      return json({ customers: recs.map((u) => ({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`, createdAt: u.createdAt, orders: orders.filter((o) => o.userId === u.id).length, marketing: !!u.preferences?.email?.newArrivals })) });
    }

    case 'enquiries': {
      need(admin, 'enquiries');
      const leads = await store('leads');
      if (id && req.method === 'PATCH') {
        const e = await leads.get(`enquiry/${id}`);
        if (!e) fail(404, 'not_found', 'Enquiry not found.');
        e.status = v.oneOf(b.status, ['new', 'contacted', 'quoted', 'won', 'lost'], 'Status');
        await leads.set(`enquiry/${id}`, e);
        await audit('enquiry.status', { id, status: e.status });
      }
      const list = (await Promise.all((await leads.list('enquiry/')).map((k) => leads.get(k)))).filter(Boolean).sort((a, x) => x.createdAt.localeCompare(a.createdAt));
      return json({ enquiries: list });
    }

    case 'subscribers': {
      need(admin, 'subscribers');
      const leads = await store('leads');
      const subs = (await Promise.all((await leads.list('newsletter/')).map((k) => leads.get(k)))).filter(Boolean);
      const bis = (await Promise.all((await leads.list('bis/')).map((k) => leads.get(k)))).filter(Boolean);
      return json({ subscribers: subs, backInStock: bis });
    }

    case 'inventory': {
      need(admin, 'inventory');
      const cur = (await cfg.get('inventory')) || { products: {} };
      if (req.method === 'PUT') {
        const next = { products: {} };
        for (const p of baseProducts) {
          const x = b.products?.[p.id];
          if (!x) { if (cur.products[p.id]) next.products[p.id] = cur.products[p.id]; continue; }
          const num = (n, name) => (n === '' || n == null ? undefined : Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.round(Number(n) * 100) / 100 : fail(422, 'invalid', `${name} for ${p.name} is invalid.`));
          next.products[p.id] = {
            price: num(x.price, 'Price'), compareAt: num(x.compareAt, 'Compare-at price'), stock: num(x.stock, 'Stock'),
            available: x.available !== false, priceApproved: !!x.priceApproved,
            description: v.str(x.description, { name: 'Description', max: 4000, required: false }) || undefined,
            images: Array.isArray(x.images) ? x.images.filter((i) => typeof i?.src === 'string').slice(0, 8).map((i) => ({ src: i.src.slice(0, 500), alt: v.str(i.alt, { name: 'Alt text', max: 200 }) })) : cur.products[p.id]?.images,
            seo: { title: v.str(x.seo?.title, { name: 'SEO title', max: 70, required: false }) || undefined, description: v.str(x.seo?.description, { name: 'Meta description', max: 160, required: false }) || undefined },
          };
        }
        await cfg.set('inventory', next);
        await audit('inventory.update', { count: Object.keys(next.products).length });
        return json({ products: baseProducts.map((p) => ({ id: p.id, name: p.name, base: { price: p.price.amount, stock: p.stock.quantity }, override: next.products[p.id] || null })) });
      }
      return json({ products: baseProducts.map((p) => ({ id: p.id, name: p.name, category: p.category, base: { price: p.price.amount, stock: p.stock.quantity }, override: cur.products[p.id] || null })) });
    }

    case 'discounts': {
      need(admin, 'discounts');
      if (req.method === 'PUT') {
        if (!Array.isArray(b.discounts) || b.discounts.length > 100) fail(422, 'invalid', 'Invalid discounts.');
        const list = b.discounts.map((d) => ({
          code: v.str(d.code, { name: 'Code', max: 40 }).toUpperCase().replace(/[^A-Z0-9_-]/g, ''), type: v.oneOf(d.type, ['percent', 'fixed'], 'Type'),
          value: Math.max(0, Math.min(d.type === 'percent' ? 100 : 10_000_000, Number(d.value) || 0)), minSubtotal: Math.max(0, Number(d.minSubtotal) || 0), active: d.active !== false,
          note: v.str(d.note, { name: 'Note', max: 200, required: false }),
        }));
        await cfg.set('discounts', { discounts: list });
        await audit('discounts.update', { count: list.length });
      }
      return json({ discounts: (await commerce()).discounts });
    }

    case 'content': {
      need(admin, 'content');
      if (!CONTENT_KEYS.includes(id)) fail(404, 'not_found', 'Unknown content key.');
      if (req.method === 'PUT') {
        if (JSON.stringify(b).length > 200 * 1024) fail(413, 'too_large', 'Content too large.');
        await cfg.set(`content/${id}`, { ...b, updatedAt: new Date().toISOString(), updatedBy: admin.email });
        await audit('content.update', { key: id });
      }
      return json({ key: id, value: await cfg.get(`content/${id}`) });
    }

    case 'media': {
      need(admin, 'media');
      const media = await store('media');
      if (req.method === 'POST') {
        const type = v.oneOf(b.type, ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'video/mp4'], 'File type');
        const name = v.str(b.name, { name: 'File name', max: 120 }).replace(/[^\w.-]/g, '-');
        const data = v.str(b.data, { name: 'File', max: 6 * 1024 * 1024 });
        const key = `${Date.now()}-${name}`;
        await media.set(`file/${key}`, { type, data, name, uploadedBy: admin.email, at: new Date().toISOString() });
        await audit('media.upload', { key });
        return json({ url: `/api/media/${encodeURIComponent(key)}` }, 201);
      }
      const keys = await media.list('file/');
      return json({ media: keys.map((k) => ({ key: k.slice(5), url: `/api/media/${encodeURIComponent(k.slice(5))}` })) });
    }

    case 'publish': {
      need(admin, 'publish');
      if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
      if (!process.env.NETLIFY_BUILD_HOOK_URL) fail(501, 'not_configured', 'Set NETLIFY_BUILD_HOOK_URL to enable publishing from the admin.');
      const r = await fetch(process.env.NETLIFY_BUILD_HOOK_URL, { method: 'POST' });
      await audit('publish', { status: r.status });
      return json({ ok: r.ok });
    }

    case 'users': {
      need(admin, 'users');
      return json({ users: adminUsers().map((u) => ({ email: u.email, name: u.name, role: u.role })), roles: ROLES, stagingBootstrap: !!process.env.ADMIN_STAGING_PASSWORD && process.env.CONTEXT !== 'production' });
    }

    case 'audit': {
      need(admin, 'users');
      const a = await store('audit');
      const keys = (await a.list('')).sort().slice(-100).reverse();
      return json({ entries: await Promise.all(keys.map(async (k) => ({ at: k.slice(0, 24), ...(await a.get(k)) }))) });
    }

    default:
      fail(404, 'not_found', 'Unknown admin area.');
  }
});

export const config = { path: ['/api/admin/:area', '/api/admin/:area/:id'] };

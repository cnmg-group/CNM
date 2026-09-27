// /api/ops/* — CNM Group OS operations (spec §7–9): orders, manual orders, fulfilment & delivery, exceptions,
// refunds with approvals, returns, couriers. Role- and company-scoped; every change is audited; creates and money
// movements accept an Idempotency-Key.
import { computeQuote } from '../../src/shared/pricing.mjs';
import site from '../../content/site.json' with { type: 'json' };
import { baseProducts, commerce, productsMap, stores } from '../lib/catalogue.mjs';
import { emailConfigured } from '../lib/email.mjs';
import { listCompanies, scopeFor } from '../lib/companies.mjs';
import { randomToken } from '../lib/crypto.mjs';
import { orderConfirmationEmail, sendEmail, statusEmail } from '../lib/email.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { idempotent } from '../lib/idempotency.mjs';
import { parseAddress, parseContact, parseDelivery } from '../lib/order-input.mjs';
import { commitStock, getOrder, listOrders, orderNumber, restock, saveOrder, setStatus } from '../lib/orders.mjs';
import * as OPS from '../lib/ops.mjs';
import { PAYMENT_METHODS, activeProvider, providerFor } from '../lib/payments/index.mjs';
import { currentAdmin } from '../lib/session.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';
import { ROLES } from './admin.mjs';

const siteUrl = (req) => (process.env.CONTEXT === 'production' && process.env.URL) || new URL(req.url).origin;
const MONEY_ROLES = ['owner', 'manager']; // may request refunds, approve refunds, create manual orders, cancel paid orders
const PAID_LIKE = ['paid', 'processing', 'dispatched', 'delivered', 'returned'];

/** Manual payments (cash, POS, confirmed bank transfer) are refunded outside Paystack and recorded here. */
const manualProvider = { name: 'manual', refund: async () => ({ id: `MANUAL-${randomToken(4)}`, status: 'recorded' }) };
const providerOf = (order) => (order.payment?.provider === 'manual' ? manualProvider : providerFor(order));

async function settings() {
  const doc = (await (await store('config')).get('ops')) || {};
  return { refundApprovalThreshold: Number.isFinite(doc.refundApprovalThreshold) ? doc.refundApprovalThreshold : OPS.DEFAULT_REFUND_APPROVAL };
}

const csvCell = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
const summaryRow = (o, couriers) => ({
  number: o.number, status: o.status, createdAt: o.createdAt, company: o.companyId || 'essentials', channel: o.channel || 'web',
  customer: `${o.contact.firstName} ${o.contact.lastName}`, email: o.contact.email, phone: o.contact.phone, total: o.totals.total,
  items: o.lines.reduce((n, l) => n + l.qty, 0), payment: o.payment?.method || '', location: OPS.orderLocation(o), delivery: o.delivery?.label,
  shipment: o.shipment?.status || (['paid', 'processing'].includes(o.status) ? 'awaiting_fulfilment' : null), courier: couriers.find((c) => c.id === o.shipment?.courier)?.name || null,
  tracking: o.shipment?.trackingNumber || null, exception: OPS.hasOpenException(o), refunded: OPS.refunded(o), pendingRefund: OPS.pendingRefunds(o).length > 0, returns: (o.returns || []).filter((r) => !['rejected', 'refunded', 'exchanged', 'credited'].includes(r.status)).length,
});

/** Seller block for invoices and packing slips — from content and the company registry, never invented. */
function sellerFor(o, companies) {
  const id = o.companyId || 'essentials';
  const co = companies.find((c) => c.id === id);
  const essentials = id === 'essentials';
  return {
    name: co?.legalName || co?.name || 'CNM Essentials', logo: co?.logo || '/assets/brand/cnm-logo-on-light.svg', color: co?.color || '#b99a5b',
    addresses: essentials ? stores.filter((st) => st.verified !== false).map((st) => `${st.address}, ${st.city}`) : [site.group?.contact?.address].filter(Boolean),
    email: essentials ? site.contact?.email?.value : site.group?.contact?.email, phone: essentials ? site.contact?.phone?.value : site.group?.contact?.phone,
    web: essentials ? (site.productionUrl || '').replace(/^https?:\/\//, '') : (site.groupUrl || '').replace(/^https?:\/\//, ''),
    rcNumber: co?.rcNumber || null, taxId: co?.taxId || null,
  };
}

function detail(o, all, couriers, admin, cfg, companies = [], returnsPolicy = null) {
  const { accessToken, ...safe } = o;
  void accessToken;
  const courier = couriers.find((c) => c.id === o.shipment?.courier);
  return {
    order: { ...safe, trackingLink: OPS.trackingLink(courier, o.shipment?.trackingNumber) },
    timeline: OPS.timeline(o), customer: OPS.customerSummary(all, o.contact.email), couriers: couriers.filter((c) => c.active),
    refunds: OPS.refundList(o), refunded: OPS.refunded(o), refundable: OPS.refundable(o),
    allowed: {
      shipment: OPS.shipNext(o.shipment?.status || 'awaiting_fulfilment'), canFulfil: ['paid', 'processing', 'dispatched'].includes(o.status),
      editAddress: ['pending_payment', 'paid', 'processing'].includes(o.status) && !!o.delivery?.address && !['handed_over', 'in_transit', 'out_for_delivery', 'delivered'].includes(o.shipment?.status),
      refund: MONEY_ROLES.includes(admin.role) && PAID_LIKE.includes(o.status) && OPS.refundable(o) > 0,
      approve: MONEY_ROLES.includes(admin.role), markPaid: MONEY_ROLES.includes(admin.role) && ['pending_payment', 'payment_failed'].includes(o.status),
      cancel: ['pending_payment', 'payment_failed'].includes(o.status) || (MONEY_ROLES.includes(admin.role) && ['paid', 'processing'].includes(o.status) && !['handed_over', 'in_transit', 'out_for_delivery'].includes(o.shipment?.status)),
      returns: ['dispatched', 'delivered', 'returned'].includes(o.status), returnNext: Object.fromEntries((o.returns || []).map((r) => [r.rma, OPS.returnNext(r.status)])),
    },
    refundApprovalThreshold: cfg.refundApprovalThreshold, returnWindow: OPS.returnWindow(o, returnsPolicy),
    invoiceNumber: `INV-${o.number.slice(4)}`, seller: sellerFor(o, companies),
    pickupStore: OPS.pickupStore(o) ? { name: OPS.pickupStore(o).name, address: `${OPS.pickupStore(o).address}, ${OPS.pickupStore(o).city}` } : null,
    paymentMethods: PAYMENT_METHODS.map(({ id, label }) => ({ id, label })),
  };
}

export default handler(async (req, context) => {
  assertCsrf(req);
  const admin = await currentAdmin(req);
  if (!admin) fail(401, 'unauthenticated', 'Please sign in to the admin.');
  if (!ROLES[admin.role]?.includes('orders')) fail(403, 'forbidden', 'Your role does not have access to orders.');
  const [, , area, id, sub, subId, op] = segments(req);
  const url = new URL(req.url);
  const b = ['PUT', 'PATCH', 'POST'].includes(req.method) ? await readJson(req) : null;
  const companies = await listCompanies();
  const scope = scopeFor(admin, companies);
  const inScope = (o) => !scope || scope.includes(o.companyId || 'essentials');
  const audit = async (action, detailObj) => (await store('audit')).set(`${new Date().toISOString()}-${randomToken(4)}`, { admin: admin.email, role: admin.role, action, detail: detailObj, ip: clientIp(req, context), agent: (req.headers.get('user-agent') || '').slice(0, 160) });
  const money = () => { if (!MONEY_ROLES.includes(admin.role)) fail(403, 'forbidden', 'Only owners and managers can do this.'); };
  const couriers = await OPS.listCouriers();
  const cfg = await settings();

  // ------------------------------------------------------------ settings & couriers
  if (area === 'couriers') {
    if (req.method === 'PUT') { money(); const list = await OPS.saveCouriers(b.couriers); await audit('couriers.update', { count: list.length }); return json({ couriers: list }); }
    return json({ couriers });
  }
  if (area === 'settings') {
    if (req.method === 'PUT') {
      if (admin.role !== 'owner') fail(403, 'forbidden', 'Only owners can change operations settings.');
      const t = Number(b.refundApprovalThreshold);
      if (!(t >= 0 && t <= 100_000_000)) fail(422, 'invalid', 'Enter an approval threshold in naira.');
      await (await store('config')).set('ops', { refundApprovalThreshold: Math.round(t) });
      await audit('ops.settings', { before: cfg, after: { refundApprovalThreshold: Math.round(t) } });
      return json(await settings());
    }
    return json(cfg);
  }

  // ------------------------------------------------------------ fulfilment board + delivery performance
  if (area === 'fulfilment') {
    const all = (await listOrders()).filter(inScope).filter((o) => !url.searchParams.get('company') || url.searchParams.get('company') === 'all' || (o.companyId || 'essentials') === url.searchParams.get('company'));
    const open = all.filter((o) => ['paid', 'processing', 'dispatched'].includes(o.status));
    const columns = ['awaiting_fulfilment', 'packed', 'ready_for_pickup', 'handed_over', 'in_transit', 'out_for_delivery', 'failed_attempt', 'rescheduled'].map((s) => ({
      status: s, label: OPS.SHIP_LABEL[s],
      orders: open.filter((o) => (o.shipment?.status || 'awaiting_fulfilment') === s).map((o) => summaryRow(o, couriers)).sort((a, x) => a.createdAt.localeCompare(x.createdAt)),
    }));
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    return json({ columns, exceptions: all.filter(OPS.hasOpenException).map((o) => ({ ...summaryRow(o, couriers), exception: o.shipment.exception })), stats: OPS.deliveryStats(all.filter((o) => o.createdAt >= since), couriers), couriers });
  }

  if (area !== 'orders') fail(404, 'not_found', 'Unknown operations area.');

  // ------------------------------------------------------------ list / export / bulk
  if (!id || id === 'export' || id === 'bulk') {
    if (req.method === 'POST' && !id) return manualOrder();
    if (req.method === 'POST' && id === 'bulk') return bulk();
    const p = url.searchParams;
    const f = Object.fromEntries(['q', 'status', 'company', 'channel', 'payment', 'location', 'from', 'to', 'shipment'].map((k) => [k, (p.get(k) || '').slice(0, 120)]));
    f.exception = p.get('exception') === '1';
    if (f.company && f.company !== 'all' && scope && !scope.includes(f.company)) fail(403, 'forbidden', 'You do not have access to that company.');
    const all = (await listOrders()).filter(inScope);
    const hits = OPS.filterOrders(all, f, scope);
    if (id === 'export') {
      const head = ['Order', 'Date', 'Status', 'Company', 'Channel', 'Customer', 'Email', 'Phone', 'Items', 'Total (NGN)', 'Refunded (NGN)', 'Payment', 'Delivery', 'Location', 'Shipment', 'Courier', 'Tracking'];
      const rows = hits.map((o) => { const r = summaryRow(o, couriers); return [r.number, r.createdAt, r.status, r.company, r.channel, r.customer, r.email, r.phone, r.items, r.total, r.refunded, r.payment, r.delivery, r.location, r.shipment || '', r.courier || '', r.tracking || '']; });
      await audit('orders.export', { count: hits.length, filters: f });
      return new Response([head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n'), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="cnm-orders-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
    }
    const limit = Math.min(100, Math.max(10, Number(p.get('limit')) || 50));
    const cursor = p.get('cursor'); // keyset: createdAt|number of the last row seen
    const page = cursor ? hits.filter((o) => `${o.createdAt}|${o.number}` < cursor) : hits;
    const rows = page.slice(0, limit);
    const counts = {};
    for (const o of OPS.filterOrders(all, { ...f, status: '' }, scope)) counts[o.status] = (counts[o.status] || 0) + 1;
    return json({
      orders: rows.map((o) => summaryRow(o, couriers)), total: hits.length,
      next: page.length > limit ? `${rows.at(-1).createdAt}|${rows.at(-1).number}` : null,
      counts, exceptions: all.filter(OPS.hasOpenException).length,
      locations: [...new Set(all.map(OPS.orderLocation))].sort(), couriers,
    }, 200, { 'Cache-Control': 'no-store' });
  }

  // ------------------------------------------------------------ one order
  const number = decodeURIComponent(id);
  const order = await getOrder(number);
  if (!order || !inScope(order)) fail(404, 'not_found', 'Order not found.');
  const all = async () => (await listOrders()).filter(inScope);
  const respond = async (status = 200) => json(detail(order, await all(), couriers, admin, cfg, companies, (await commerce()).returns), status);
  const by = admin.email;

  if (req.method === 'GET' && !sub) return respond();

  switch (sub) {
    case 'notes': {
      if (req.method !== 'POST') break;
      const text = v.str(b.text, { name: 'Note', max: 1000 });
      order.staffNotes = [...(order.staffNotes || []), { at: new Date().toISOString(), by, text }];
      await saveOrder(order); await audit('order.note', { number });
      return respond(201);
    }
    case 'address': {
      if (req.method !== 'PATCH') break;
      if (!detail(order, [], couriers, admin, cfg).allowed.editAddress) fail(422, 'transition', 'The address can only be changed before the order is handed to the courier.');
      const before = order.delivery.address;
      const address = parseAddress(b.address);
      const method = (await commerce()).deliveryMethods.find((m) => m.id === order.delivery.method);
      if (method && !method.regions.includes('*') && !method.regions.includes(address.state)) fail(422, 'region', `${method.label} doesn't deliver to ${address.state}. Change the delivery method on a new order instead.`);
      order.delivery = { ...order.delivery, address };
      order.history.push({ status: 'address_changed', at: new Date().toISOString(), by, note: `${before.line1}, ${before.city} → ${address.line1}, ${address.city}` });
      await saveOrder(order); await audit('order.address', { number, before, after: address });
      return respond();
    }
    case 'resend': {
      if (req.method !== 'POST') break;
      const kind = v.oneOf(b.kind || 'confirmation', ['confirmation', 'status'], 'Email');
      if (kind === 'confirmation' && !PAID_LIKE.includes(order.status)) fail(422, 'invalid', 'The order confirmation is sent once an order is paid.');
      const r = await sendEmail(kind === 'confirmation' ? orderConfirmationEmail(order, siteUrl(req)) : statusEmail(order, siteUrl(req)));
      order.history.push({ status: 'email_resent', at: new Date().toISOString(), by, note: kind });
      await saveOrder(order); await audit('order.resend', { number, kind });
      return json({ ok: true, sent: !!r?.sent, note: emailConfigured() ? (r?.sent ? undefined : 'The email provider rejected the message; check the email settings.') : 'Email is not configured on this environment (RESEND_API_KEY), so nothing was sent.' });
    }
    case 'mark-paid': {
      if (req.method !== 'POST') break;
      money();
      if (!['pending_payment', 'payment_failed'].includes(order.status)) fail(422, 'transition', 'Only unpaid orders can be marked as paid.');
      const method = v.oneOf(b.method, ['bank_transfer', 'cash', 'pos_card', 'ussd', 'card'], 'Payment method');
      const reason = v.str(b.reason, { name: 'Reference or reason', min: 3, max: 200 });
      order.payment = { ...order.payment, provider: 'manual', method, status: 'paid', paidAt: new Date().toISOString(), recordedBy: by, reference: order.payment?.reference || `MAN-${order.number.slice(4)}`, note: reason };
      setStatus(order, 'paid', `Payment recorded by staff (${method.replace(/_/g, ' ')}): ${reason}`, by);
      await saveOrder(order); await commitStock(order, baseProducts); await sendEmail(orderConfirmationEmail(order, siteUrl(req)));
      await audit('order.mark_paid', { number, method, reason, amount: order.totals.total });
      return respond();
    }
    case 'cancel': {
      if (req.method !== 'POST') break;
      const reason = v.str(b.reason, { name: 'Reason', min: 3, max: 200 });
      if (['pending_payment', 'payment_failed'].includes(order.status)) {
        setStatus(order, 'cancelled', reason, by);
      } else if (['paid', 'processing'].includes(order.status)) {
        money();
        if (['handed_over', 'in_transit', 'out_for_delivery'].includes(order.shipment?.status)) fail(422, 'transition', 'This order is already with the courier. Open a return instead.');
        const r = OPS.requestRefund(order, { amount: OPS.refundable(order), reason: 'customer_request', note: `Cancelled: ${reason}` }, admin, Infinity);
        await OPS.executeRefund(order, r, providerOf(order), admin);
        if (r.status !== 'succeeded') { await saveOrder(order); fail(502, 'refund_failed', `The payment provider rejected the refund: ${r.error}. The order was not cancelled.`); }
        order.history.push({ status: 'cancelled', at: new Date().toISOString(), by, note: reason });
        await restock(order.lines, baseProducts);
      } else fail(422, 'transition', `Orders that are ${order.status.replace(/_/g, ' ')} can't be cancelled.`);
      await saveOrder(order); await sendEmail(statusEmail(order, siteUrl(req)));
      await audit('order.cancel', { number, reason, status: order.status });
      return respond();
    }

    // ---- fulfilment & delivery
    case 'shipment': {
      if (req.method === 'PATCH') {
        OPS.updateShipmentDetails(order, b, couriers, by);
        await saveOrder(order); await audit('shipment.details', { number, courier: order.shipment.courier, tracking: order.shipment.trackingNumber, eta: order.shipment.eta });
        return respond();
      }
      if (req.method === 'POST') {
        const status = v.oneOf(b.status, OPS.SHIP_STATUSES, 'Shipment status');
        const before = order.status;
        OPS.applyShipmentStatus(order, { status, note: b.note, by, pod: b.pod, rescheduleTo: b.rescheduleTo });
        await saveOrder(order);
        if (before !== order.status && ['dispatched', 'delivered', 'returned'].includes(order.status)) await sendEmail(statusEmail(order, siteUrl(req)));
        await audit('shipment.status', { number, status, order: order.status });
        return respond();
      }
      break;
    }
    case 'exception': {
      if (req.method === 'POST') { OPS.openException(order, b, by); await saveOrder(order); await audit('shipment.exception_open', { number, kind: b.kind }); return respond(201); }
      if (req.method === 'PATCH') { OPS.resolveException(order, b.resolution, by); await saveOrder(order); await audit('shipment.exception_resolve', { number, resolution: b.resolution }); return respond(); }
      break;
    }

    // ---- refunds
    case 'refunds': {
      money();
      if (req.method === 'POST' && !subId) {
        const r = await idempotent(req, `${by}:refund:${number}`, b, async () => {
          const rf = OPS.requestRefund(order, b, admin, cfg.refundApprovalThreshold);
          if (!rf.needsApproval) await finishRefund(rf);
          await saveOrder(order);
          await audit(rf.needsApproval ? 'refund.request' : 'refund.issue', { number, id: rf.id, amount: rf.amount, reason: rf.reason, status: rf.status, needsApproval: rf.needsApproval });
          return { status: 201, body: { refund: rf } };
        });
        if (r.body.refund?.status === 'failed') fail(502, 'refund_failed', `The payment provider rejected the refund: ${r.body.refund.error}`);
        const fresh = await getOrder(number);
        Object.assign(order, fresh);
        return json({ ...detail(order, await all(), couriers, admin, cfg, companies, (await commerce()).returns), refund: r.body.refund, replayed: !!r.replayed }, 201);
      }
      if (req.method === 'POST' && subId && ['approve', 'reject'].includes(op)) {
        const rf = (order.refunds || []).find((x) => x.id === subId);
        if (!rf || rf.status !== 'requested') fail(404, 'not_found', 'No refund awaiting approval with that ID.');
        if (op === 'approve') {
          if (rf.requestedBy === by && admin.role !== 'owner') fail(403, 'second_approver', 'A different manager must approve a refund above the threshold.');
          if (rf.requestedBy === by && admin.role === 'owner' && process.env.CNM_OWNER_SELF_APPROVE !== 'true') fail(403, 'second_approver', 'A second person must approve a refund above the threshold.');
          await finishRefund(rf);
          await saveOrder(order);
          await audit('refund.approve', { number, id: rf.id, amount: rf.amount, status: rf.status });
          if (rf.status === 'failed') fail(502, 'refund_failed', `The payment provider rejected the refund: ${rf.error}`);
        } else {
          Object.assign(rf, { status: 'rejected', rejectedBy: by, rejectedAt: new Date().toISOString(), rejectReason: v.str(b.reason, { name: 'Reason', min: 3, max: 200 }) });
          await saveOrder(order); await audit('refund.reject', { number, id: rf.id, amount: rf.amount });
        }
        return respond();
      }
      break;
    }

    // ---- returns
    case 'returns': {
      if (req.method === 'POST' && !subId) {
        const r = await idempotent(req, `${by}:return:${number}`, b, async () => {
          const rt = OPS.createReturn(order, b, by, (await commerce()).returns);
          await saveOrder(order); await audit('return.create', { number, rma: rt.rma, kind: rt.kind, reason: rt.reason, value: rt.value });
          return { status: 201, body: { rma: rt.rma } };
        });
        Object.assign(order, await getOrder(number));
        return json({ ...detail(order, await all(), couriers, admin, cfg, companies, (await commerce()).returns), rma: r.body.rma }, 201);
      }
      if (req.method === 'POST' && subId) {
        const status = v.oneOf(b.status, ['approved', 'rejected', 'received', 'inspected', 'exchanged', 'credited'], 'Return status');
        if (status === 'refunded') fail(422, 'invalid', 'Issue the refund from the return; it completes automatically.');
        const rt = OPS.moveReturn(order, decodeURIComponent(subId), status, b.note, by);
        if (status === 'inspected' && b.restock) { await restock(rt.lines, baseProducts); rt.restocked = true; rt.history.push({ status: 'restocked', at: new Date().toISOString(), by }); }
        await saveOrder(order); await audit('return.status', { number, rma: rt.rma, status, restock: !!b.restock });
        return respond();
      }
      break;
    }
    default: break;
  }
  fail(405, 'method', 'Method not allowed.');

  // ------------------------------------------------------------ helpers that need the request context
  async function finishRefund(rf) {
    await OPS.executeRefund(order, rf, providerOf(order), admin);
    if (rf.status === 'succeeded' && rf.rma) {
      const rt = (order.returns || []).find((x) => x.rma === rf.rma);
      if (rt && rt.status === 'inspected') OPS.moveReturn(order, rt.rma, 'refunded', `Refund ${rf.id}`, admin.email);
    }
    if (rf.status === 'succeeded') await sendEmail(statusEmail(order, siteUrl(req)));
  }

  async function manualOrder() {
    money();
    const r = await idempotent(req, `${admin.email}:orders.manual`, b, async () => {
      const companyId = b.companyId || 'essentials';
      if (scope && !scope.includes(companyId)) fail(403, 'forbidden', 'You do not have access to that company.');
      if (companyId !== 'essentials') fail(422, 'invalid', 'Manual orders need a product catalogue; only CNM Essentials has one so far.');
      const [products, rules] = await Promise.all([productsMap(), commerce()]);
      if (!Array.isArray(b.items) || !b.items.length) fail(422, 'invalid', 'Add at least one product.');
      const items = b.items.slice(0, 50).map((i) => ({ id: String(i?.id || '').slice(0, 80), qty: Number(i?.qty) }));
      const contact = parseContact(b.contact, { phoneRequired: true });
      const delivery = parseDelivery(b.delivery, rules, stores);
      const quote = computeQuote({ items, products, commerce: rules, promoCode: b.promoCode || undefined, deliveryMethod: delivery.method });
      if (!quote.lines.length || quote.errors.length) fail(409, 'stock', quote.errors.map((x) => x.message).join(' ') || 'Check the products and quantities.');
      const mode = v.oneOf(b.paymentMode, ['paid', 'link', 'unpaid'], 'Payment');
      const channel = v.oneOf(b.channel || 'manual', ['manual', 'pos'], 'Channel');
      const now = new Date().toISOString();
      const number = orderNumber();
      const order = {
        number, accessToken: randomToken(24), userId: null, status: 'pending_payment', createdAt: now, updatedAt: now, companyId, channel, placedBy: admin.email,
        contact, delivery, notes: v.str(b.note, { name: 'Note', max: 300, required: false }), lines: quote.lines, promoCode: quote.promo?.valid ? quote.promo.code : null,
        totals: { subtotal: quote.subtotal, discount: quote.discount, delivery: quote.delivery, vat: quote.vat, vatIncluded: quote.vatIncluded, total: quote.total, currency: 'NGN' },
        payment: { provider: mode === 'link' ? activeProvider().name : 'manual', method: mode === 'paid' ? v.oneOf(b.paymentMethod, ['bank_transfer', 'cash', 'pos_card', 'ussd', 'card'], 'Payment method') : (b.paymentMethod || 'bank_transfer'), reference: `${number}-${randomToken(4)}`, status: 'pending' },
        history: [{ status: 'pending_payment', at: now, by: admin.email, note: `Manual order (${channel})` }],
      };
      let link = null;
      if (mode === 'paid') {
        const reason = v.str(b.paymentReason, { name: 'Payment reference or reason', min: 3, max: 200 });
        Object.assign(order.payment, { status: 'paid', paidAt: now, recordedBy: admin.email, note: reason });
        setStatus(order, 'paid', `Payment recorded by staff (${order.payment.method.replace(/_/g, ' ')}): ${reason}`, admin.email);
      }
      await saveOrder(order);
      if (mode === 'paid') { await commitStock(order, baseProducts); await sendEmail(orderConfirmationEmail(order, siteUrl(req))); }
      if (mode === 'link') {
        const provider = activeProvider();
        const pay = await provider.initialize(order, { channels: ['card', 'bank_transfer', 'ussd'], callbackUrl: `${siteUrl(req)}/checkout/confirmation/?n=${encodeURIComponent(number)}&t=${encodeURIComponent(order.accessToken)}` });
        link = pay.authorizationUrl || null;
      }
      await audit('order.manual', { number, total: order.totals.total, mode, channel });
      return { status: 201, body: { number, status: order.status, paymentLink: link, note: mode === 'link' && !link ? 'Payment links need Paystack. On staging (simulated payments) no link is created; record the payment when it arrives.' : undefined } };
    });
    return json({ ...r.body, ...(r.replayed ? { replayed: true } : {}) }, r.status);
  }

  async function bulk() {
    const action = v.oneOf(b.action, ['pack'], 'Action');
    if (!Array.isArray(b.numbers) || !b.numbers.length || b.numbers.length > 100) fail(422, 'invalid', 'Choose between 1 and 100 orders.');
    const results = [];
    for (const n of b.numbers) {
      const o = await getOrder(String(n));
      if (!o || !inScope(o)) { results.push({ number: n, ok: false, error: 'Not found' }); continue; }
      try {
        OPS.ensureShipment(o);
        if (action === 'pack') OPS.applyShipmentStatus(o, { status: 'packed', by: admin.email, note: 'Bulk: packed' });
        await saveOrder(o); results.push({ number: n, ok: true });
      } catch (err) { results.push({ number: n, ok: false, error: err.message }); }
    }
    await audit('orders.bulk', { action, ok: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length });
    return json({ results });
  }
});

export const config = { path: ['/api/ops/:area', '/api/ops/:area/:id', '/api/ops/:area/:id/:sub', '/api/ops/:area/:id/:sub/:subId', '/api/ops/:area/:id/:sub/:subId/:op'] };

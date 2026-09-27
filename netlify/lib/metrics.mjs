// Command Center metrics for the CNM Group operating system.
// Pure functions over plain records (orders, daily event aggregates, enquiries, inventory, companies) so the same
// logic runs in the Netlify function, in unit tests and, later, against Postgres rollups (see docs/ADMIN-OS-SPEC.md).
//
// Definitions (kept deliberately explicit — finance and operations read these numbers):
//   Gross sales      merchandise subtotal of paid orders placed in the range (before discounts, excl. delivery)
//   Discounts        promo discounts on those orders
//   Refunds          money returned in the range (partial refunds use the refunded amount)
//   Net sales        gross − discounts − refunds
//   Revenue          money collected: order totals of paid orders (incl. delivery, VAT included) − refunds
//   Orders           paid orders placed in the range; AOV = order totals ÷ orders
//   Active users     sum of daily active browsers (cookie-less, one beacon per browser per day per company)
//   Conversion       paid orders ÷ active users
// Days are bucketed in Africa/Lagos time (UTC+1, no daylight saving).

export const PAID = ['paid', 'processing', 'dispatched', 'delivered', 'refunded'];
export const AWAITING_FULFILMENT = ['paid', 'processing'];
const LAGOS_OFFSET = 3600e3;
const DAY = 864e5;
export const SLA = { fulfilHours: 48, deliverDays: 5, paymentHours: 24, enquiryHours: 24 };
export const LOW_STOCK = 5;

export const dayKey = (iso) => new Date(Date.parse(iso) + LAGOS_OFFSET).toISOString().slice(0, 10);
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
export const dayList = (from, to) => [...Array(Math.max(0, daysBetween(from, to)))].map((_, i) => addDays(from, i));
const inRange = (day, r) => day >= r.from && day <= r.to;
const round = (n) => Math.round(n * 100) / 100;
const pct = (a, b) => (b ? round(((a - b) / b) * 100) : a ? null : 0); // null = "new" (no base to compare with)

/** The comparison window for a range: the previous period of equal length, or the same dates last year. */
export function compareRange({ from, to }, mode = 'previous') {
  if (mode === 'none') return null;
  if (mode === 'year') {
    const shift = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`.replace(/-02-29$/, '-02-28');
    return { from: shift(from), to: shift(to) };
  }
  const len = daysBetween(from, to);
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

export const orderCompany = (o) => o.companyId || 'essentials';
export const orderChannel = (o) => o.channel || 'web';
export function orderLocation(o, stores = []) {
  if (o.delivery?.address?.state) return o.delivery.address.state;
  const st = stores.find((s) => s.slug === o.delivery?.storeSlug);
  return st?.region || st?.city || 'Pickup';
}
export const refundOf = (o) => (o.status === 'refunded' || o.payment?.refund ? Number(o.payment?.refund?.amount ?? o.totals.total) : 0);
const refundDay = (o) => dayKey(o.payment?.refund?.at || o.history?.findLast?.((h) => h.status === 'refunded')?.at || o.updatedAt || o.createdAt);
const statusAt = (o, status) => o.history?.findLast?.((h) => h.status === status)?.at || null;
const hoursSince = (iso, now) => (now - Date.parse(iso)) / 36e5;
/** "52 h" under two days, then "37 days". */
export const age = (h) => (h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} days`);

/** Filter orders by the dashboard filters (company, location, channel). `companies` = the caller's allowed scope. */
export function filterOrders(orders, { company = 'all', location = 'all', channel = 'all', scope = null, stores = [] } = {}) {
  return orders.filter((o) => (company === 'all' || orderCompany(o) === company)
    && (!scope || scope.includes(orderCompany(o)))
    && (location === 'all' || orderLocation(o, stores) === location)
    && (channel === 'all' || orderChannel(o) === channel));
}

/** Sales totals for one window. */
export function salesFor(orders, r) {
  const placed = orders.filter((o) => inRange(dayKey(o.createdAt), r));
  const paid = placed.filter((o) => PAID.includes(o.status));
  const gross = paid.reduce((s, o) => s + (o.totals.subtotal || 0), 0);
  const discounts = paid.reduce((s, o) => s + (o.totals.discount || 0), 0);
  const delivery = paid.reduce((s, o) => s + (o.totals.delivery || 0), 0);
  const vat = paid.reduce((s, o) => s + (o.totals.vat || 0), 0);
  const collected = paid.reduce((s, o) => s + (o.totals.total || 0), 0);
  const refundedOrders = orders.filter((o) => refundOf(o) > 0 && inRange(refundDay(o), r));
  const refunds = refundedOrders.reduce((s, o) => s + refundOf(o), 0);
  const units = paid.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.qty, 0), 0);
  return {
    gross: round(gross), discounts: round(discounts), refunds: round(refunds), net: round(gross - discounts - refunds),
    delivery: round(delivery), vat: round(vat), revenue: round(collected - refunds), orders: paid.length, units,
    aov: paid.length ? round(collected / paid.length) : 0, refundCount: refundedOrders.length,
    placed: placed.length, paymentFailed: placed.filter((o) => o.status === 'payment_failed').length,
    delivered: orders.filter((o) => o.status === 'delivered' && inRange(dayKey(statusAt(o, 'delivered') || o.updatedAt || o.createdAt), r)).length,
    failedDeliveries: orders.filter((o) => (o.history || []).some((h) => h.status === 'delivery_failed' && inRange(dayKey(h.at), r))).length,
  };
}

/** Daily active users and funnel counts from the daily event aggregates. */
export function trafficFor(days, r, company = 'all', scope = null) {
  const pick = (d) => {
    if (company !== 'all') return d.byCompany?.[company] || {};
    if (scope) return scope.reduce((acc, c) => { for (const [k, n] of Object.entries(d.byCompany?.[c] || {})) acc[k] = (acc[k] || 0) + n; return acc; }, {});
    return d.counts || {};
  };
  const inR = days.filter((d) => inRange(d.date, r));
  const sum = (k) => inR.reduce((s, d) => s + (pick(d)[k] || 0), 0);
  const active = sum('active_user');
  return {
    activeUsers: active, dauAvg: inR.length ? Math.round(active / daysBetween(r.from, r.to)) : 0,
    funnel: { visits: active, views: sum('view_item'), addToCart: sum('add_to_cart'), checkout: sum('begin_checkout'), payment: sum('add_payment_info'), purchase: sum('purchase') },
    daily: Object.fromEntries(inR.map((d) => [d.date, pick(d).active_user || 0])),
  };
}

function series(orders, r, days) {
  const list = dayList(r.from, r.to);
  const map = Object.fromEntries(list.map((d) => [d, { date: d, gross: 0, net: 0, revenue: 0, orders: 0, active: days?.[d] || 0 }]));
  for (const o of orders) {
    const d = dayKey(o.createdAt);
    if (!map[d] || !PAID.includes(o.status)) continue;
    map[d].gross += o.totals.subtotal || 0;
    map[d].net += (o.totals.subtotal || 0) - (o.totals.discount || 0);
    map[d].revenue += o.totals.total || 0;
    map[d].orders += 1;
  }
  for (const o of orders) {
    const amt = refundOf(o);
    if (!amt) continue;
    const d = refundDay(o);
    if (map[d]) { map[d].net -= amt; map[d].revenue -= amt; }
  }
  return list.map((d) => ({ ...map[d], gross: round(map[d].gross), net: round(map[d].net), revenue: round(map[d].revenue) }));
}

function productStats(orders, r, products, eventDays, company) {
  const stats = {};
  const get = (id, name) => (stats[id] ||= { id, name, units: 0, revenue: 0, views: 0 });
  for (const o of orders) {
    if (!PAID.includes(o.status) || !inRange(dayKey(o.createdAt), r)) continue;
    for (const l of o.lines) { const s = get(l.id, l.name); s.units += l.qty; s.revenue = round(s.revenue + l.lineTotal); }
  }
  if (company === 'all' || company === 'essentials') {
    for (const d of eventDays.filter((x) => inRange(x.date, r))) {
      for (const [p, n] of Object.entries(d.pages || {})) {
        const slug = p.match(/^\/products\/([^/]+)\/?$/)?.[1];
        const prod = slug && products.find((x) => x.slug === slug);
        if (prod) get(prod.id, prod.name).views += n;
      }
    }
  }
  return stats;
}

/**
 * Everything the Command Center shows, for one set of filters.
 * @param data  { orders, eventDays, enquiries, inventory, products, companies, stores }
 * @param q     { from, to, compare, company, location, channel, scope, now }
 */
export function commandCenter(data, q) {
  const now = q.now ?? Date.now();
  const { orders: all = [], eventDays = [], enquiries = [], products = [], companies = [], stores = [], inventory = {} } = data;
  const scope = q.scope || null;
  // Archived companies leave the day-to-day table (their history still counts in totals) unless explicitly selected.
  const visibleCompanies = companies.filter((c) => (!scope || scope.includes(c.id)) && (c.status !== 'archived' || q.company === c.id));
  const r = { from: q.from, to: q.to };
  const c = compareRange(r, q.compare);
  const orders = filterOrders(all, { ...q, scope, stores });
  const cur = salesFor(orders, r);
  const prev = c ? salesFor(orders, c) : null;
  const tCur = trafficFor(eventDays, r, q.company, scope);
  const tPrev = c ? trafficFor(eventDays, c, q.company, scope) : null;
  const conv = (s, t) => (t.activeUsers ? round((s.orders / t.activeUsers) * 100) : null);

  const kpi = (key, value, before, extra = {}) => ({ key, value, previous: before, delta: before == null || value == null ? null : pct(value, before), ...extra });
  const kpis = [
    kpi('revenue', cur.revenue, prev?.revenue, { money: true }),
    kpi('net', cur.net, prev?.net, { money: true }),
    kpi('gross', cur.gross, prev?.gross, { money: true }),
    kpi('orders', cur.orders, prev?.orders),
    kpi('aov', cur.aov, prev?.aov, { money: true }),
    kpi('activeUsers', tCur.activeUsers, tPrev?.activeUsers),
    kpi('conversion', conv(cur, tCur), tPrev ? conv(prev, tPrev) : null, { percent: true }),
    kpi('delivered', cur.delivered, prev?.delivered),
    kpi('failedDeliveries', cur.failedDeliveries, prev?.failedDeliveries, { inverse: true }),
    kpi('refunds', cur.refunds, prev?.refunds, { money: true, inverse: true, count: cur.refundCount }),
  ];

  // Operational state is "as of now" (not range-bound): what needs doing today.
  const live = filterOrders(all, { ...q, scope, stores });
  const awaitingPayment = live.filter((o) => o.status === 'pending_payment');
  const toFulfil = live.filter((o) => AWAITING_FULFILMENT.includes(o.status));
  const inTransit = live.filter((o) => o.status === 'dispatched');
  const lateFulfil = toFulfil.filter((o) => hoursSince(statusAt(o, 'paid') || o.createdAt, now) > SLA.fulfilHours);
  const lateDelivery = inTransit.filter((o) => hoursSince(statusAt(o, 'dispatched') || o.updatedAt, now) > SLA.deliverDays * 24);
  const stalePayment = awaitingPayment.filter((o) => hoursSince(o.createdAt, now) > SLA.paymentHours);

  const stock = products.map((p) => ({ id: p.id, name: p.name, company: 'essentials', stock: inventory[p.id]?.stock ?? p.stock?.quantity ?? null }))
    .filter((p) => p.stock != null && p.stock <= LOW_STOCK && (q.company === 'all' || q.company === p.company) && (!scope || scope.includes(p.company)))
    .sort((a, b) => a.stock - b.stock);

  const leadsIn = enquiries.filter((e) => (!scope || scope.includes(e.companyId)) && (q.company === 'all' || e.companyId === q.company));
  const newLeads = leadsIn.filter((e) => e.status === 'new');
  const staleLeads = newLeads.filter((e) => hoursSince(e.createdAt, now) > SLA.enquiryHours);

  const ops = {
    awaitingPayment: awaitingPayment.length, toFulfil: toFulfil.length, inTransit: inTransit.length,
    lateFulfil: lateFulfil.length, lateDelivery: lateDelivery.length, lowStock: stock.length, outOfStock: stock.filter((s) => s.stock === 0).length,
    newLeads: newLeads.length, leadsInRange: leadsIn.filter((e) => inRange(dayKey(e.createdAt), r)).length,
  };

  // Needs attention, most urgent first.
  const attention = [
    ...lateFulfil.map((o) => ({ severity: 'high', kind: 'late_fulfilment', company: orderCompany(o), title: `${o.number} not dispatched`, detail: `Paid ${age(hoursSince(statusAt(o, 'paid') || o.createdAt, now))} ago · target ${SLA.fulfilHours} h`, href: `#orders/${encodeURIComponent(o.number)}` })),
    ...lateDelivery.map((o) => ({ severity: 'high', kind: 'late_delivery', company: orderCompany(o), title: `${o.number} delivery overdue`, detail: `In transit for ${Math.floor(hoursSince(statusAt(o, 'dispatched') || o.updatedAt, now) / 24)} days`, href: `#orders/${encodeURIComponent(o.number)}` })),
    ...stock.filter((s) => s.stock === 0).map((s) => ({ severity: 'high', kind: 'out_of_stock', company: s.company, title: `${s.name} is out of stock`, detail: 'Hidden from sale until restocked', href: '#inventory' })),
    ...stock.filter((s) => s.stock > 0).map((s) => ({ severity: 'medium', kind: 'low_stock', company: s.company, title: `${s.name}: ${s.stock} left`, detail: `At or below the ${LOW_STOCK}-unit alert`, href: '#inventory' })),
    ...staleLeads.map((e) => ({ severity: 'medium', kind: 'stale_lead', company: e.companyId, title: `${e.name} is waiting for a reply`, detail: `${e.subject || e.interest || 'Enquiry'} · ${age(hoursSince(e.createdAt, now))} ago`, href: '#enquiries' })),
    ...stalePayment.map((o) => ({ severity: 'low', kind: 'stale_payment', company: orderCompany(o), title: `${o.number} awaiting payment`, detail: `Started ${age(hoursSince(o.createdAt, now))} ago`, href: `#orders/${encodeURIComponent(o.number)}` })),
  ];
  if (cur.paymentFailed) attention.push({ severity: 'low', kind: 'payment_failures', company: q.company === 'all' ? 'group' : q.company, title: `${cur.paymentFailed} failed payment${cur.paymentFailed === 1 ? '' : 's'} in range`, detail: 'Check the payment provider dashboard for declines', href: '#orders?status=payment_failed' });
  const rank = { high: 0, medium: 1, low: 2 };
  attention.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // Per-company roll-up (always all visible companies, so the group view shows who needs attention).
  const byCompany = visibleCompanies.map((co) => {
    const os = filterOrders(all, { company: co.id, location: q.location, channel: q.channel, stores });
    const s = salesFor(os, r);
    const p = c ? salesFor(os, c) : null;
    const t = trafficFor(eventDays, r, co.id);
    return {
      id: co.id, name: co.name, color: co.color, logo: co.logo, status: co.status, kind: co.kind,
      revenue: s.revenue, orders: s.orders, net: s.net, delta: p ? pct(s.revenue, p.revenue) : null, activeUsers: t.activeUsers,
      leads: enquiries.filter((e) => e.companyId === co.id && inRange(dayKey(e.createdAt), r)).length,
      attention: attention.filter((a) => a.company === co.id).length,
      spark: series(os, r).map((d) => d.revenue),
    };
  });
  const totalRev = byCompany.reduce((s, x) => s + x.revenue, 0);
  byCompany.forEach((x) => { x.share = totalRev ? round((x.revenue / totalRev) * 100) : 0; });

  const loc = {};
  for (const o of orders) {
    if (!PAID.includes(o.status) || !inRange(dayKey(o.createdAt), r)) continue;
    const k = orderLocation(o, stores);
    loc[k] ||= { location: k, orders: 0, revenue: 0 };
    loc[k].orders += 1; loc[k].revenue = round(loc[k].revenue + o.totals.total);
  }
  const channels = {};
  for (const o of orders) {
    if (!PAID.includes(o.status) || !inRange(dayKey(o.createdAt), r)) continue;
    const k = orderChannel(o);
    channels[k] ||= { channel: k, orders: 0, revenue: 0 };
    channels[k].orders += 1; channels[k].revenue = round(channels[k].revenue + o.totals.total);
  }

  const ps = productStats(orders, r, products, eventDays, q.company);
  const pPrev = c ? productStats(orders, c, products, eventDays, q.company) : {};
  const plist = Object.values(ps);
  const topSellers = plist.filter((p) => p.units).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const topViewed = plist.filter((p) => p.views).sort((a, b) => b.views - a.views).slice(0, 8)
    .map((p) => ({ ...p, conversion: p.views ? round((p.units / p.views) * 100) : 0 }));
  const trending = plist.map((p) => ({ ...p, before: pPrev[p.id]?.units || 0, growth: pct(p.units, pPrev[p.id]?.units || 0) }))
    .filter((p) => p.units > p.before).sort((a, b) => (b.units - b.before) - (a.units - a.before)).slice(0, 6);

  // Live activity: newest first.
  const feed = [];
  for (const o of live) for (const h of o.history || []) feed.push({ at: h.at, kind: 'order', status: h.status, company: orderCompany(o), title: `${o.number} ${h.status.replace(/_/g, ' ')}`, detail: `${o.contact?.firstName || ''} ${o.contact?.lastName || ''} · ₦${Math.round(o.totals.total).toLocaleString('en-NG')}`.trim(), href: `#orders/${encodeURIComponent(o.number)}` });
  for (const e of leadsIn) feed.push({ at: e.createdAt, kind: 'lead', status: e.status, company: e.companyId, title: `New ${e.companyId === 'spectra' ? 'appointment request' : e.companyId === 'foundation' ? 'pledge / enquiry' : e.companyId === 'cnmworx' ? 'proposal request' : 'enquiry'}`, detail: `${e.name}${e.subject ? ` · ${e.subject}` : ''}`, href: '#enquiries' });
  feed.sort((a, b) => b.at.localeCompare(a.at));

  return {
    range: r, compare: c, filters: { company: q.company, location: q.location, channel: q.channel },
    kpis, sales: cur, previous: prev, traffic: tCur, ops, attention: attention.slice(0, 30),
    series: series(orders, r, tCur.daily), compareSeries: c ? series(orders, c, tPrev.daily) : null,
    byCompany, byLocation: Object.values(loc).sort((a, b) => b.revenue - a.revenue), byChannel: Object.values(channels).sort((a, b) => b.revenue - a.revenue),
    topSellers, topViewed, trending, lowStock: stock.slice(0, 10), feed: feed.slice(0, 25),
    options: {
      locations: [...new Set(all.filter((o) => !scope || scope.includes(orderCompany(o))).map((o) => orderLocation(o, stores)))].sort(),
      channels: ['web', 'app', 'manual', 'pos'],
    },
    generatedAt: new Date(now).toISOString(),
  };
}

/** A cheap change stamp for live updates: the client only refetches the Command Center when this changes. */
export function pulseStamp(orders, enquiries) {
  const latest = [...orders.map((o) => o.updatedAt || o.createdAt), ...enquiries.map((e) => e.updatedAt || e.createdAt)].sort().at(-1) || '';
  return `${orders.length}.${enquiries.length}.${latest}`;
}

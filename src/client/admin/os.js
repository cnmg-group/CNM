// CNM Group OS — Command Center, Companies and Audit log views.
// Filters live in the URL hash (#command?from=…&to=…&company=…) so any view can be bookmarked or shared.
import { escapeHtml as e, formatMoney } from '../../shared/format.mjs';
import { api } from '../api.js';
import { bindTrend, compactMoney, funnel, grossNetBars, hbars, sparkline, trendChart } from './charts.js';

const LAGOS = 3600e3;
export const today = () => new Date(Date.now() + LAGOS).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const fmtDay = (d, year = false) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
const rangeText = (r) => (r.from === r.to ? fmtDay(r.from, true) : `${fmtDay(r.from, r.from.slice(0, 4) !== r.to.slice(0, 4))} – ${fmtDay(r.to, true)}`);
const timeAgo = (iso) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDay(iso.slice(0, 10));
};

export const PRESETS = [['today', 'Today', 0], ['7d', '7 days', 6], ['30d', '30 days', 29], ['90d', '90 days', 89], ['ytd', 'Year to date', null], ['12m', '12 months', 364]];
export function readFilters() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const preset = q.get('range') || (q.get('from') ? 'custom' : '30d');
  let from = q.get('from');
  let to = q.get('to') || today();
  if (preset !== 'custom') {
    to = today();
    const p = PRESETS.find(([k]) => k === preset) || PRESETS[2];
    from = p[0] === 'ytd' ? `${to.slice(0, 4)}-01-01` : addDays(to, -p[2]);
  }
  return { preset, from, to, compare: q.get('compare') || 'previous', company: q.get('company') || 'all', location: q.get('location') || 'all', channel: q.get('channel') || 'all' };
}
export function writeFilters(view, f) {
  const q = new URLSearchParams();
  if (f.preset === 'custom') { q.set('from', f.from); q.set('to', f.to); } else if (f.preset !== '30d') q.set('range', f.preset);
  for (const k of ['compare', 'company', 'location', 'channel']) if (f[k] && f[k] !== { compare: 'previous' }[k] && f[k] !== 'all') q.set(k, f[k]);
  const s = q.toString();
  const next = `#${view}${s ? `?${s}` : ''}`;
  if (location.hash !== next) location.hash = next;
}

const KPI = {
  revenue: ['Revenue', 'Collected, after refunds'], net: ['Net sales', 'Gross − discounts − refunds'], gross: ['Gross sales', 'Merchandise, before discounts'],
  orders: ['Orders', 'Paid orders'], aov: ['Average order', 'Per paid order'], activeUsers: ['Active users', 'Daily active, summed'],
  conversion: ['Conversion', 'Orders ÷ active users'], delivered: ['Delivered', 'Completed in range'], failedDeliveries: ['Failed deliveries', 'Courier exceptions'], refunds: ['Refunds', 'Money returned'],
};
const kpiValue = (k) => (k.value == null ? '—' : k.money ? compactMoney(k.value) : k.percent ? `${k.value}%` : k.value.toLocaleString('en-NG'));
function delta(k, compareOn) {
  if (!compareOn) return '';
  if (k.delta == null) return k.value ? '<span class="d d--new">New</span>' : '<span class="d">—</span>';
  if (k.delta === 0 && !k.value) return '<span class="d muted">—</span>';
  const good = k.inverse ? k.delta < 0 : k.delta > 0;
  const cls = k.delta === 0 ? '' : good ? 'd--up' : 'd--down';
  return `<span class="d ${cls}">${k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '•'} ${Math.abs(k.delta)}%</span>`;
}
/** Long ranges read better as weekly totals (a year of daily points is noise). */
const bucket = (series) => {
  if (!series || series.length <= 120) return series;
  const out = [];
  for (let i = 0; i < series.length; i += 7) {
    const w = series.slice(i, i + 7);
    out.push(w.reduce((acc, d) => ({ ...acc, gross: acc.gross + d.gross, net: acc.net + d.net, revenue: acc.revenue + d.revenue, orders: acc.orders + d.orders }), { date: w[0].date, gross: 0, net: 0, revenue: 0, orders: 0 }));
  }
  return out;
};
const pill = (s) => `<span class="pill pill--${e(s)}">${e(String(s).replace(/_/g, ' '))}</span>`;

let companiesCache = null;
async function companies() {
  if (!companiesCache) companiesCache = (await api('/api/admin/companies', { loader: false })).companies;
  return companiesCache;
}
export const resetCompanies = () => { companiesCache = null; };
const coOf = (list, id) => list.find((c) => c.id === id);
const coChip = (c) => (c ? `<span class="co-chip"><i style="background:${e(c.color || '#999')}"></i>${e(c.name)}</span>` : '<span class="co-chip"><i style="background:#d4b06a"></i>CNM Group</span>');

/* ------------------------------------------------------------------ Command Center */
let liveTimer = null;
export const stopLive = () => { clearInterval(liveTimer); liveTimer = null; };

export async function command(v, ctx) {
  const f = readFilters();
  const cos = await companies();
  const qs = new URLSearchParams({ from: f.from, to: f.to, compare: f.compare, company: f.company, location: f.location, channel: f.channel });
  const d = await api(`/api/admin/command?${qs}`, { loader: false });
  const compareOn = !!d.compare;
  const co = coOf(cos, f.company);
  const k = Object.fromEntries(d.kpis.map((x) => [x.key, x]));
  const accent = co?.color || '#b08d4c';
  v.style.setProperty('--os-accent', accent);

  const opsTiles = [
    ['awaitingPayment', 'Awaiting payment', '#orders?status=pending_payment'], ['toFulfil', 'To fulfil', '#orders?status=paid'], ['inTransit', 'In transit', '#orders?status=dispatched'],
    ['lateFulfil', 'Late to dispatch', '#orders?status=paid', true], ['lateDelivery', 'Delivery overdue', '#orders?status=dispatched', true], ['exceptions', 'Delivery problems', '#orders?exception=1', true], ['lowStock', 'Low stock', '#inventory', true], ['newLeads', 'New leads', '#enquiries'],
  ];

  v.innerHTML = `<header class="os-head">
    <div><p class="os-eyebrow">${co ? coChip(co) : 'CNM Group · all companies'}</p><h1 class="os-title">Command Center</h1>
    <p class="os-sub">${e(rangeText(d.range))}${compareOn ? ` <span>vs ${e(rangeText(d.compare))}</span>` : ''}${d.filters.location !== 'all' ? ` · ${e(d.filters.location)}` : ''}${d.filters.channel !== 'all' ? ` · ${e(d.filters.channel)}` : ''}</p></div>
    <div class="os-live" data-live><span class="os-live__dot"></span><span data-live-text>Live · updated ${e(timeAgo(d.generatedAt))}</span></div>
  </header>
  ${filterBar(f, cos, d.options, ctx.me)}
  <section class="os-kpis" aria-label="Key metrics">${Object.keys(KPI).map((key) => {
    const x = k[key];
    return `<article class="os-kpi${key === 'revenue' ? ' os-kpi--hero' : ''}"><h3>${KPI[key][0]}</h3><strong>${kpiValue(x)}</strong><p>${delta(x, compareOn)}<span class="muted">${compareOn && x.previous != null ? `${x.money ? compactMoney(x.previous) : x.percent ? `${x.previous}%` : x.previous.toLocaleString('en-NG')} before` : KPI[key][1]}</span></p>${x.count != null && key === 'refunds' ? `<small class="muted">${x.count} refund${x.count === 1 ? '' : 's'}</small>` : ''}</article>`;
  }).join('')}</section>
  <section class="os-ops" aria-label="Right now">${opsTiles.map(([key, label, href, warn]) => `<a class="os-op${warn && d.ops[key] ? ' os-op--warn' : ''}" href="${href}"><strong>${d.ops[key]}</strong><span>${label}</span></a>`).join('')}</section>

  <div class="os-grid os-grid--2-1">
    <section class="os-card"><header class="os-card__h"><h2>Revenue trend${d.series.length > 120 ? ' <small class="muted">weekly</small>' : ''}</h2><div class="os-legend"><span><i class="k k--cur"></i>${e(rangeText(d.range))}</span>${compareOn ? `<span><i class="k k--prev"></i>${e(rangeText(d.compare))}</span>` : ''}</div></header>
      ${trendChart(bucket(d.series), bucket(d.compareSeries), { key: 'revenue', label: d.series.length > 120 ? 'Revenue per week' : 'Revenue per day' })}</section>
    <section class="os-card os-attn"><header class="os-card__h"><h2>Needs attention</h2><span class="os-count${d.attention.length ? ' is-warn' : ''}">${d.attention.length}</span></header>
      ${d.attention.length ? `<ul>${d.attention.slice(0, 9).map((a) => `<li class="sev sev--${a.severity}"><a href="${e(a.href)}"><span class="sev__dot"></span><span><strong>${e(a.title)}</strong><small>${e(a.detail)}${a.company && a.company !== 'group' ? ` · ${e(coOf(cos, a.company)?.name || a.company)}` : ''}</small></span></a></li>`).join('')}</ul>${d.attention.length > 9 ? `<p class="muted os-more">+ ${d.attention.length - 9} more</p>` : ''}` : '<p class="os-empty">All clear. Nothing late, nothing out of stock, no one waiting for a reply.</p>'}</section>
  </div>

  <section class="os-card"><header class="os-card__h"><h2>Companies</h2><span class="muted">Revenue share · ${e(rangeText(d.range))}</span></header>
    <div class="os-table-wrap"><table class="os-cos"><thead><tr><th>Company</th><th class="num">Revenue</th><th class="num">vs before</th><th>Share</th><th class="num">Orders</th><th class="num">Active users</th><th class="num">Leads</th><th class="num">Attention</th><th>Trend</th></tr></thead><tbody>
    ${d.byCompany.map((c) => `<tr data-co="${e(c.id)}" tabindex="0"${c.status === 'archived' ? ' class="is-archived"' : ''}><td>${c.logo ? `<img src="${e(c.logo)}" alt="" class="os-cos__logo">` : ''}<strong>${e(c.name)}</strong>${c.status === 'archived' ? ' <small class="muted">archived</small>' : ''}</td><td class="num">${formatMoney(c.revenue)}</td><td class="num">${compareOn ? delta({ delta: c.delta, value: c.revenue }, true) : '—'}</td><td><span class="share"><span style="width:${c.share}%;background:${e(c.color || '#999')}"></span></span><small>${c.share}%</small></td><td class="num">${c.orders}</td><td class="num">${c.activeUsers.toLocaleString('en-NG')}</td><td class="num">${c.leads}</td><td class="num">${c.attention ? `<span class="os-count is-warn">${c.attention}</span>` : '<span class="muted">0</span>'}</td><td>${sparkline(c.spark, c.color)}</td></tr>`).join('')}
    </tbody></table></div></section>

  <div class="os-grid os-grid--2">
    <section class="os-card"><header class="os-card__h"><h2>Gross vs net sales</h2>${d.series.length > 120 ? '<span class="muted">Weekly</span>' : ''}</header>${grossNetBars(bucket(d.series))}
      <dl class="os-bridge"><div><dt>Gross sales</dt><dd>${formatMoney(d.sales.gross)}</dd></div><div><dt>Discounts</dt><dd>−${formatMoney(d.sales.discounts)}</dd></div><div><dt>Refunds</dt><dd>−${formatMoney(d.sales.refunds)}</dd></div><div class="os-bridge__net"><dt>Net sales</dt><dd>${formatMoney(d.sales.net)}</dd></div><div><dt>Delivery charged</dt><dd>${formatMoney(d.sales.delivery)}</dd></div><div><dt>VAT (included)</dt><dd>${formatMoney(d.sales.vat)}</dd></div></dl></section>
    <section class="os-card"><header class="os-card__h"><h2>Funnel</h2><span class="muted">Visit → purchase${d.traffic.activeUsers ? ` · ${k.conversion.value ?? 0}% convert` : ''}</span></header>
      ${funnel([{ label: 'Active users', count: d.traffic.funnel.visits }, { label: 'Viewed a product', count: d.traffic.funnel.views }, { label: 'Added to bag', count: d.traffic.funnel.addToCart }, { label: 'Started checkout', count: d.traffic.funnel.checkout }, { label: 'Reached payment', count: d.traffic.funnel.payment }, { label: 'Purchased', count: d.sales.orders }, { label: 'Delivered', count: d.sales.delivered }])}
      <p class="muted os-note">Cookie-less first-party counts. Average ${d.traffic.dauAvg.toLocaleString('en-NG')} active users a day.</p></section>
  </div>

  <div class="os-grid os-grid--3">
    <section class="os-card"><header class="os-card__h"><h2>Top sellers</h2></header>${d.topSellers.length ? `<ol class="os-rank">${d.topSellers.map((p) => `<li><span>${e(p.name)}</span><span class="muted">${p.units} sold</span><strong>${compactMoney(p.revenue)}</strong></li>`).join('')}</ol>` : '<p class="os-empty">No sales in this range yet.</p>'}</section>
    <section class="os-card"><header class="os-card__h"><h2>Most viewed</h2></header>${d.topViewed.length ? `<ol class="os-rank">${d.topViewed.map((p) => `<li><span>${e(p.name)}</span><span class="muted">${p.views.toLocaleString('en-NG')} views</span><strong>${p.conversion}%</strong></li>`).join('')}</ol>` : '<p class="os-empty">No product views recorded yet.</p>'}</section>
    <section class="os-card"><header class="os-card__h"><h2>Trending</h2><span class="muted">vs before</span></header>${d.trending.length ? `<ol class="os-rank">${d.trending.map((p) => `<li><span>${e(p.name)}</span><span class="muted">${p.before} → ${p.units}</span><strong class="d d--up">${p.growth == null ? 'New' : `▲ ${p.growth}%`}</strong></li>`).join('')}</ol>` : `<p class="os-empty">${compareOn ? 'Nothing is growing faster than before yet.' : 'Turn on a comparison to see what is trending.'}</p>`}</section>
  </div>

  <div class="os-grid os-grid--3">
    <section class="os-card"><header class="os-card__h"><h2>Where orders go</h2></header>${d.byLocation.length ? hbars(d.byLocation.slice(0, 8), { label: 'location', value: 'revenue', fmt: compactMoney }) : '<p class="os-empty">No paid orders in this range.</p>'}</section>
    <section class="os-card"><header class="os-card__h"><h2>Channels</h2></header>${d.byChannel.length ? hbars(d.byChannel, { label: 'channel', value: 'revenue', fmt: compactMoney }) : '<p class="os-empty">No paid orders in this range.</p>'}
      ${d.lowStock.length ? `<h3 class="os-h3">Low stock</h3><ul class="os-stock">${d.lowStock.map((p) => `<li><span>${e(p.name)}</span><strong class="${p.stock === 0 ? 'stock-out' : 'stock-low'}">${p.stock === 0 ? 'Out' : p.stock}</strong></li>`).join('')}</ul>` : ''}</section>
    <section class="os-card os-feed"><header class="os-card__h"><h2>Live activity</h2></header>${d.feed.length ? `<ul>${d.feed.map((x) => `<li><a href="${e(x.href)}"><span class="os-feed__k os-feed__k--${e(x.kind)}"></span><span><strong>${e(x.title)}</strong><small>${e(x.detail)} · ${e(coOf(cos, x.company)?.name || 'CNM Group')}</small></span><time datetime="${e(x.at)}">${e(timeAgo(x.at))}</time></a></li>`).join('')}</ul>` : '<p class="os-empty">Nothing yet. Orders, payments and enquiries appear here as they happen.</p>'}</section>
  </div>`;

  bindTrend(v, bucket(d.series), bucket(d.compareSeries), { key: 'revenue' });
  bindFilters(v, f, 'command');
  v.querySelectorAll('[data-co]').forEach((tr) => {
    const go = () => writeFilters('command', { ...f, company: tr.dataset.co });
    tr.addEventListener('click', go);
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
  });
  v.querySelector('[data-export]')?.addEventListener('click', () => exportCsv(d, cos));

  // Live updates: poll a tiny change stamp; refetch only when something actually changed. Paused in background tabs.
  stopLive();
  let stamp = null;
  const tick = async () => {
    if (document.hidden || !v.isConnected) return;
    try {
      const p = await api('/api/admin/pulse', { loader: false });
      if (stamp && p.stamp !== stamp) { stopLive(); const y = scrollY; await command(v, ctx); scrollTo(0, y); v.querySelector('[data-live]')?.classList.add('is-new'); return; }
      stamp = p.stamp;
      const t = v.querySelector('[data-live-text]');
      if (t) t.textContent = `Live · checked ${timeAgo(p.at)}`;
    } catch { v.querySelector('[data-live]')?.classList.add('is-off'); }
  };
  tick();
  liveTimer = setInterval(tick, 20000);
}

function filterBar(f, cos, options, me) {
  const sel = (name, label, opts, cur) => `<label class="os-f"><span>${label}</span><select name="${name}">${opts.map(([val, txt]) => `<option value="${e(val)}"${val === cur ? ' selected' : ''}>${e(txt)}</option>`).join('')}</select></label>`;
  const scoped = Array.isArray(me?.scope);
  return `<form class="os-filters" data-filters aria-label="Filters">
    ${sel('company', 'Company', [...(scoped && me.scope.length === 1 ? [] : [['all', scoped ? 'All my companies' : 'All companies']]), ...cos.map((c) => [c.id, `${c.name}${c.status === 'archived' ? ' (archived)' : ''}`])], f.company)}
    <div class="os-f os-f--range"><span>Period</span><div class="os-seg" role="group" aria-label="Period">${PRESETS.map(([key, label]) => `<button type="button" data-preset="${key}" aria-pressed="${f.preset === key}">${label}</button>`).join('')}<button type="button" data-preset="custom" aria-pressed="${f.preset === 'custom'}">Custom</button></div></div>
    <div class="os-f os-f--dates"${f.preset === 'custom' ? '' : ' hidden'}><span>From – to</span><div class="os-dates"><input type="date" name="from" value="${f.from}" max="${today()}"><input type="date" name="to" value="${f.to}" max="${today()}"></div></div>
    ${sel('compare', 'Compare with', [['previous', 'Previous period'], ['year', 'Same period last year'], ['none', 'No comparison']], f.compare)}
    ${sel('location', 'Location', [['all', 'All locations'], ...options.locations.map((l) => [l, l])], f.location)}
    ${sel('channel', 'Channel', [['all', 'All channels'], ['web', 'Website'], ['app', 'Mobile app'], ['manual', 'Manual / phone'], ['pos', 'In store (POS)']], f.channel)}
    <button type="button" class="os-btn os-btn--ghost" data-export>Export CSV</button>
  </form>`;
}

function bindFilters(v, f, view) {
  const form = v.querySelector('[data-filters]');
  if (!form) return;
  const apply = (patch) => writeFilters(view, { ...f, ...patch });
  form.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'from' || t.name === 'to') {
      const from = form.from.value; const to = form.to.value;
      if (from && to && from <= to) apply({ preset: 'custom', from, to });
      return;
    }
    if (t.name) apply({ [t.name]: t.value });
  });
  form.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.preset === 'custom') { form.querySelector('.os-f--dates').hidden = false; form.querySelectorAll('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); form.from.focus(); return; }
    apply({ preset: b.dataset.preset });
  }));
}

function exportCsv(d, cos) {
  const rows = [['CNM Group Command Center', rangeText(d.range), d.compare ? `vs ${rangeText(d.compare)}` : '']];
  rows.push([], ['Metric', 'Value', 'Previous', 'Change %']);
  for (const k of d.kpis) rows.push([KPI[k.key][0], k.value ?? '', k.previous ?? '', k.delta ?? '']);
  rows.push([], ['Company', 'Revenue', 'Orders', 'Share %', 'Change %', 'Active users', 'Leads']);
  for (const c of d.byCompany) rows.push([c.name, c.revenue, c.orders, c.share, c.delta ?? '', c.activeUsers, c.leads]);
  rows.push([], ['Date', 'Gross', 'Net', 'Revenue', 'Orders', 'Active users']);
  for (const s of d.series) rows.push([s.date, s.gross, s.net, s.revenue, s.orders, s.active]);
  rows.push([], ['Needs attention', 'Detail', 'Company', 'Severity']);
  for (const a of d.attention) rows.push([a.title, a.detail, coOf(cos, a.company)?.name || a.company, a.severity]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `cnm-command-center-${d.range.from}-to-${d.range.to}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------------------------------------------ Companies */
const PAY = { card: 'Card', bank_transfer: 'Bank transfer', ussd: 'USSD', cash_on_delivery: 'Cash on delivery', pay_in_store: 'Pay in store', invoice: 'Invoice' };
const DEL = { 'lagos-standard': 'Lagos standard', 'lagos-express': 'Lagos express', 'abuja-standard': 'Abuja standard', nationwide: 'Nationwide', pickup: 'Store pickup', 'on-site-service': 'On-site service', none: 'No delivery' };
const KINDS = { retail: 'Retail', services: 'Services', engineering: 'Engineering', nonprofit: 'Non-profit', marketplace: 'Marketplace', digital: 'Digital' };
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];

export async function companiesView(v, ctx, flash) {
  const { companies: list, canManage } = await api('/api/admin/companies', { loader: false });
  companiesCache = list;
  const show = new URLSearchParams(location.hash.split('?')[1] || '').get('show') || 'active';
  const shown = list.filter((c) => (show === 'all' ? true : show === 'archived' ? c.status === 'archived' : c.status !== 'archived'));
  v.innerHTML = `<header class="os-head"><div><p class="os-eyebrow">CNM Group</p><h1 class="os-title">Companies</h1><p class="os-sub">Each company keeps its own orders, products, stock, leads and settings. The Command Center rolls them up.</p></div>
    ${canManage ? '<button class="os-btn" type="button" data-new>New company</button>' : ''}</header>
  <div class="os-seg os-seg--tabs" role="group" aria-label="Show">${[['active', 'Active'], ['archived', 'Archived'], ['all', 'All']].map(([k, l]) => `<a href="#companies?show=${k}" aria-pressed="${show === k}">${l} <small>${list.filter((c) => (k === 'all' ? true : k === 'archived' ? c.status === 'archived' : c.status !== 'archived')).length}</small></a>`).join('')}</div>
  <div class="os-cogrid">${shown.map((c) => `<article class="os-co${c.status === 'archived' ? ' is-archived' : ''}" style="--co:${e(c.color)}">
    <header><span class="os-co__logo">${c.logo ? `<img src="${e(c.logo)}" alt="">` : `<b>${e(c.name.slice(0, 1))}</b>`}</span><div><h2>${e(c.name)}</h2><p>${e(KINDS[c.kind] || c.kind)} · ${e(c.currency)} · ${pill(c.status)}</p></div></header>
    <dl>
      <div><dt>Domains</dt><dd>${c.domains.length ? c.domains.map((d) => `<code>${e(d)}</code>`).join(' ') : '<span class="muted">None</span>'}</dd></div>
      <div><dt>Payments</dt><dd>${c.paymentMethods.map((p) => e(PAY[p] || p)).join(', ') || '<span class="muted">None</span>'}</dd></div>
      <div><dt>Delivery</dt><dd>${c.deliveryOptions.map((p) => e(DEL[p] || p)).join(', ') || '<span class="muted">None</span>'}</dd></div>
      <div><dt>Company admins</dt><dd>${c.admins.length ? c.admins.map((a) => e(a)).join(', ') : '<span class="muted">Group admins only</span>'}</dd></div>
    </dl>
    <footer><a class="os-btn os-btn--ghost" href="#command?company=${e(c.id)}">Open dashboard</a>${canManage ? `<button class="os-btn os-btn--ghost" type="button" data-edit="${e(c.id)}">Edit</button><button class="os-btn os-btn--quiet" type="button" data-archive="${e(c.id)}" data-to="${c.status === 'archived' ? 'active' : 'archived'}">${c.status === 'archived' ? 'Restore' : 'Archive'}</button>` : ''}</footer>
  </article>`).join('') || '<p class="os-empty">No companies here.</p>'}</div>
  <dialog class="os-dialog" data-co-dialog></dialog>`;

  const dlg = v.querySelector('[data-co-dialog]');
  const open = (c) => {
    const key = crypto.randomUUID(); // one key per form opening: double-submits and retries can't create twice
    const box = (name, map, sel) => `<fieldset class="os-checks"><legend>${name === 'paymentMethods' ? 'Payment methods' : 'Delivery options'}</legend>${Object.entries(map).map(([k, l]) => `<label><input type="checkbox" name="${name}" value="${k}"${sel?.includes(k) ? ' checked' : ''}> ${e(l)}</label>`).join('')}</fieldset>`;
    dlg.innerHTML = `<form method="dialog" class="os-form" data-co-form>
      <header><h2>${c ? `Edit ${e(c.name)}` : 'New company'}</h2><button type="button" class="os-x" data-close aria-label="Close">×</button></header>
      <div class="os-form__grid">
        <label>Company name<input name="name" required maxlength="80" value="${e(c?.name || '')}"></label>
        ${c ? `<label>Company ID<input value="${e(c.id)}" disabled></label>` : '<label>Company ID <small>(optional, from the name)</small><input name="id" pattern="[a-z0-9-]{2,40}" placeholder="e.g. cnm-energy"></label>'}
        <label>Business type<select name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}"${(c?.kind || 'retail') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Currency<select name="currency">${CURRENCIES.map((x) => `<option${(c?.currency || 'NGN') === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
        <label>Brand colour<span class="os-color"><input type="color" value="${e(c?.color || '#16161a')}" data-color-pick><input name="color" value="${e(c?.color || '#16161a')}" pattern="#[0-9a-fA-F]{6}" required></span></label>
        <label>Logo <small>(/assets/… path or https URL, upload in Media)</small><input name="logo" value="${e(c?.logo || '')}" placeholder="/assets/brand/…"></label>
      </div>
      ${box('paymentMethods', PAY, c?.paymentMethods)}
      ${box('deliveryOptions', DEL, c?.deliveryOptions)}
      <label>Domains <small>(one per line)</small><textarea name="domains" rows="2" placeholder="cnmenergy.com">${e((c?.domains || []).join('\n'))}</textarea></label>
      <label>Company admins <small>(emails, one per line: they see only this company)</small><textarea name="admins" rows="2" placeholder="manager@cnmgroup.com">${e((c?.admins || []).join('\n'))}</textarea></label>
      <p class="alert alert--err" data-err hidden></p>
      <footer><button type="button" class="os-btn os-btn--ghost" data-close>Cancel</button><button class="os-btn" type="submit">${c ? 'Save changes' : 'Create company'}</button></footer>
    </form>`;
    const form = dlg.querySelector('form');
    form.querySelector('[data-color-pick]').addEventListener('input', (ev) => { form.color.value = ev.target.value; });
    form.color.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(form.color.value)) form.querySelector('[data-color-pick]').value = form.color.value; });
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const body = { name: fd.get('name'), kind: fd.get('kind'), currency: fd.get('currency'), color: fd.get('color'), logo: fd.get('logo') || '', paymentMethods: fd.getAll('paymentMethods'), deliveryOptions: fd.getAll('deliveryOptions'), domains: lines(fd.get('domains')), admins: lines(fd.get('admins')) };
      if (!c && fd.get('id')) body.id = fd.get('id');
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        if (c) await api(`/api/admin/companies/${encodeURIComponent(c.id)}`, { method: 'PATCH', body });
        else await api('/api/admin/companies', { method: 'POST', body, headers: { 'Idempotency-Key': key } });
        dlg.close(); resetCompanies(); flash(c ? 'Company updated.' : 'Company created.'); companiesView(v, ctx, flash);
      } catch (x) { const er = form.querySelector('[data-err]'); er.textContent = x.message; er.hidden = false; btn.disabled = false; }
    });
    dlg.showModal();
    form.name.focus();
  };
  v.querySelector('[data-new]')?.addEventListener('click', () => open(null));
  v.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(list.find((c) => c.id === b.dataset.edit))));
  v.querySelectorAll('[data-archive]').forEach((b) => b.addEventListener('click', async () => {
    const c = list.find((x) => x.id === b.dataset.archive);
    const to = b.dataset.to;
    if (to === 'archived' && !confirm(`Archive ${c.name}? Its data is kept and still counts in past reports; it disappears from day-to-day lists.`)) return;
    try { await api(`/api/admin/companies/${encodeURIComponent(c.id)}`, { method: 'PATCH', body: { status: to } }); resetCompanies(); flash(to === 'archived' ? `${c.name} archived.` : `${c.name} restored.`); companiesView(v, ctx, flash); } catch (x) { flash(x.message, false); }
  }));
}

/* ------------------------------------------------------------------ Audit log */
const ACTION_LABEL = {
  'order.status': 'Order status changed', 'inventory.update': 'Inventory updated', 'discounts.update': 'Discounts updated', 'content.update': 'Content updated', 'media.upload': 'Media uploaded',
  publish: 'Site published', 'enquiry.status': 'Enquiry status changed', 'company.create': 'Company created', 'company.update': 'Company edited', 'company.archive': 'Company archived', 'company.restore': 'Company restored',
};
export async function auditView(v) {
  const { entries } = await api('/api/admin/audit', { loader: false });
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
  const match = (x) => !q || JSON.stringify(x).toLowerCase().includes(q.toLowerCase());
  const shown = entries.filter(match);
  const summary = (x) => {
    const d = x.detail || {};
    if (d.changed) return d.changed.map((k) => `${k}: ${JSON.stringify(d.before?.[k])} → ${JSON.stringify(d.after?.[k])}`).join('; ');
    return Object.entries(d).map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`).join(' · ');
  };
  v.innerHTML = `<header class="os-head"><div><p class="os-eyebrow">Security</p><h1 class="os-title">Audit log</h1><p class="os-sub">Every sensitive action: who did it, their role, what changed (before → after), when, and from where. Entries cannot be edited or deleted from the admin.</p></div>
    <button class="os-btn os-btn--ghost" type="button" data-export>Export CSV</button></header>
  <form class="os-filters" data-q><label class="os-f os-f--grow"><span>Search</span><input name="q" value="${e(q)}" placeholder="Person, action, order number, company…"></label></form>
  <section class="os-card"><div class="os-table-wrap"><table class="table os-audit"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th><th>From</th></tr></thead><tbody>
  ${shown.map((x) => `<tr><td><time datetime="${e(x.at)}">${e(x.at.replace('T', ' ').slice(0, 16))}</time></td><td>${e(x.admin)}<br><small class="muted">${e(x.role || '')}</small></td><td>${e(ACTION_LABEL[x.action] || x.action)}</td><td class="os-audit__d">${e(summary(x))}</td><td class="muted"><small>${e(x.ip || '—')}</small></td></tr>`).join('') || '<tr><td colspan="5" class="os-empty">No matching entries.</td></tr>'}
  </tbody></table></div></section>`;
  v.querySelector('[data-q]').addEventListener('submit', (ev) => { ev.preventDefault(); location.hash = `#audit${ev.currentTarget.q.value ? `?q=${encodeURIComponent(ev.currentTarget.q.value)}` : ''}`; });
  v.querySelector('[data-q] input').addEventListener('change', (ev) => { location.hash = `#audit${ev.target.value ? `?q=${encodeURIComponent(ev.target.value)}` : ''}`; });
  v.querySelector('[data-export]').addEventListener('click', () => {
    const csv = [['at', 'admin', 'role', 'action', 'details', 'ip'], ...shown.map((x) => [x.at, x.admin, x.role, x.action, summary(x), x.ip || ''])].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'cnm-audit-log.csv'; a.click();
  });
}

// CNM Group OS — Operations (phase 1): Orders, order page, Fulfilment board, New (manual) order, invoices & packing
// slips, and Couriers & refund settings. Data comes from /api/ops/*; every action is enforced and audited server-side.
import { escapeHtml as e, formatMoney } from '../../shared/format.mjs';
import { api } from '../api.js';

const qs = () => new URLSearchParams(location.hash.split('?')[1] || '');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const ago = (iso) => { const h = (Date.now() - Date.parse(iso)) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} days`; };
const label = (s) => String(s || '').replace(/_/g, ' ');
const pill = (s, extra = '') => `<span class="pill pill--${e(s)}${extra}">${e(label(s))}</span>`;
const money = (n) => formatMoney(n);
export const SHIP_LABEL = { awaiting_fulfilment: 'Awaiting fulfilment', packed: 'Packed', ready_for_pickup: 'Ready for collection', handed_over: 'Handed to courier', in_transit: 'In transit', out_for_delivery: 'Out for delivery', failed_attempt: 'Attempt failed', rescheduled: 'Rescheduled', delivered: 'Delivered', returned_to_sender: 'Returned to sender', lost: 'Lost' };
const SHIP_ACTION = { packed: 'Mark packed', ready_for_pickup: 'Ready for collection', handed_over: 'Hand to courier', in_transit: 'In transit', out_for_delivery: 'Out for delivery', delivered: 'Mark delivered', failed_attempt: 'Attempt failed', rescheduled: 'Reschedule', returned_to_sender: 'Returned to sender', lost: 'Mark lost' };
const STEPS = ['awaiting_fulfilment', 'packed', 'handed_over', 'in_transit', 'out_for_delivery', 'delivered'];
const REFUND_REASONS = ['customer_request', 'returned_items', 'damaged', 'not_delivered', 'wrong_item', 'duplicate_payment', 'pricing_error', 'goodwill', 'other'];
const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'faulty', 'late_delivery', 'other'];
const EXCEPTION_KINDS = ['address_issue', 'customer_unreachable', 'damaged', 'delayed', 'lost', 'other'];
const PAY_LABEL = { card: 'Card', bank_transfer: 'Bank transfer', ussd: 'USSD', cash: 'Cash', pos_card: 'POS card' };
const key = () => crypto.randomUUID();

/* ================================================================== Orders list */
const STATUS_TABS = [['all', 'All'], ['open', 'To do'], ['pending_payment', 'Awaiting payment'], ['paid', 'Paid'], ['processing', 'Processing'], ['dispatched', 'Dispatched'], ['delivered', 'Delivered'], ['returned', 'Returned'], ['refunded', 'Refunded'], ['cancelled', 'Cancelled'], ['payment_failed', 'Payment failed']];

export async function ordersView(v, ctx) {
  const p = qs();
  const f = { q: p.get('q') || '', status: p.get('status') || 'all', company: p.get('company') || 'all', channel: p.get('channel') || 'all', payment: p.get('payment') || 'all', location: p.get('location') || 'all', shipment: p.get('shipment') || 'all', from: p.get('from') || '', to: p.get('to') || '', exception: p.get('exception') === '1' };
  const query = new URLSearchParams(Object.entries({ ...f, exception: f.exception ? '1' : '' }).filter(([, x]) => x && x !== 'all'));
  const [d, cos] = await Promise.all([api(`/api/ops/orders?${query}&limit=50`, { loader: false }), api('/api/admin/companies', { loader: false })]);
  const canMoney = ['owner', 'manager'].includes(ctx.me.role);
  const counts = d.counts || {};
  const tabCount = (k) => (k === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : k === 'open' ? (counts.paid || 0) + (counts.processing || 0) + (counts.dispatched || 0) : counts[k] || 0);
  const sel = (name, lab, opts, cur) => `<label class="os-f"><span>${lab}</span><select name="${name}">${opts.map(([val, t]) => `<option value="${e(val)}"${val === cur ? ' selected' : ''}>${e(t)}</option>`).join('')}</select></label>`;
  v.innerHTML = `<header class="os-head"><div><p class="os-eyebrow">Operations</p><h1 class="os-title">Orders</h1><p class="os-sub">${d.total.toLocaleString('en-NG')} order${d.total === 1 ? '' : 's'}${d.exceptions ? ` · <a class="os-inline-warn" href="#orders?exception=1">${d.exceptions} delivery problem${d.exceptions === 1 ? '' : 's'}</a>` : ''}</p></div>
    <div class="os-head__actions"><a class="os-btn os-btn--ghost" href="/api/ops/orders/export?${query}" download>Export CSV</a>${canMoney ? '<a class="os-btn" href="#new-order">New order</a>' : ''}</div></header>
  <nav class="os-tabs" aria-label="Order status">${STATUS_TABS.map(([k, t]) => `<a href="#orders?${new URLSearchParams({ ...Object.fromEntries(query), status: k })}" aria-current="${f.status === k ? 'true' : 'false'}">${t} <small>${tabCount(k)}</small></a>`).join('')}</nav>
  <form class="os-filters" data-of aria-label="Filter orders">
    <label class="os-f os-f--grow"><span>Search</span><input name="q" value="${e(f.q)}" placeholder="Order number, name, email, phone, product, tracking…" autocomplete="off"></label>
    <details class="os-more-filters" data-more-filters><summary>More filters${[f.company, f.channel, f.shipment, f.location, f.payment].filter((x) => x !== 'all').length + (f.from ? 1 : 0) + (f.to ? 1 : 0) + (f.exception ? 1 : 0) ? ` <small>${[f.company, f.channel, f.shipment, f.location, f.payment].filter((x) => x !== 'all').length + (f.from ? 1 : 0) + (f.to ? 1 : 0) + (f.exception ? 1 : 0)}</small>` : ''}</summary><div class="os-more-filters__body">
    ${sel('company', 'Company', [['all', 'All companies'], ...cos.companies.map((c) => [c.id, c.name])], f.company)}
    ${sel('channel', 'Channel', [['all', 'All'], ['web', 'Website'], ['app', 'App'], ['manual', 'Manual'], ['pos', 'In store']], f.channel)}
    ${sel('shipment', 'Delivery stage', [['all', 'All'], ...Object.entries(SHIP_LABEL)], f.shipment)}
    ${sel('location', 'Location', [['all', 'All'], ...d.locations.map((l) => [l, l])], f.location)}
    ${sel('payment', 'Payment', [['all', 'All'], ...Object.entries(PAY_LABEL)], f.payment)}
    <label class="os-f"><span>From</span><input type="date" name="from" value="${e(f.from)}"></label><label class="os-f"><span>To</span><input type="date" name="to" value="${e(f.to)}"></label>
    <label class="os-check"><input type="checkbox" name="exception"${f.exception ? ' checked' : ''}> Delivery problems only</label>
    </div></details>
  </form>
  <div class="os-bulk" data-bulk hidden><span data-bulk-n></span><button class="os-btn os-btn--ghost" type="button" data-bulk-pack>Mark packed</button><button class="os-btn os-btn--ghost" type="button" data-bulk-slips>Print packing slips</button><button class="os-btn os-btn--quiet" type="button" data-bulk-clear>Clear</button></div>
  <section class="os-card os-card--flush"><div class="os-table-wrap"><table class="os-orders"><thead><tr><th class="cb"><input type="checkbox" data-all aria-label="Select all"></th><th>Order</th><th>Customer</th><th class="num">Total</th><th>Status</th><th>Delivery</th><th>Location</th><th>Placed</th></tr></thead><tbody data-rows>${rowsHTML(d.orders)}</tbody></table></div>
  ${d.orders.length ? '' : '<p class="os-empty" style="padding:24px">No orders match these filters.</p>'}
  ${d.next ? `<div class="os-more-row"><button class="os-btn os-btn--ghost" type="button" data-more="${e(d.next)}">Load more</button></div>` : ''}</section>`;

  const form = v.querySelector('[data-of]');
  if (matchMedia('(min-width: 641px)').matches) v.querySelector('[data-more-filters]').open = true; // phones: collapsed so orders come first
  const apply = () => {
    const fd = new FormData(form);
    const nq = new URLSearchParams();
    for (const [k, val] of fd) if (val && val !== 'all') nq.set(k, k === 'exception' ? '1' : val);
    if (f.status !== 'all') nq.set('status', f.status);
    location.hash = `#orders${nq.toString() ? `?${nq}` : ''}`;
  };
  let t;
  form.addEventListener('change', (ev) => { if (ev.target.name !== 'q') apply(); });
  form.q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 450); });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); apply(); });
  if (f.q) { form.q.focus(); form.q.setSelectionRange(f.q.length, f.q.length); }

  const tbody = v.querySelector('[data-rows]');
  v.querySelector('[data-more]')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    const more = await api(`/api/ops/orders?${query}&limit=50&cursor=${encodeURIComponent(b.dataset.more)}`, { loader: false });
    tbody.insertAdjacentHTML('beforeend', rowsHTML(more.orders));
    if (more.next) { b.dataset.more = more.next; b.disabled = false; } else b.remove();
  });
  // Rows open the order; checkboxes drive bulk actions.
  tbody.addEventListener('click', (ev) => { if (ev.target.closest('input, a')) return; const tr = ev.target.closest('tr[data-n]'); if (tr) location.hash = `#orders/${encodeURIComponent(tr.dataset.n)}`; });
  tbody.addEventListener('keydown', (ev) => { const tr = ev.target.closest('tr[data-n]'); if (tr && ev.key === 'Enter') location.hash = `#orders/${encodeURIComponent(tr.dataset.n)}`; });
  const bulk = v.querySelector('[data-bulk]');
  const picked = () => [...tbody.querySelectorAll('input[data-pick]:checked')].map((x) => x.value);
  const sync = () => { const n = picked().length; bulk.hidden = !n; v.querySelector('[data-bulk-n]').textContent = `${n} selected`; };
  v.addEventListener('change', (ev) => { if (ev.target.matches('[data-all]')) tbody.querySelectorAll('input[data-pick]').forEach((x) => { x.checked = ev.target.checked; }); if (ev.target.matches('[data-all], [data-pick]')) sync(); });
  v.querySelector('[data-bulk-clear]').addEventListener('click', () => { tbody.querySelectorAll('input[data-pick]').forEach((x) => { x.checked = false; }); v.querySelector('[data-all]').checked = false; sync(); });
  v.querySelector('[data-bulk-slips]').addEventListener('click', () => { location.hash = `#slips/${picked().map(encodeURIComponent).join(',')}`; });
  v.querySelector('[data-bulk-pack]').addEventListener('click', async () => {
    const r = await api('/api/ops/orders/bulk', { method: 'POST', body: { action: 'pack', numbers: picked() } });
    const ok = r.results.filter((x) => x.ok).length;
    ctx.flash(`${ok} marked packed${r.results.length - ok ? `; ${r.results.length - ok} skipped (${r.results.filter((x) => !x.ok).map((x) => x.error)[0]})` : ''}.`, ok > 0);
    ordersView(v, ctx);
  });
}

function rowsHTML(rows) {
  return rows.map((o) => `<tr data-n="${e(o.number)}" tabindex="0">
    <td class="cb"><input type="checkbox" data-pick value="${e(o.number)}" aria-label="Select ${e(o.number)}"></td>
    <td><a class="os-mono" href="#orders/${encodeURIComponent(o.number)}">${e(o.number)}</a><small>${e(o.channel === 'web' ? 'Website' : o.channel === 'app' ? 'App' : o.channel === 'pos' ? 'In store' : 'Manual')} · ${o.items} item${o.items === 1 ? '' : 's'}</small></td>
    <td><strong>${e(o.customer)}</strong><small>${e(o.email)}</small></td>
    <td class="num">${money(o.total)}${o.refunded ? `<small class="os-neg">−${money(o.refunded)}</small>` : ''}</td>
    <td>${pill(o.status)}${o.pendingRefund ? ' <span class="os-flag os-flag--warn">refund to approve</span>' : ''}${o.returns ? ' <span class="os-flag">return</span>' : ''}</td>
    <td>${o.shipment ? `<span class="os-ship os-ship--${e(o.shipment)}">${e(SHIP_LABEL[o.shipment] || label(o.shipment))}</span>` : '<span class="muted">—</span>'}${o.exception ? ' <span class="os-flag os-flag--bad">problem</span>' : ''}${o.courier ? `<small>${e(o.courier)}${o.tracking ? ` · ${e(o.tracking)}` : ''}</small>` : ''}</td>
    <td>${e(o.location)}</td>
    <td><span title="${e(when(o.createdAt))}">${e(day(o.createdAt))}</span><small>${e(ago(o.createdAt))} ago</small></td></tr>`).join('');
}

/* ================================================================== Order page */
export async function orderPage(v, number, ctx) {
  const d = await api(`/api/ops/orders/${encodeURIComponent(number)}`, { loader: false });
  renderOrder(v, d, ctx);
}

function renderOrder(v, d, ctx) {
  const o = d.order;
  const s = o.shipment || { status: ['paid', 'processing'].includes(o.status) ? 'awaiting_fulfilment' : null, events: [] };
  const A = d.allowed;
  const addr = o.delivery.address;
  const openEx = s.exception && !s.exception.resolvedAt ? s.exception : null;
  const stepIdx = STEPS.indexOf(s.status === 'ready_for_pickup' ? 'handed_over' : ['failed_attempt', 'rescheduled'].includes(s.status) ? 'out_for_delivery' : s.status);
  const courierName = d.couriers.find((c) => c.id === s.courier)?.name;

  v.innerHTML = `<a class="os-back" href="#orders">← Orders</a>
  <header class="os-head"><div><p class="os-eyebrow">${e(o.companyId === 'essentials' || !o.companyId ? 'CNM Essentials' : o.companyId)} · ${e(o.channel === 'pos' ? 'In store' : o.channel === 'manual' ? 'Manual order' : o.channel === 'app' ? 'App' : 'Website')}${o.placedBy ? ` · by ${e(o.placedBy)}` : ''}</p>
    <h1 class="os-title os-mono-title">${e(o.number)} ${pill(o.status)}</h1><p class="os-sub">Placed ${e(when(o.createdAt))}</p></div>
    <div class="os-head__actions">
      <a class="os-btn os-btn--ghost" href="#invoice/${encodeURIComponent(o.number)}">Invoice</a><a class="os-btn os-btn--ghost" href="#slips/${encodeURIComponent(o.number)}">Packing slip</a>
      <details class="os-menu"><summary class="os-btn os-btn--ghost">More</summary><div class="os-menu__panel">
        <button type="button" data-resend="confirmation">Resend order confirmation</button><button type="button" data-resend="status">Resend status update</button>
        ${A.markPaid ? '<button type="button" data-open="mark-paid">Record a payment</button>' : ''}${A.cancel ? '<button type="button" data-open="cancel" class="os-danger">Cancel order</button>' : ''}
      </div></details></div></header>
  ${openEx ? `<div class="os-alert os-alert--bad"><strong>Delivery problem: ${e(label(openEx.kind))}</strong><span>${e(openEx.note || '')} · opened ${e(ago(openEx.openedAt))} ago by ${e(openEx.openedBy || '')}</span><form data-resolve class="os-inline-form"><input name="resolution" required minlength="3" placeholder="How was it resolved?"><button class="os-btn">Resolve</button></form></div>` : ''}
  ${d.refunds.some((r) => r.status === 'requested') ? `<div class="os-alert os-alert--warn"><strong>Refund awaiting approval</strong><span>A second manager must approve refunds above ${money(d.refundApprovalThreshold)}.</span></div>` : ''}
  <div class="os-order">
    <div class="os-order__main">
      <section class="os-card"><header class="os-card__h"><h2>Items</h2><span class="muted">${o.lines.reduce((n, l) => n + l.qty, 0)} items</span></header>
        <table class="os-lines"><tbody>${o.lines.map((l) => `<tr><td><strong>${e(l.name)}</strong><small class="os-mono">${e(l.id)}</small></td><td class="num">${l.qty} × ${money(l.unitPrice)}</td><td class="num">${money(l.lineTotal)}</td></tr>`).join('')}</tbody></table>
        <dl class="os-sum"><div><dt>Subtotal</dt><dd>${money(o.totals.subtotal)}</dd></div>${o.totals.discount ? `<div><dt>Discount${o.promoCode ? ` (${e(o.promoCode)})` : ''}</dt><dd>−${money(o.totals.discount)}</dd></div>` : ''}<div><dt>Delivery</dt><dd>${o.totals.delivery ? money(o.totals.delivery) : 'Free'}</dd></div><div class="muted"><dt>VAT (included)</dt><dd>${money(o.totals.vat)}</dd></div><div class="os-sum__total"><dt>Total</dt><dd>${money(o.totals.total)}</dd></div>${d.refunded ? `<div class="os-neg"><dt>Refunded</dt><dd>−${money(d.refunded)}</dd></div><div><dt>Net received</dt><dd>${money(o.totals.total - d.refunded)}</dd></div>` : ''}</dl>
      </section>

      ${s.status ? `<section class="os-card" data-ship><header class="os-card__h"><h2>Fulfilment &amp; delivery</h2>${s.status ? `<span class="os-ship os-ship--${e(s.status)}">${e(SHIP_LABEL[s.status])}</span>` : ''}</header>
        <ol class="os-steps">${STEPS.map((st, i) => `<li class="${i < stepIdx ? 'is-done' : i === stepIdx ? 'is-now' : ''}">${e(SHIP_LABEL[st])}</li>`).join('')}</ol>
        ${['failed_attempt', 'rescheduled'].includes(s.status) ? `<p class="os-note-line">Attempts: ${s.attempts}${s.eta ? ` · new date ${e(day(s.eta))}` : ''}</p>` : ''}
        ${A.canFulfil ? `<form class="os-form os-ship-form" data-ship-details>
          <label>Courier<select name="courier"><option value="">Choose…</option>${d.couriers.map((c) => `<option value="${e(c.id)}"${c.id === s.courier ? ' selected' : ''}>${e(c.name)}</option>`).join('')}</select></label>
          <label data-k="courier">Waybill / tracking number<input name="trackingNumber" value="${e(s.trackingNumber || '')}" maxlength="60"></label>
          <label data-k="rider">Rider name<input name="riderName" value="${e(s.rider?.name || '')}" maxlength="80"></label>
          <label data-k="rider">Rider phone<input name="riderPhone" type="tel" value="${e(s.rider?.phone || '')}" maxlength="30"></label>
          <label data-k="courier rider">Estimated delivery<input type="date" name="eta" value="${e(s.eta || '')}"></label>
          <label data-k="courier rider">Promised by<input type="date" name="promisedBy" value="${e(s.promisedBy || '')}"></label>
          <label data-k="courier rider">We paid (₦)<input name="costAmount" type="number" min="0" step="50" value="${s.cost ? e(s.cost.amount) : ''}" placeholder="What CNM paid"></label>
          <label data-k="courier rider">Paid by<select name="costMethod">${[['cash', 'Cash'], ['bank_transfer', 'Bank transfer'], ['pos_card', 'POS card'], ['account', 'Courier account']].map(([k, t]) => `<option value="${k}"${(s.cost?.method || 'cash') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          <button class="os-btn os-btn--ghost" type="submit">Save delivery details</button></form>` : `<p class="os-note-line">${courierName ? `${e(courierName)}${s.trackingNumber ? ` · ${e(s.trackingNumber)}` : ''}` : ''}${o.trackingLink ? ` · <a class="textlink" href="${e(o.trackingLink)}" target="_blank" rel="noopener">Track ↗</a>` : ''}</p>`}
        ${s.rider?.name || s.rider?.phone ? `<p class="os-note-line">Rider: <strong>${e(s.rider.name || '')}</strong>${s.rider.phone ? ` · <a class="textlink" href="tel:${e(s.rider.phone)}">${e(s.rider.phone)}</a>` : ''}</p>` : ''}
        ${s.cost ? `<p class="os-note-line">Delivery: customer paid ${o.totals.delivery ? money(o.totals.delivery) : 'nothing (free)'} · CNM paid ${money(s.cost.amount)} (${e(label(s.cost.method))}) · <strong class="${(o.totals.delivery || 0) - s.cost.amount < 0 ? 'os-neg' : ''}">${(o.totals.delivery || 0) - s.cost.amount < 0 ? 'cost ' : 'margin '}${money(Math.abs((o.totals.delivery || 0) - s.cost.amount))}</strong></p>` : ''}
        ${o.trackingLink && A.canFulfil ? `<p class="os-note-line"><a class="textlink" href="${e(o.trackingLink)}" target="_blank" rel="noopener">Open ${e(courierName)} tracking ↗</a></p>` : ''}
        ${A.canFulfil && A.shipment.length ? `<div class="os-ship-actions">${A.shipment.map((st) => `<button type="button" class="os-btn${['failed_attempt', 'returned_to_sender', 'lost'].includes(st) ? ' os-btn--ghost' : ''}" data-ship-to="${st}">${e(SHIP_ACTION[st] || label(st))}</button>`).join('')}${!openEx && s.status !== 'awaiting_fulfilment' ? '<button type="button" class="os-btn os-btn--quiet" data-open="exception">Report a problem</button>' : ''}</div>` : ''}
        ${s.pod ? `<div class="os-pod"><strong>Proof of delivery</strong><span>${e(when(s.pod.at))}${s.pod.recipient ? ` · received by ${e(s.pod.recipient)}` : ''}${s.pod.note ? ` · ${e(s.pod.note)}` : ''}</span>${s.pod.photoUrl ? `<a class="textlink" href="${e(s.pod.photoUrl)}" target="_blank" rel="noopener">Photo ↗</a>` : ''}</div>` : ''}
      </section>` : ''}

      ${d.refunds.length || A.refund ? `<section class="os-card"><header class="os-card__h"><h2>Refunds</h2><span class="muted">${money(d.refundable)} can still be refunded</span></header>
        ${d.refunds.length ? `<ul class="os-list">${d.refunds.map((r) => `<li><div><strong>${money(r.amount)}</strong> ${pill(r.status === 'succeeded' ? 'refunded' : r.status)} <small>${e(label(r.reason))}${r.note ? ` · ${e(r.note)}` : ''}${r.rma ? ` · ${e(r.rma)}` : ''}</small><small>Requested by ${e(r.requestedBy || '')} ${r.requestedAt ? e(ago(r.requestedAt)) + ' ago' : ''}${r.approvedBy ? ` · approved by ${e(r.approvedBy)}` : ''}${r.error ? ` · ${e(r.error)}` : ''}${r.providerRef ? ` · ref ${e(r.providerRef)}` : ''}</small></div>
          ${r.status === 'requested' && A.approve ? `<div class="os-row-actions"><button class="os-btn" type="button" data-approve="${e(r.id)}">Approve</button><button class="os-btn os-btn--quiet" type="button" data-reject="${e(r.id)}">Reject</button></div>` : ''}</li>`).join('')}</ul>` : ''}
        ${A.refund ? `<form class="os-form os-inline-grid" data-refund><label>Amount (₦)<input name="amount" type="number" min="1" step="0.01" max="${d.refundable}" required></label><label>Reason<select name="reason">${REFUND_REASONS.map((x) => `<option value="${x}">${e(label(x))}</option>`).join('')}</select></label><label class="os-span2">Note<input name="note" maxlength="300" placeholder="Optional"></label><button class="os-btn" type="submit">Refund</button><p class="muted os-span2" style="margin:0;font-size:.75rem">${o.payment?.provider === 'manual' ? 'This order was paid outside Paystack: record the refund here after paying the customer back.' : `Goes back to the customer through ${e(o.payment?.provider || 'the payment provider')}.`} Above ${money(d.refundApprovalThreshold)} a second manager must approve.</p></form>` : ''}
      </section>` : ''}

      ${A.returns || (o.returns || []).length ? `<section class="os-card"><header class="os-card__h"><h2>Returns</h2></header>
        ${(o.returns || []).length ? `<ul class="os-list">${o.returns.map((rt) => `<li><div><strong class="os-mono">${e(rt.rma)}</strong> ${pill(rt.status)} <small>${e(label(rt.kind))} · ${e(label(rt.reason))} · ${money(rt.value)}${rt.restocked ? ' · restocked' : ''}${rt.outsidePolicy ? ' · <strong class="os-neg">accepted outside policy</strong>' : ''}</small><small>${rt.lines.map((l) => `${l.qty} × ${e(l.name)}`).join(', ')}${rt.note ? ` · ${e(rt.note)}` : ''}</small></div>
          <div class="os-row-actions">${(A.returnNext[rt.rma] || []).filter((x) => x !== 'refunded').map((x) => `<button class="os-btn os-btn--ghost" type="button" data-rt="${e(rt.rma)}" data-rt-to="${x}">${x === 'inspected' ? 'Inspected' : x === 'credited' ? 'Store credit given' : x[0].toUpperCase() + x.slice(1)}</button>`).join('')}${rt.status === 'inspected' && rt.kind === 'refund' && A.refund ? `<button class="os-btn" type="button" data-rt-refund="${e(rt.rma)}" data-value="${Math.min(rt.value, d.refundable)}">Refund ${money(Math.min(rt.value, d.refundable))}</button>` : ''}</div></li>`).join('')}</ul>` : ''}
        ${A.returns ? `<details class="os-disclose"><summary>Start a return</summary><form class="os-form" data-return>
          ${d.returnWindow?.days != null ? `<p class="os-policy ${d.returnWindow.changeOfMindOpen ? 'is-ok' : 'is-late'}">Delivered ${d.returnWindow.days === 0 ? 'today' : `${d.returnWindow.days} day${d.returnWindow.days === 1 ? '' : 's'} ago`}. Change of mind (unopened items): ${d.returnWindow.changeOfMindOpen ? `within the ${d.returnWindow.changeOfMindDays}-day window` : `outside the ${d.returnWindow.changeOfMindDays}-day window`}. Damaged, faulty or wrong items: ${d.returnWindow.problemOpen ? `within the ${d.returnWindow.reportProblemHours}-hour reporting window` : `reported after ${d.returnWindow.reportProblemHours} hours`}.</p>` : ''}
          <fieldset class="os-checks"><legend>Items</legend>${o.lines.map((l) => `<label>${e(l.name)} <input type="number" name="qty:${e(l.id)}" min="0" max="${l.qty}" value="0" style="width:64px"> of ${l.qty}</label>`).join('')}</fieldset>
          <div class="os-inline-grid"><label>Reason<select name="reason">${RETURN_REASONS.map((x) => `<option value="${x}">${e(label(x))}</option>`).join('')}</select></label><label>Customer wants<select name="kind"><option value="refund">A refund</option><option value="exchange">An exchange</option><option value="store_credit">Store credit</option></select></label><label class="os-span2">Note<input name="note" maxlength="500"></label></div>
          <label class="os-check"><input type="checkbox" name="override" value="1"> Accept outside the policy (give the reason in the note)</label>
          <button class="os-btn" type="submit">Open return</button></form></details>` : ''}
      </section>` : ''}

      <section class="os-card"><header class="os-card__h"><h2>Timeline</h2></header><ol class="os-timeline">${d.timeline.map((x) => `<li class="os-tl os-tl--${e(x.type)}"><span class="os-tl__dot"></span><div><strong>${e(x.type === 'shipment' ? (SHIP_LABEL[x.status] || label(x.status)) : label(x.status))}</strong>${x.note ? `<span>${e(x.note)}</span>` : ''}<small>${e(when(x.at))}${x.by ? ` · ${e(x.by)}` : ''}</small></div></li>`).join('')}</ol></section>
    </div>

    <aside class="os-order__side">
      <section class="os-card"><header class="os-card__h"><h2>Customer</h2></header>
        <p class="os-cust"><strong>${e(o.contact.firstName)} ${e(o.contact.lastName)}</strong><a class="textlink" href="mailto:${e(o.contact.email)}">${e(o.contact.email)}</a><a class="textlink" href="tel:${e(o.contact.phone)}">${e(o.contact.phone)}</a></p>
        <dl class="os-mini"><div><dt>Lifetime value</dt><dd>${money(d.customer.lifetimeValue)}</dd></div><div><dt>Orders</dt><dd>${d.customer.orders}</dd></div><div><dt>Average order</dt><dd>${money(d.customer.aov)}</dd></div><div><dt>Customer since</dt><dd>${e(day(d.customer.firstOrderAt))}</dd></div></dl>
        ${d.customer.recent.length > 1 ? `<ul class="os-recent">${d.customer.recent.filter((x) => x.number !== o.number).slice(0, 4).map((x) => `<li><a href="#orders/${encodeURIComponent(x.number)}" class="os-mono">${e(x.number)}</a>${pill(x.status)}<span>${money(x.total)}</span></li>`).join('')}</ul>` : ''}
        <a class="textlink" href="#orders?q=${encodeURIComponent(o.contact.email)}">All orders from this customer</a>
      </section>
      <section class="os-card"><header class="os-card__h"><h2>${addr ? 'Deliver to' : 'Collect from'}</h2>${A.editAddress ? '<button class="os-link-btn" type="button" data-open="address">Edit</button>' : ''}</header>
        <p class="os-addr">${e(o.delivery.label)}<br>${addr ? `${e(addr.line1)}${addr.line2 ? `, ${e(addr.line2)}` : ''}<br>${e(addr.city)}, ${e(addr.state)}` : d.pickupStore ? `${e(d.pickupStore.name)}<br>${e(d.pickupStore.address)}` : e(o.delivery.storeSlug || '')}</p>${o.notes ? `<p class="os-quote">“${e(o.notes)}”</p>` : ''}</section>
      <section class="os-card"><header class="os-card__h"><h2>Payment</h2></header>
        <dl class="os-mini"><div><dt>Method</dt><dd>${e(PAY_LABEL[o.payment?.method] || label(o.payment?.method))}</dd></div><div><dt>Provider</dt><dd>${e({ simulated: 'Simulated (staging)', paystack: 'Paystack', manual: 'Recorded by staff' }[o.payment?.provider] || o.payment?.provider || '')}</dd></div><div><dt>Status</dt><dd>${e(label(o.payment?.status))}</dd></div>${o.payment?.paidAt ? `<div><dt>Paid</dt><dd>${e(when(o.payment.paidAt))}</dd></div>` : ''}</dl>
        <p class="os-mono os-small">${e(o.payment?.reference || '')}</p>${o.payment?.note ? `<p class="os-small muted">${e(o.payment.note)}</p>` : ''}</section>
      <section class="os-card"><header class="os-card__h"><h2>Staff notes</h2></header>
        ${(o.staffNotes || []).length ? `<ul class="os-notes">${o.staffNotes.slice().reverse().map((n) => `<li><p>${e(n.text)}</p><small>${e(n.by)} · ${e(when(n.at))}</small></li>`).join('')}</ul>` : '<p class="muted os-small">Only staff see these notes.</p>'}
        <form class="os-form" data-note><textarea name="text" rows="2" maxlength="1000" required placeholder="Add a note for the team"></textarea><button class="os-btn os-btn--ghost" type="submit">Add note</button></form></section>
    </aside>
  </div>
  <dialog class="os-dialog" data-dlg></dialog>`;

  bindOrder(v, d, ctx);
}

function bindOrder(v, d, ctx) {
  const o = d.order;
  const n = encodeURIComponent(o.number);
  const run = async (fnc, okMsg) => {
    try { const nd = await fnc(); if (okMsg) ctx.flash(okMsg); renderOrder(v, nd.order ? nd : await api(`/api/ops/orders/${n}`, { loader: false }), ctx); } catch (x) { ctx.flash(x.message, false); }
  };
  const dlg = v.querySelector('[data-dlg]');
  const dialog = (title, body, submit, onSubmit) => {
    dlg.innerHTML = `<form class="os-form" method="dialog"><header><h2>${title}</h2><button type="button" class="os-x" data-x aria-label="Close">×</button></header>${body}<p class="alert alert--err" data-err hidden></p><footer><button type="button" class="os-btn os-btn--ghost" data-x>Cancel</button><button class="os-btn" type="submit">${submit}</button></footer></form>`;
    dlg.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    const form = dlg.querySelector('form');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try { const nd = await onSubmit(Object.fromEntries(new FormData(form)), form); dlg.close(); renderOrder(v, nd, ctx); } catch (x) { const er = form.querySelector('[data-err]'); er.textContent = x.message; er.hidden = false; btn.disabled = false; }
    });
    dlg.showModal();
    form.querySelector('input, select, textarea')?.focus();
  };

  v.querySelectorAll('[data-resend]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api(`/api/ops/orders/${n}/resend`, { method: 'POST', body: { kind: b.dataset.resend } }); ctx.flash(r.note || 'Email sent to the customer.', !r.note); } catch (x) { ctx.flash(x.message, false); }
  }));
  v.querySelector('[data-note]')?.addEventListener('submit', (ev) => { ev.preventDefault(); const text = ev.currentTarget.text.value; run(() => api(`/api/ops/orders/${n}/notes`, { method: 'POST', body: { text } }), 'Note added.'); });
  const shipForm = v.querySelector('[data-ship-details]');
  if (shipForm) {
    // Show the fields that fit the chosen courier: waybill for couriers like GIG, rider name and phone for a booked rider.
    const kindOf = () => d.couriers.find((c) => c.id === shipForm.courier.value)?.kind || (shipForm.courier.value ? 'courier' : '');
    const syncKind = () => { const k = kindOf(); shipForm.querySelectorAll('[data-k]').forEach((el) => { el.hidden = !k || !el.dataset.k.split(' ').includes(k); }); };
    shipForm.courier.addEventListener('change', syncKind); syncKind();
    shipForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(shipForm));
      const body = { trackingNumber: f.trackingNumber, eta: f.eta, promisedBy: f.promisedBy };
      if (f.courier) body.courier = f.courier;
      if (kindOf() === 'rider') { body.rider = { name: f.riderName, phone: f.riderPhone }; body.trackingNumber = ''; }
      if (f.costAmount !== '' && f.costAmount != null) body.cost = { amount: Number(f.costAmount), method: f.costMethod };
      run(() => api(`/api/ops/orders/${n}/shipment`, { method: 'PATCH', body }), 'Delivery details saved.');
    });
  }
  v.querySelector('[data-resolve]')?.addEventListener('submit', (ev) => { ev.preventDefault(); const resolution = ev.currentTarget.resolution.value; run(() => api(`/api/ops/orders/${n}/exception`, { method: 'PATCH', body: { resolution } }), 'Problem resolved.'); });

  v.querySelectorAll('[data-ship-to]').forEach((b) => b.addEventListener('click', () => {
    const to = b.dataset.shipTo;
    const post = (extra = {}) => api(`/api/ops/orders/${n}/shipment`, { method: 'POST', body: { status: to, ...extra } });
    if (to === 'delivered') return dialog('Mark delivered', `<label>Received by<input name="recipient" maxlength="80" placeholder="Name of the person who received it"></label><label>Delivery note<input name="note" maxlength="300" placeholder="Optional"></label><label>Photo URL <small>(optional, from Media)</small><input name="photoUrl" placeholder="/api/media/…"></label>`, 'Mark delivered', (f) => post({ pod: { recipient: f.recipient, note: f.note, photoUrl: f.photoUrl }, note: f.note }));
    if (to === 'failed_attempt') return dialog('Delivery attempt failed', `<label>What happened?<input name="note" required maxlength="300" placeholder="e.g. Customer not reachable on phone"></label>`, 'Record failed attempt', (f) => post({ note: f.note }));
    if (to === 'rescheduled') return dialog('Reschedule delivery', `<label>New delivery date<input type="date" name="rescheduleTo" required min="${new Date().toISOString().slice(0, 10)}"></label><label>Note<input name="note" maxlength="300"></label>`, 'Reschedule', (f) => post({ rescheduleTo: f.rescheduleTo, note: f.note }));
    if (['returned_to_sender', 'lost'].includes(to)) return dialog(SHIP_ACTION[to], `<label>Note<input name="note" required maxlength="300"></label>`, SHIP_ACTION[to], (f) => post({ note: f.note }));
    return run(() => post(), `${SHIP_LABEL[to]}.`);
  }));

  const opens = {
    exception: () => dialog('Report a delivery problem', `<label>Problem<select name="kind">${EXCEPTION_KINDS.map((k) => `<option value="${k}">${e(label(k))}</option>`).join('')}</select></label><label>Details<input name="note" required maxlength="300"></label>`, 'Report problem', (f) => api(`/api/ops/orders/${n}/exception`, { method: 'POST', body: f })),
    address: () => { const a = o.delivery.address; return dialog('Edit delivery address', `<label>Address<input name="line1" required value="${e(a.line1)}"></label><label>Address line 2<input name="line2" value="${e(a.line2 || '')}"></label><div class="os-form__grid"><label>City<input name="city" required value="${e(a.city)}"></label><label>State<input name="state" required value="${e(a.state)}"></label></div>`, 'Save address', (f) => api(`/api/ops/orders/${n}/address`, { method: 'PATCH', body: { address: f } })); },
    'mark-paid': () => dialog('Record a payment', `<p class="muted">For payments received outside the website, such as a bank transfer, cash or POS. The customer gets their order confirmation.</p><label>Method<select name="method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="pos_card">POS card</option><option value="ussd">USSD</option></select></label><label>Reference<input name="reason" required minlength="3" maxlength="200" placeholder="Bank reference, receipt number…"></label><p class="os-small">Amount: <strong>${money(o.totals.total)}</strong></p>`, 'Record payment', (f) => api(`/api/ops/orders/${n}/mark-paid`, { method: 'POST', body: f })),
    cancel: () => dialog('Cancel order', `<p class="muted">${['paid', 'processing'].includes(o.status) ? `The customer is refunded ${money(d.refundable)} and the items go back into stock.` : 'This order has not been paid, so nothing is refunded.'}</p><label>Reason<input name="reason" required minlength="3" maxlength="200"></label>`, 'Cancel order', (f) => api(`/api/ops/orders/${n}/cancel`, { method: 'POST', body: f })),
  };
  v.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { b.closest('details')?.removeAttribute('open'); opens[b.dataset.open](); }));

  const refundForm = v.querySelector('[data-refund]');
  if (refundForm) {
    const idem = key();
    refundForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(refundForm));
      if (!confirm(`Refund ${money(Number(f.amount))} to ${o.contact.firstName} ${o.contact.lastName}?`)) return;
      run(async () => { const r = await api(`/api/ops/orders/${n}/refunds`, { method: 'POST', body: { amount: Number(f.amount), reason: f.reason, note: f.note }, headers: { 'Idempotency-Key': idem } }); ctx.flash(r.refund.status === 'requested' ? 'Refund requested: a second manager must approve it.' : `Refunded ${money(r.refund.amount)}.`); return r; });
    });
  }
  v.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => { if (confirm('Approve and send this refund?')) run(() => api(`/api/ops/orders/${n}/refunds/${b.dataset.approve}/approve`, { method: 'POST', body: {} }), 'Refund approved and sent.'); }));
  v.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => dialog('Reject refund', '<label>Reason<input name="reason" required minlength="3" maxlength="200"></label>', 'Reject', (f) => api(`/api/ops/orders/${n}/refunds/${b.dataset.reject}/reject`, { method: 'POST', body: f }))));

  const retForm = v.querySelector('[data-return]');
  if (retForm) {
    const idem = key();
    retForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(retForm);
      const lines = [...fd].filter(([k, val]) => k.startsWith('qty:') && Number(val) > 0).map(([k, val]) => ({ id: k.slice(4), qty: Number(val) }));
      if (!lines.length) { ctx.flash('Choose at least one item to return.', false); return; }
      run(() => api(`/api/ops/orders/${n}/returns`, { method: 'POST', body: { lines, reason: fd.get('reason'), kind: fd.get('kind'), note: fd.get('note'), override: fd.get('override') === '1' }, headers: { 'Idempotency-Key': idem } }), 'Return opened.');
    });
  }
  v.querySelectorAll('[data-rt]').forEach((b) => b.addEventListener('click', () => {
    const to = b.dataset.rtTo;
    if (to === 'inspected') return dialog('Inspection result', '<label>Findings<input name="note" maxlength="300" placeholder="Condition of the returned items"></label><label class="os-check"><input type="checkbox" name="restock" value="1"> Put the items back into stock</label>', 'Save inspection', (f) => api(`/api/ops/orders/${n}/returns/${encodeURIComponent(b.dataset.rt)}`, { method: 'POST', body: { status: to, note: f.note, restock: !!f.restock } }));
    return dialog(`${b.textContent.trim()}: ${b.dataset.rt}`, '<label>Note<input name="note" maxlength="300"></label>', 'Save', (f) => api(`/api/ops/orders/${n}/returns/${encodeURIComponent(b.dataset.rt)}`, { method: 'POST', body: { status: to, note: f.note } }));
  }));
  v.querySelectorAll('[data-rt-refund]').forEach((b) => b.addEventListener('click', () => {
    const idem = key();
    dialog(`Refund return ${b.dataset.rtRefund}`, `<label>Amount (₦)<input name="amount" type="number" min="1" step="0.01" max="${d.refundable}" value="${b.dataset.value}" required></label>`, 'Refund', (f) => api(`/api/ops/orders/${n}/refunds`, { method: 'POST', body: { amount: Number(f.amount), reason: 'returned_items', rma: b.dataset.rtRefund }, headers: { 'Idempotency-Key': idem } }));
  }));
}

/* ================================================================== Fulfilment board */
export async function fulfilmentView(v, ctx) {
  const d = await api('/api/ops/fulfilment', { loader: false });
  const st = d.stats;
  const pct = (x) => (x == null ? '—' : `${x}%`);
  const hrs = (x) => (x == null ? '—' : x < 48 ? `${x} h` : `${Math.round(x / 24 * 10) / 10} days`);
  v.innerHTML = `<header class="os-head"><div><p class="os-eyebrow">Operations</p><h1 class="os-title">Fulfilment</h1><p class="os-sub">Everything paid and not yet delivered, by delivery stage. Delivery performance covers the last 30 days.</p></div>
    <div class="os-head__actions"><a class="os-btn os-btn--ghost" href="#ops-settings">Couriers &amp; refunds</a></div></header>
  <section class="os-kpis os-kpis--6">${[['Delivery success', pct(st.successRate), 'delivered ÷ completed'], ['First attempt', pct(st.firstAttemptRate), 'delivered without a failed try'], ['On time', pct(st.onTimeRate), 'vs promised-by date'], ['Average time', hrs(st.avgHours), 'payment → delivered'], ['Slowest 10%', hrs(st.p90Hours), 'p90 payment → delivered'], ['Open problems', String(st.openExceptions), 'delivery exceptions']].map(([t, val, sub], i) => `<article class="os-kpi${i === 5 && st.openExceptions ? ' os-kpi--warn' : ''}"><h3>${t}</h3><strong>${val}</strong><p><span class="muted">${sub}</span></p></article>`).join('')}</section>
  ${st.costRecorded ? `<p class="os-note-line">Delivery costs recorded on ${st.costRecorded} shipment${st.costRecorded === 1 ? '' : 's'} (last 30 days): customers paid ${money(st.deliveryCharged)}, CNM paid couriers and riders ${money(st.deliveryCost)} (${st.deliveryCharged - st.deliveryCost >= 0 ? 'margin' : 'cost'} ${money(Math.abs(st.deliveryCharged - st.deliveryCost))}).</p>` : '<p class="os-note-line">Record what CNM pays GIG or a rider on each order to see delivery cost against what customers are charged.</p>'}
  ${d.exceptions.length ? `<section class="os-card"><header class="os-card__h"><h2>Delivery problems</h2><span class="os-count is-warn">${d.exceptions.length}</span></header><ul class="os-list">${d.exceptions.map((o) => `<li><div><a class="os-mono" href="#orders/${encodeURIComponent(o.number)}">${e(o.number)}</a> <strong>${e(label(o.exception.kind))}</strong><small>${e(o.customer)} · ${e(o.location)} · ${e(o.exception.note || '')} · ${e(ago(o.exception.openedAt))} ago</small></div><a class="os-btn os-btn--ghost" href="#orders/${encodeURIComponent(o.number)}">Resolve</a></li>`).join('')}</ul></section>` : ''}
  <div class="os-board">${d.columns.filter((c) => c.orders.length || ['awaiting_fulfilment', 'packed', 'handed_over', 'out_for_delivery'].includes(c.status)).map((c) => `<section class="os-col"><header><h2>${e(c.label)}</h2><span class="os-count">${c.orders.length}</span></header>
    ${c.orders.map((o) => `<a class="os-tile${o.exception ? ' has-problem' : ''}" href="#orders/${encodeURIComponent(o.number)}"><span class="os-mono">${e(o.number)}</span><strong>${e(o.customer)}</strong><small>${e(o.location)} · ${o.items} item${o.items === 1 ? '' : 's'} · ${money(o.total)}</small><small>${o.courier ? `${e(o.courier)}${o.tracking ? ` · ${e(o.tracking)}` : ''} · ` : ''}${e(ago(o.createdAt))} old</small></a>`).join('') || '<p class="os-empty">Nothing here.</p>'}</section>`).join('')}</div>
  ${st.byCourier.length ? `<div class="os-grid os-grid--2"><section class="os-card"><header class="os-card__h"><h2>By courier</h2></header><table class="os-cos"><thead><tr><th>Courier</th><th class="num">Completed</th><th class="num">Delivered</th><th class="num">Success</th></tr></thead><tbody>${st.byCourier.map((x) => `<tr><td>${e(x.label)}</td><td class="num">${x.done}</td><td class="num">${x.delivered}</td><td class="num">${pct(x.successRate)}</td></tr>`).join('')}</tbody></table></section>
  <section class="os-card"><header class="os-card__h"><h2>By state</h2></header><table class="os-cos"><thead><tr><th>State</th><th class="num">Completed</th><th class="num">Delivered</th><th class="num">Success</th></tr></thead><tbody>${st.byState.slice(0, 10).map((x) => `<tr><td>${e(x.label)}</td><td class="num">${x.done}</td><td class="num">${x.delivered}</td><td class="num">${pct(x.successRate)}</td></tr>`).join('')}</tbody></table></section></div>` : ''}`;
  void ctx;
}

/* ================================================================== New (manual) order */
export async function newOrderView(v, ctx) {
  const [cat, live] = await Promise.all([fetch('/catalogue.json').then((r) => r.json()), api('/api/catalogue/live', { loader: false }).catch(() => ({ products: {} }))]);
  const products = cat.products.map((p) => ({ ...p, price: live.products[p.id]?.price ?? p.price?.amount, stock: live.products[p.id]?.stock ?? p.stock?.quantity })).filter((p) => p.price != null);
  const methods = cat.commerce?.deliveryMethods || [];
  const idem = key();
  const items = new Map();
  v.innerHTML = `<a class="os-back" href="#orders">← Orders</a><header class="os-head"><div><p class="os-eyebrow">CNM Essentials</p><h1 class="os-title">New order</h1><p class="os-sub">For phone, WhatsApp and showroom sales. Prices, stock and delivery rules are the same as the website.</p></div></header>
  <form class="os-order" data-new>
    <div class="os-order__main">
      <section class="os-card"><header class="os-card__h"><h2>Products</h2></header>
        <label class="os-f os-f--grow"><span>Add a product</span><input list="os-products" data-pick placeholder="Type a product name…" autocomplete="off"></label>
        <datalist id="os-products">${products.map((p) => `<option value="${e(p.name)} — ${e(p.brand || '')}" data-id="${e(p.id)}"></option>`).join('')}</datalist>
        <table class="os-lines"><tbody data-items><tr><td class="muted">No products yet.</td></tr></tbody></table>
        <label class="os-f"><span>Promo code (optional)</span><input name="promoCode" maxlength="40"></label>
        <dl class="os-sum" data-quote></dl></section>
      <section class="os-card"><header class="os-card__h"><h2>Customer</h2></header><div class="os-form__grid">
        <label>First name<input name="firstName" required maxlength="80"></label><label>Last name<input name="lastName" required maxlength="80"></label>
        <label>Email<input name="email" type="email" required></label><label>Phone<input name="phone" type="tel" required placeholder="+234"></label></div></section>
      <section class="os-card"><header class="os-card__h"><h2>Delivery</h2></header>
        <label class="os-f"><span>Method</span><select name="method">${methods.map((m) => `<option value="${e(m.id)}">${e(m.label)} · ${m.fee ? money(m.fee) : 'Free'}</option>`).join('')}</select></label>
        <div data-addr class="os-form__grid"><label class="os-span2">Address<input name="line1" maxlength="200"></label><label>City<input name="city" maxlength="80"></label><label>State<input name="state" maxlength="40" placeholder="Lagos"></label></div>
        <label data-store hidden class="os-f"><span>Store</span><select name="storeSlug"><option value="lagos">Lagos</option><option value="abuja">Abuja</option></select></label></section>
    </div>
    <aside class="os-order__side"><section class="os-card"><header class="os-card__h"><h2>Payment</h2></header>
      <fieldset class="os-radios"><label><input type="radio" name="paymentMode" value="paid" checked> Paid now</label><label><input type="radio" name="paymentMode" value="link"> Send a payment link</label><label><input type="radio" name="paymentMode" value="unpaid"> Awaiting payment (e.g. transfer to confirm)</label></fieldset>
      <div data-paid class="os-form"><label>Method<select name="paymentMethod"><option value="pos_card">POS card</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="ussd">USSD</option></select></label><label>Payment reference<input name="paymentReason" maxlength="200" placeholder="Receipt, POS slip or bank reference"></label></div>
      <label class="os-f"><span>Sold via</span><select name="channel"><option value="manual">Phone / WhatsApp</option><option value="pos">In store</option></select></label>
      <label class="os-f"><span>Note for the team (optional)</span><input name="note" maxlength="300"></label>
      <p class="alert alert--err" data-err hidden></p>
      <button class="os-btn os-btn--block" type="submit">Create order</button></section></aside>
  </form>`;
  const form = v.querySelector('[data-new]');
  const tbody = v.querySelector('[data-items]');
  const draw = () => {
    tbody.innerHTML = items.size ? [...items.values()].map(({ p, qty }) => `<tr><td><strong>${e(p.name)}</strong><small>${e(p.brand || '')}${p.stock != null ? ` · ${p.stock} in stock` : ''}</small></td><td class="num"><input type="number" min="1" max="${p.stock ?? 10}" value="${qty}" data-qty="${e(p.id)}" style="width:64px"> × ${money(p.price)}</td><td class="num">${money(p.price * qty)}</td><td><button type="button" class="os-link-btn" data-rm="${e(p.id)}" aria-label="Remove">×</button></td></tr>`).join('') : '<tr><td class="muted">No products yet.</td></tr>';
    quote();
  };
  let qt;
  const quote = () => { clearTimeout(qt); qt = setTimeout(async () => {
    const box = v.querySelector('[data-quote]');
    if (!items.size) { box.innerHTML = ''; return; }
    try {
      const q = await api('/api/checkout/quote', { method: 'POST', loader: false, body: { items: [...items.values()].map(({ p, qty }) => ({ id: p.id, qty })), promoCode: form.promoCode.value || undefined, deliveryMethod: form.method.value } });
      box.innerHTML = `<div><dt>Subtotal</dt><dd>${money(q.subtotal)}</dd></div>${q.discount ? `<div><dt>Discount</dt><dd>−${money(q.discount)}</dd></div>` : ''}<div><dt>Delivery</dt><dd>${q.delivery ? money(q.delivery) : 'Free'}</dd></div><div class="os-sum__total"><dt>Total</dt><dd>${money(q.total)}</dd></div>${q.errors?.length ? `<div class="os-neg"><dt>${e(q.errors.map((x) => x.message).join(' '))}</dt></div>` : ''}${q.promo && !q.promo.valid && form.promoCode.value ? `<div class="os-neg"><dt>${e(q.promo.message || 'Promo code not valid')}</dt></div>` : ''}`;
    } catch (x) { box.innerHTML = `<div class="os-neg"><dt>${e(x.message)}</dt></div>`; }
  }, 250); };
  v.querySelector('[data-pick]').addEventListener('change', (ev) => {
    const opt = [...v.querySelectorAll('#os-products option')].find((o) => o.value === ev.target.value);
    const p = opt && products.find((x) => x.id === opt.dataset.id);
    if (p) { const cur = items.get(p.id); items.set(p.id, { p, qty: (cur?.qty || 0) + 1 }); ev.target.value = ''; draw(); }
  });
  tbody.addEventListener('input', (ev) => { const id = ev.target.dataset.qty; if (id) { items.get(id).qty = Math.max(1, Number(ev.target.value) || 1); quote(); } });
  tbody.addEventListener('click', (ev) => { const id = ev.target.closest('[data-rm]')?.dataset.rm; if (id) { items.delete(id); draw(); } });
  const syncDelivery = () => { const pickup = form.method.value === 'store-pickup'; v.querySelector('[data-addr]').hidden = pickup; v.querySelector('[data-store]').hidden = !pickup; quote(); };
  const syncPay = () => { v.querySelector('[data-paid]').hidden = form.paymentMode.value !== 'paid'; };
  form.method.addEventListener('change', syncDelivery); form.promoCode.addEventListener('input', quote);
  form.querySelectorAll('[name=paymentMode]').forEach((r) => r.addEventListener('change', syncPay));
  syncDelivery(); syncPay();
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const err = v.querySelector('[data-err]');
    if (!items.size) { err.textContent = 'Add at least one product.'; err.hidden = false; return; }
    const body = {
      companyId: 'essentials', channel: f.channel, items: [...items.values()].map(({ p, qty }) => ({ id: p.id, qty })), promoCode: f.promoCode || undefined, note: f.note,
      contact: { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone },
      delivery: f.method === 'store-pickup' ? { method: f.method, storeSlug: f.storeSlug } : { method: f.method, address: { line1: f.line1, city: f.city, state: f.state } },
      paymentMode: f.paymentMode, paymentMethod: f.paymentMethod, paymentReason: f.paymentReason,
    };
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; err.hidden = true;
    try {
      const r = await api('/api/ops/orders', { method: 'POST', body, headers: { 'Idempotency-Key': idem } });
      ctx.flash(r.paymentLink ? `Order ${r.number} created. Payment link copied.` : r.note || `Order ${r.number} created.`, !r.note);
      if (r.paymentLink) navigator.clipboard?.writeText(r.paymentLink).catch(() => {});
      location.hash = `#orders/${encodeURIComponent(r.number)}`;
    } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
  });
  void ctx;
}

/* ================================================================== Invoice & packing slips (print) */
function docHead(d, title, idLine) {
  const s = d.seller;
  return `<header class="doc__head"><div class="doc__brand"><img src="${e(s.logo)}" alt="${e(s.name)}"><div><strong>${e(s.name)}</strong>${s.addresses.map((a) => `<span>${e(a)}</span>`).join('')}<span>${[s.email, s.phone, s.web].filter(Boolean).map(e).join(' · ')}</span>${s.rcNumber ? `<span>RC ${e(s.rcNumber)}</span>` : ''}${s.taxId ? `<span>TIN ${e(s.taxId)}</span>` : ''}</div></div>
    <div class="doc__meta"><span class="doc__type">${title}</span>${idLine}</div></header>`;
}
export async function invoiceView(v, number) {
  const d = await api(`/api/ops/orders/${encodeURIComponent(number)}`, { loader: false });
  const o = d.order; const a = o.delivery.address;
  const paid = ['paid', 'processing', 'dispatched', 'delivered', 'returned', 'refunded'].includes(o.status);
  v.innerHTML = `<div class="doc-bar no-print"><a class="os-back" href="#orders/${encodeURIComponent(o.number)}">← ${e(o.number)}</a><button class="os-btn" type="button" onclick="print()">Print or save as PDF</button></div>
  <article class="doc">${docHead(d, 'Invoice', `<dl><div><dt>Invoice</dt><dd>${e(d.invoiceNumber)}</dd></div><div><dt>Order</dt><dd>${e(o.number)}</dd></div><div><dt>Date</dt><dd>${e(day(o.createdAt))}</dd></div><div><dt>Status</dt><dd>${paid ? 'Paid' : 'Awaiting payment'}</dd></div></dl>`)}
    <section class="doc__parties"><div><h3>Bill to</h3><p><strong>${e(o.contact.firstName)} ${e(o.contact.lastName)}</strong><br>${e(o.contact.email)}<br>${e(o.contact.phone)}</p></div><div><h3>${a ? 'Ship to' : 'Collect from'}</h3><p>${e(o.delivery.label)}<br>${a ? `${e(a.line1)}${a.line2 ? `, ${e(a.line2)}` : ''}<br>${e(a.city)}, ${e(a.state)}` : d.pickupStore ? `${e(d.pickupStore.name)}<br>${e(d.pickupStore.address)}` : e(o.delivery.storeSlug || '')}</p></div><div><h3>Payment</h3><p>${e(PAY_LABEL[o.payment?.method] || label(o.payment?.method))}${o.payment?.paidAt ? `<br>Paid ${e(day(o.payment.paidAt))}` : ''}<br><span class="doc__ref">${e(o.payment?.reference || '')}</span></p></div></section>
    <table class="doc__lines"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${o.lines.map((l) => `<tr><td>${e(l.name)}<small>${e(l.id)}</small></td><td class="num">${l.qty}</td><td class="num">${money(l.unitPrice)}</td><td class="num">${money(l.lineTotal)}</td></tr>`).join('')}</tbody></table>
    <dl class="doc__totals"><div><dt>Subtotal</dt><dd>${money(o.totals.subtotal)}</dd></div>${o.totals.discount ? `<div><dt>Discount${o.promoCode ? ` (${e(o.promoCode)})` : ''}</dt><dd>−${money(o.totals.discount)}</dd></div>` : ''}<div><dt>Delivery</dt><dd>${o.totals.delivery ? money(o.totals.delivery) : 'Free'}</dd></div><div class="doc__vat"><dt>VAT 7.5% (included)</dt><dd>${money(o.totals.vat)}</dd></div><div class="doc__grand"><dt>Total</dt><dd>${money(o.totals.total)}</dd></div>${d.refunded ? `<div><dt>Refunded</dt><dd>−${money(d.refunded)}</dd></div>` : ''}<div><dt>${paid ? 'Amount paid' : 'Amount due'}</dt><dd>${money(paid ? o.totals.total : o.totals.total)}</dd></div></dl>
    <footer class="doc__foot">Thank you for choosing ${e(d.seller.name)}. Questions about this invoice: ${e(d.seller.email || '')}${d.seller.phone ? ` · ${e(d.seller.phone)}` : ''}. Please quote ${e(d.invoiceNumber)}.</footer></article>`;
}
export async function slipsView(v, numbers) {
  const list = await Promise.all(numbers.slice(0, 50).map((n) => api(`/api/ops/orders/${encodeURIComponent(n)}`, { loader: false }).catch(() => null)));
  const ok = list.filter(Boolean);
  v.innerHTML = `<div class="doc-bar no-print"><a class="os-back" href="${ok.length === 1 ? `#orders/${encodeURIComponent(ok[0].order.number)}` : '#orders'}">← Back</a><span class="muted">${ok.length} packing slip${ok.length === 1 ? '' : 's'}</span><button class="os-btn" type="button" onclick="print()">Print</button></div>
  ${ok.map((d) => { const o = d.order; const a = o.delivery.address; const s = o.shipment || {}; return `<article class="doc doc--slip">${docHead(d, 'Packing slip', `<dl><div><dt>Order</dt><dd>${e(o.number)}</dd></div><div><dt>Date</dt><dd>${e(day(o.createdAt))}</dd></div>${s.trackingNumber ? `<div><dt>Tracking</dt><dd>${e(s.trackingNumber)}</dd></div>` : ''}</dl>`)}
    <section class="doc__parties"><div class="doc__shipto"><h3>${a ? 'Deliver to' : 'Collect from'}</h3><p><strong>${e(o.contact.firstName)} ${e(o.contact.lastName)}</strong><br>${a ? `${e(a.line1)}${a.line2 ? `<br>${e(a.line2)}` : ''}<br>${e(a.city)}, ${e(a.state)}` : d.pickupStore ? `${e(d.pickupStore.name)}<br>${e(d.pickupStore.address)}` : e(o.delivery.storeSlug || '')}<br>${e(o.contact.phone)}</p></div><div><h3>Delivery</h3><p>${e(o.delivery.label)}${d.couriers.find((c) => c.id === s.courier) ? `<br>${e(d.couriers.find((c) => c.id === s.courier).name)}` : ''}</p></div></section>
    <table class="doc__lines"><thead><tr><th class="cbx">✓</th><th>Item</th><th>SKU</th><th class="num">Qty</th></tr></thead><tbody>${o.lines.map((l) => `<tr><td class="cbx"><span class="doc__box"></span></td><td>${e(l.name)}</td><td class="doc__ref">${e(l.id)}</td><td class="num"><strong>${l.qty}</strong></td></tr>`).join('')}</tbody></table>
    ${o.notes ? `<p class="doc__note"><strong>Customer note:</strong> ${e(o.notes)}</p>` : ''}
    <footer class="doc__foot doc__sign"><span>Packed by ____________________</span><span>Checked by ____________________</span></footer></article>`; }).join('')}`;
}

/* ================================================================== Couriers & refund settings */
export async function opsSettingsView(v, ctx) {
  const [{ couriers }, cfg] = await Promise.all([api('/api/ops/couriers', { loader: false }), api('/api/ops/settings', { loader: false })]);
  const isOwner = ctx.me.role === 'owner';
  const canEdit = ['owner', 'manager'].includes(ctx.me.role);
  const row = (c = {}) => `<tr><td><input name="name" value="${e(c.name || '')}" required maxlength="60"${canEdit ? '' : ' disabled'}><input type="hidden" name="id" value="${e(c.id || '')}"></td><td><select name="kind"${canEdit ? '' : ' disabled'}>${[['courier', 'Courier (waybill)'], ['rider', 'Booked rider'], ['pickup', 'Customer collects']].map(([k, t]) => `<option value="${k}"${(c.kind || 'courier') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></td><td><input name="trackingUrl" value="${e(c.trackingUrl || '')}" placeholder="https://…{tracking}"${canEdit ? '' : ' disabled'}></td><td><input type="checkbox" name="active"${c.active === false ? '' : ' checked'}${canEdit ? '' : ' disabled'}></td><td class="os-mono os-small">${c.id ? e(`/api/couriers/${c.id}/webhook`) : '—'}</td>${canEdit ? '<td><button type="button" class="os-link-btn" data-del aria-label="Remove">×</button></td>' : ''}</tr>`;
  v.innerHTML = `<header class="os-head"><div><p class="os-eyebrow">Settings</p><h1 class="os-title">Couriers &amp; refunds</h1><p class="os-sub">Add the couriers CNM uses. A tracking link template turns tracking numbers into links for staff and customers.</p></div></header>
  <form class="os-card os-form" data-couriers><header class="os-card__h"><h2>Couriers</h2></header>
    <div class="os-table-wrap"><table class="os-cos os-edit"><thead><tr><th>Name</th><th>Type</th><th>Tracking link template</th><th>Active</th><th>Webhook address</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${couriers.map(row).join('')}</tbody></table></div>
    <p class="muted os-small">Webhooks: each courier signs updates with the secret in the <code>COURIER_WEBHOOK_SECRET_&lt;ID&gt;</code> environment variable (for example <code>COURIER_WEBHOOK_SECRET_GIG</code>). Tracking links are only shown when CNM adds a template, so nothing is guessed.</p>
    ${canEdit ? '<div class="os-row-actions"><button class="os-btn os-btn--ghost" type="button" data-add>Add courier</button><button class="os-btn" type="submit">Save couriers</button></div>' : ''}</form>
  <form class="os-card os-form" data-thr style="max-width:560px"><header class="os-card__h"><h2>Refund approvals</h2></header>
    <label>Refunds above this amount need a second manager to approve (₦)<input name="t" type="number" min="0" step="1000" value="${cfg.refundApprovalThreshold}"${isOwner ? '' : ' disabled'}></label>
    <p class="muted os-small">${isOwner ? 'Only owners can change this.' : 'Set by the owner.'} Every request, approval and rejection is in the audit log.</p>
    ${isOwner ? '<button class="os-btn" type="submit" style="justify-self:start">Save</button>' : ''}</form>`;
  const tb = v.querySelector('[data-couriers] tbody');
  v.querySelector('[data-add]')?.addEventListener('click', () => tb.insertAdjacentHTML('beforeend', row()));
  tb.addEventListener('click', (ev) => ev.target.closest('[data-del]')?.closest('tr').remove());
  v.querySelector('[data-couriers]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const list = [...tb.querySelectorAll('tr')].map((tr) => ({ id: tr.querySelector('[name=id]').value || undefined, name: tr.querySelector('[name=name]').value, kind: tr.querySelector('[name=kind]').value, trackingUrl: tr.querySelector('[name=trackingUrl]').value, active: tr.querySelector('[name=active]').checked }));
    try { await api('/api/ops/couriers', { method: 'PUT', body: { couriers: list } }); ctx.flash('Couriers saved.'); opsSettingsView(v, ctx); } catch (x) { ctx.flash(x.message, false); }
  });
  v.querySelector('[data-thr]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await api('/api/ops/settings', { method: 'PUT', body: { refundApprovalThreshold: Number(ev.currentTarget.t.value) } }); ctx.flash('Saved.'); } catch (x) { ctx.flash(x.message, false); }
  });
}

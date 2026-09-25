import { productCardHTML } from '../../shared/card.mjs';
import { escapeHtml, formatDate, formatMoney } from '../../shared/format.mjs';
import { api } from '../api.js';
import { paintWish } from '../render.js';
import * as S from '../store.js';
import { formData, setBusy, toast, validate } from '../ui.js';
import { orderDetailHTML } from './confirmation.js';

const NG_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
const pill = (s) => `<span class="pill pill--${s}">${s.replace(/_/g, ' ')}</span>`;

export async function init() {
  const root = document.querySelector('[data-account]');
  const panel = root.querySelector('[data-account-panel]');
  const view = root.dataset.view;
  let user;
  try {
    ({ user } = await api('/api/auth/me', { loader: false }));
    S.setUser(user);
  } catch {
    S.setUser(null);
    location.replace(`/account/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }

  root.querySelector('[data-logout]').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    S.setUser(null);
    location.href = '/';
  });

  const views = { overview, orders, order, profile, addresses, preferences };
  await views[view](panel, user);
}

async function overview(panel, user) {
  const [{ orders: list }, { byId }] = await Promise.all([api('/api/account/orders', { loader: false }), S.catalogue()]);
  const recent = S.getRecent().map((id) => byId.get(id)).filter(Boolean).slice(0, 4);
  panel.innerHTML = `<h1 class="h2" style="font-family:var(--serif)">Welcome, ${escapeHtml(user.firstName)}.</h1>
  <div class="cards-2">
    <div class="box"><span class="label">Latest order</span>${list[0] ? `<a class="textlink" href="/account/orders/view/?n=${encodeURIComponent(list[0].number)}">${escapeHtml(list[0].number)}</a><span>${pill(list[0].status)} · ${formatMoney(list[0].total)}</span>` : '<span class="muted">No orders yet.</span><a class="textlink" href="/shop/">Start shopping</a>'}</div>
    <div class="box"><span class="label">Wishlist</span><span>${S.getWish().length} saved item${S.getWish().length === 1 ? '' : 's'}</span><a class="textlink" href="/wishlist/">View wishlist</a></div>
    <div class="box"><span class="label">Profile</span><span>${escapeHtml(user.email)}</span><a class="textlink" href="/account/profile/">Edit profile</a></div>
    <div class="box"><span class="label">Preferences</span><span class="muted">Choose how we contact you.</span><a class="textlink" href="/account/preferences/">Manage</a></div>
  </div>
  ${recent.length ? `<h2 class="label" style="margin-top:24px">Recently viewed</h2><div class="grid-products">${recent.map((p, i) => productCardHTML(p, { position: i + 1, list: 'account_recent' })).join('')}</div>` : ''}`;
  paintWish(panel);
}

async function orders(panel) {
  const { orders: list } = await api('/api/account/orders', { loader: false });
  panel.innerHTML = `<h1 class="h2" style="font-family:var(--serif)">Orders</h1>
  ${list.length ? `<table class="table table--stack"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th><span class="sr-only">View</span></th></tr></thead><tbody>${list.map((o) => `<tr><td><strong>${escapeHtml(o.number)}</strong></td><td>${formatDate(o.createdAt)}</td><td>${pill(o.status)}</td><td>${formatMoney(o.total)}</td><td><a class="textlink" href="/account/orders/view/?n=${encodeURIComponent(o.number)}">View</a></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><p class="h3">No orders yet.</p><a class="btn" href="/shop/">Start shopping</a></div>'}`;
}

async function order(panel) {
  const n = new URLSearchParams(location.search).get('n');
  try {
    const { order: o } = await api(`/api/account/orders/${encodeURIComponent(n)}`, { loader: false });
    panel.innerHTML = `<a class="textlink muted" href="/account/orders/">← All orders</a><h1 class="h2" style="font-family:var(--serif)">Order ${escapeHtml(o.number)}</h1><p class="muted">Placed ${formatDate(o.createdAt)} · ${pill(o.status)}</p>${orderDetailHTML(o)}
    ${o.history?.length ? `<h2 class="label">History</h2><ul>${o.history.map((h) => `<li style="padding:6px 0;border-bottom:1px solid var(--line)">${formatDate(h.at)} — ${pill(h.status)} ${h.note ? escapeHtml(h.note) : ''}</li>`).join('')}</ul>` : ''}`;
  } catch (e) {
    panel.innerHTML = `<p class="alert alert--err">${escapeHtml(e.message)}</p>`;
  }
}

async function profile(panel, user) {
  const { profile: p } = await api('/api/account/profile', { loader: false });
  panel.innerHTML = `<h1 class="h2" style="font-family:var(--serif)">Profile</h1>
  <form class="form" data-profile novalidate style="max-width:520px">
    <div class="form-row"><div class="field"><label for="p-first">First name</label><input id="p-first" name="firstName" required value="${escapeHtml(p.firstName)}"></div><div class="field"><label for="p-last">Last name</label><input id="p-last" name="lastName" required value="${escapeHtml(p.lastName)}"></div></div>
    <div class="field"><label for="p-email">Email</label><input id="p-email" value="${escapeHtml(user.email)}" disabled><span class="hint">Contact us to change your sign-in email.</span></div>
    <div class="field"><label for="p-phone">Phone</label><input id="p-phone" name="phone" type="tel" value="${escapeHtml(p.phone || '')}"></div>
    <button class="btn" type="submit" style="justify-self:start">Save changes</button>
  </form>
  <div class="box" style="max-width:520px;margin-top:24px"><span class="label">Security</span><a class="textlink" href="/account/reset/">Change password</a><button class="textlink" type="button" data-logout-all style="justify-self:start">Sign out of all devices</button></div>`;
  panel.querySelector('[data-profile]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!validate(f)) return;
    const btn = f.querySelector('button');
    setBusy(btn, true, 'Saving');
    try { await api('/api/account/profile', { method: 'PUT', body: formData(f) }); toast('Profile saved'); } catch (ex) { toast(ex.message); }
    setBusy(btn, false);
  });
  panel.querySelector('[data-logout-all]').addEventListener('click', async () => {
    await api('/api/account/logout-all', { method: 'POST' });
    S.setUser(null);
    location.href = '/account/login/';
  });
}

async function addresses(panel) {
  let { addresses: list } = await api('/api/account/addresses', { loader: false });
  const form = (a = {}) => `<form class="form box" data-addr-form data-id="${escapeHtml(a.id || '')}" novalidate>
    <div class="form-row"><div class="field"><label>Label<input name="label" value="${escapeHtml(a.label || 'Home')}" required></label></div><div class="field"><label>Phone<input name="phone" type="tel" value="${escapeHtml(a.phone || '')}" required></label></div></div>
    <div class="form-row"><div class="field"><label>First name<input name="firstName" value="${escapeHtml(a.firstName || '')}" required></label></div><div class="field"><label>Last name<input name="lastName" value="${escapeHtml(a.lastName || '')}" required></label></div></div>
    <div class="field"><label>Address<input name="line1" value="${escapeHtml(a.line1 || '')}" required autocomplete="address-line1"></label></div>
    <div class="field"><label>Apartment, landmark (optional)<input name="line2" value="${escapeHtml(a.line2 || '')}"></label></div>
    <div class="form-row"><div class="field"><label>City / area<input name="city" value="${escapeHtml(a.city || '')}" required></label></div><div class="field"><label>State<select name="state" required><option value="">Select</option>${NG_STATES.map((s) => `<option${s === a.state ? ' selected' : ''}>${s}</option>`).join('')}</select></label></div></div>
    <label class="check"><input type="checkbox" name="isDefault"${a.isDefault ? ' checked' : ''}> Default address</label>
    <div style="display:flex;gap:10px"><button class="btn" type="submit">Save address</button><button class="btn btn--ghost" type="button" data-addr-cancel>Cancel</button></div>
  </form>`;
  const render = () => {
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><h1 class="h2" style="font-family:var(--serif)">Addresses</h1><button class="btn btn--ghost" type="button" data-addr-new>Add address</button></div>
    <div data-addr-editor></div>
    <div class="cards-2">${list.map((a) => `<div class="box"><span class="label">${escapeHtml(a.label)}${a.isDefault ? ' · Default' : ''}</span><span>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</span><span class="muted">${escapeHtml(a.line1)}${a.line2 ? `, ${escapeHtml(a.line2)}` : ''}<br>${escapeHtml(a.city)}, ${escapeHtml(a.state)}<br>${escapeHtml(a.phone)}</span><div style="display:flex;gap:16px"><button class="textlink" type="button" data-addr-edit="${a.id}">Edit</button><button class="textlink" type="button" data-addr-del="${a.id}">Delete</button></div></div>`).join('') || '<p class="muted">No saved addresses yet.</p>'}</div>`;
  };
  const persist = async (next) => { ({ addresses: list } = await api('/api/account/addresses', { method: 'PUT', body: { addresses: next } })); render(); toast('Addresses updated'); };
  panel.addEventListener('click', (e) => {
    const editor = panel.querySelector('[data-addr-editor]');
    if (e.target.closest('[data-addr-new]')) editor.innerHTML = form();
    const ed = e.target.closest('[data-addr-edit]');
    if (ed) editor.innerHTML = form(list.find((a) => a.id === ed.dataset.addrEdit));
    if (e.target.closest('[data-addr-cancel]')) editor.innerHTML = '';
    const del = e.target.closest('[data-addr-del]');
    if (del && confirm('Delete this address?')) persist(list.filter((a) => a.id !== del.dataset.addrDel));
  });
  panel.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-addr-form]');
    if (!f) return;
    e.preventDefault();
    if (!validate(f)) return;
    const a = { ...formData(f), id: f.dataset.id || undefined };
    let next = f.dataset.id ? list.map((x) => (x.id === f.dataset.id ? { ...x, ...a } : x)) : [...list, a];
    if (a.isDefault) next = next.map((x) => ({ ...x, isDefault: x === a || x.id === a.id }));
    persist(next);
  });
  render();
}

async function preferences(panel) {
  const { preferences: p } = await api('/api/account/preferences', { loader: false });
  const TOPICS = [['orders', 'Order updates', 'Confirmation, dispatch and delivery'], ['backInStock', 'Back in stock', 'When saved or requested items return'], ['wishlist', 'Wishlist reminders', 'Occasional reminders about saved items'], ['newArrivals', 'New collections & launches', 'New products and collections'], ['events', 'Store & event news', 'Openings and events in Lagos and Abuja'], ['promotions', 'Offers', 'Promotional campaigns']];
  const CH = [['email', 'Email'], ['sms', 'SMS'], ['push', 'App notifications']];
  panel.innerHTML = `<h1 class="h2" style="font-family:var(--serif)">Communication preferences</h1>
  <p class="muted">Choose exactly what you hear about and where. We never send marketing without your consent.</p>
  <form data-prefs style="max-width:640px">${CH.map(([c, cl]) => `<fieldset style="border:0;padding:0;margin:0 0 32px"><legend class="label" style="margin-bottom:8px">${cl}</legend>${TOPICS.map(([k, l, d]) => `<label class="toggle"><span><strong style="font-weight:500">${l}</strong><br><span class="muted" style="font-size:.8125rem">${d}</span></span><input type="checkbox" name="${c}.${k}"${p[c]?.[k] ? ' checked' : ''}></label>`).join('')}</fieldset>`).join('')}
  <p class="muted" style="font-size:.8125rem">App notifications are delivered to the CNM Essentials iOS and Android apps.</p></form>`;
  panel.querySelector('[data-prefs]').addEventListener('change', async (e) => {
    const [c, k] = e.target.name.split('.');
    p[c] = { ...p[c], [k]: e.target.checked };
    try { await api('/api/account/preferences', { method: 'PUT', body: p, loader: false }); toast('Preferences saved'); } catch (ex) { toast(ex.message); e.target.checked = !e.target.checked; }
  });
}

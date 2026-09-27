// CNM Group OS — the operating system for every CNM company (single-page, role- and company-aware).
// All authorisation is enforced server-side; the UI only hides what a role can't use.
import { escapeHtml as e, formatDate } from '../../shared/format.mjs';
import { api } from '../api.js';
import { auditView, command, companiesView, stopLive } from './os.js';
import { fulfilmentView, invoiceView, newOrderView, opsSettingsView, orderPage, ordersView, slipsView } from './ops.js';

const root = document.querySelector('[data-admin]');
let me = null;

const I = {
  command: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z', companies: 'M3 21V7l6-4 6 4v14M9 21v-5h0M15 11h6v10M3 21h18M7 9h.01M11 9h.01M7 13h.01M11 13h.01',
  orders: 'M6 2h12l2 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM4 7h16M9 11a3 3 0 0 0 6 0', customers: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 3-3.87',
  inventory: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8', discounts: 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01', content: 'M4 4h16v16H4zM4 9h16M9 9v11',
  stores: 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6M3 9h18', seo: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', enquiries: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  subscribers: 'M4 4h16v16H4zM4 7l8 6 8-6', media: 'M4 5h16v14H4zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM20 16l-5-5-9 8', analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-2a6 6 0 0 1 12 0v2M19 8v6M22 11h-6', fulfilment: 'M1 4h13v12H1zM14 8h4l3 4v4h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'ops-settings': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z', audit: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${I[k] || I.command}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// [key, label, permission, section]
const NAV = [
  ['command', 'Command Center', 'dashboard', 'Overview'], ['companies', 'Companies', 'dashboard', 'Overview'],
  ['orders', 'Orders', 'orders', 'Commerce'], ['fulfilment', 'Fulfilment', 'orders', 'Commerce'], ['inventory', 'Products & inventory', 'inventory', 'Commerce'], ['customers', 'Customers', 'customers', 'Commerce'], ['discounts', 'Discounts & promotions', 'discounts', 'Commerce'],
  ['enquiries', 'Leads & enquiries', 'enquiries', 'Commerce'],
  ['content', 'Homepage & banners', 'content', 'Content'], ['stores', 'Stores', 'content', 'Content'], ['seo', 'SEO & redirects', 'content', 'Content'], ['media', 'Media', 'media', 'Content'],
  ['analytics', 'Analytics', 'analytics', 'Insights'], ['subscribers', 'Subscribers', 'subscribers', 'Insights'],
  ['ops-settings', 'Couriers & refunds', 'orders', 'Settings'], ['users', 'Staff & roles', 'users', 'Settings'], ['audit', 'Audit log', 'audit', 'Settings'],
];
const pill = (s) => `<span class="pill pill--${e(s)}">${e(String(s).replace(/_/g, ' '))}</span>`;
const flash = (msg, ok = true) => { const f = document.querySelector('[data-flash]'); f.className = `alert ${ok ? 'alert--ok' : 'alert--err'}`; f.textContent = msg; f.hidden = false; setTimeout(() => { f.hidden = true; }, 3500); };

async function boot() {
  try { ({ admin: me } = await api('/api/admin/me', { loader: false })); shell(); route(); } catch { login(); }
}

// Sign-in: email + password → 6-digit code from email → PIN → dashboard.
const loginCard = (inner, step) => `<div class="admin-login os-login"><div class="stack"><img src="/assets/brand/cnm-group-emblem-128.webp" alt="" width="56" height="59"><p class="os-eyebrow">CNM Group</p><h1 class="h2">Operating system</h1>
  <ol class="os-login__steps" aria-label="Sign-in steps">${['Password', 'Email code', 'PIN'].map((t, i) => `<li class="${i < step ? 'is-done' : i === step ? 'is-now' : ''}"${i === step ? ' aria-current="step"' : ''}>${t}</li>`).join('')}</ol>
  ${inner}<p class="muted" style="font-size:.75rem">Access is restricted to CNM staff. Activity is audited.</p></div></div>`;
const errBox = (err) => (err ? `<p class="alert alert--err" role="alert">${e(err)}</p>` : '');
function login(err = '') {
  root.innerHTML = loginCard(`<p class="muted os-login__lead">Sign in to manage every CNM company.</p>${errBox(err)}
  <form class="form" data-login novalidate><div class="field"><label for="ae">Email</label><input id="ae" name="email" type="email" autocomplete="username" required></div>
  <div class="field"><label for="ap">Password</label><input id="ap" name="password" type="password" autocomplete="current-password" required></div>
  <button class="os-btn" type="submit">Continue</button></form>`, 0);
  root.querySelector('[data-login]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    try { otpStep(await api('/api/admin/login', { method: 'POST', body: { email: f.email.value.trim(), password: f.password.value } })); } catch (x) { login(x.message); }
  });
}
const restartOr = (x, again) => (x.code === 'login_expired' ? login(x.message) : again(x.message));
function otpStep(info, err = '', note = '') {
  root.innerHTML = loginCard(`<p class="muted os-login__lead">We emailed a 6-digit code to <strong>${e(info.email)}</strong>. It expires in ${e(info.expiresInMinutes || 10)} minutes.</p>${errBox(err)}${note ? `<p class="alert alert--ok" data-otp-note>${e(note)}</p>` : ''}
  ${info.devCode ? `<p class="alert alert--ok" data-dev-code>Local development: your code is ${e(info.devCode)}</p>` : ''}
  <form class="form" data-otp novalidate><div class="field"><label for="ac">Code from your email</label><input id="ac" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div>
  <button class="os-btn" type="submit">Verify code</button></form>
  <p class="os-login__links"><button class="textlink" type="button" data-resend>Send a new code</button><button class="textlink" type="button" data-restart>Use a different account</button></p>`, 1);
  const f = root.querySelector('[data-otp]');
  f.code.focus();
  f.code.addEventListener('input', () => { f.code.value = f.code.value.replace(/\D/g, '').slice(0, 6); });
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await api('/api/admin/login/otp', { method: 'POST', body: { code: f.code.value } }); pinStep(); } catch (x) { restartOr(x, (m) => otpStep(info, m)); }
  });
  root.querySelector('[data-resend]').addEventListener('click', async () => {
    try { const next = await api('/api/admin/login/resend', { method: 'POST', body: {} }); otpStep(next, '', 'A new code is on its way. Earlier codes no longer work.'); } catch (x) { restartOr(x, (m) => otpStep(info, m)); }
  });
  root.querySelector('[data-restart]').addEventListener('click', () => login());
}
function pinStep(err = '') {
  root.innerHTML = loginCard(`<p class="muted os-login__lead">Code verified. Enter your 6-digit admin PIN to open the dashboard.</p>${errBox(err)}
  <form class="form" data-pin novalidate><div class="field"><label for="apin">PIN</label><input id="apin" name="pin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" maxlength="6" required></div>
  <button class="os-btn" type="submit">Open dashboard</button></form>
  <p class="os-login__links"><button class="textlink" type="button" data-restart>Start again</button></p>`, 2);
  const f = root.querySelector('[data-pin]');
  f.pin.focus();
  f.pin.addEventListener('input', () => { f.pin.value = f.pin.value.replace(/\D/g, '').slice(0, 6); });
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { ({ admin: me } = await api('/api/admin/login/pin', { method: 'POST', body: { pin: f.pin.value } })); shell(); route(); } catch (x) { restartOr(x, (m) => pinStep(m)); }
  });
  root.querySelector('[data-restart]').addEventListener('click', () => login());
}

const NAV_KEY = 'cnm.os.nav';
function shell() {
  const collapsed = (() => { try { return localStorage.getItem(NAV_KEY) === 'collapsed'; } catch { return false; } })();
  const items = NAV.filter(([, , p]) => me.permissions.includes(p));
  const sections = [...new Set(items.map((x) => x[3]))];
  root.innerHTML = `<div class="os${collapsed ? ' is-collapsed' : ''}" data-os>
    <header class="os-top"><button class="os-icon" type="button" data-nav-open aria-label="Open menu" aria-controls="os-nav" aria-expanded="false"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      <a class="os-top__brand" href="#command"><img src="/assets/brand/cnm-group-emblem-128.webp" alt="" width="28" height="29"><span>CNM Group <b>OS</b></span></a>
      <button class="os-top__me" type="button" data-nav-open aria-label="Account and menu"><span class="os-avatar" aria-hidden="true">${e((me.name || me.email).slice(0, 1).toUpperCase())}</span></button></header>
    <aside class="os-nav" id="os-nav" aria-label="CNM Group OS">
      <div class="os-nav__brand"><a href="#command" class="os-nav__logo"><img src="/assets/brand/cnm-group-emblem-128.webp" alt="" width="34" height="36"><span><strong>CNM Group</strong><small>Operating system</small></span></a>
        <button class="os-icon os-nav__collapse" type="button" data-collapse aria-label="${collapsed ? 'Expand' : 'Collapse'} sidebar" aria-pressed="${collapsed}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="os-nav__acct"><span class="os-avatar" aria-hidden="true">${e((me.name || me.email).slice(0, 1).toUpperCase())}</span><span class="os-nav__who"><strong>${e(me.name)}</strong><small>${e(me.email)}</small></span>
        <button class="os-acct__out" type="button" data-logout><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Sign out</button>
        <button class="os-icon os-acct__close" type="button" data-nav-close aria-label="Close menu"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button></div>
      <nav>${sections.map((sec) => `<p class="os-nav__sec">${sec}</p>${items.filter((x) => x[3] === sec).map(([k, l]) => `<a href="#${k}" data-nav="${k}" title="${e(l)}">${icon(k)}<span>${e(l)}</span></a>`).join('')}`).join('')}</nav>
      <div class="os-nav__me"><span class="os-avatar" aria-hidden="true">${e((me.name || me.email).slice(0, 1).toUpperCase())}</span><span class="os-nav__who"><strong>${e(me.name)}</strong><small>${e(me.role)}${Array.isArray(me.scope) ? ` · ${me.scope.length} compan${me.scope.length === 1 ? 'y' : 'ies'}` : ' · all companies'}</small></span></div>
      <div class="os-nav__actions"><button class="os-link os-theme" type="button" data-os-theme title="Light / dark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span data-os-theme-label></span></button>${me.permissions.includes('publish') ? '<button class="os-btn os-btn--light" type="button" data-publish>Publish site</button>' : ''}<a class="os-link" href="/" target="_blank" rel="noopener">View sites ↗</a><button class="os-link" type="button" data-logout>Sign out</button></div>
    </aside>
    <div class="os-scrim" data-nav-close></div>
    <main class="os-main"><div class="alert" data-flash hidden></div><div data-view></div></main></div>`;
  const os = root.querySelector('[data-os]');
  root.querySelector('[data-collapse]').addEventListener('click', (ev) => {
    const on = !os.classList.contains('is-collapsed');
    os.classList.toggle('is-collapsed', on);
    ev.currentTarget.setAttribute('aria-pressed', String(on));
    ev.currentTarget.setAttribute('aria-label', `${on ? 'Expand' : 'Collapse'} sidebar`);
    try { localStorage.setItem(NAV_KEY, on ? 'collapsed' : 'open'); } catch { /* ignore */ }
  });
  // Light / dark: same switch and memory (cnm.theme) as every CNM website; follows the device until chosen.
  const themeBtn = root.querySelector('[data-os-theme]');
  const themeLabel = () => { const dark = document.documentElement.dataset.theme === 'dark'; themeBtn.querySelector('[data-os-theme-label]').textContent = dark ? 'Light mode' : 'Dark mode'; themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); };
  themeLabel();
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (window.cnmSetTheme) window.cnmSetTheme(next); else document.documentElement.dataset.theme = next;
    themeLabel();
  });
  const setMobile = (open) => { os.classList.toggle('is-nav-open', open); root.querySelector('.os-top [data-nav-open]').setAttribute('aria-expanded', String(open)); };
  root.querySelectorAll('[data-nav-open]').forEach((b) => b.addEventListener('click', () => setMobile(true)));
  root.querySelectorAll('[data-nav-close]').forEach((b) => b.addEventListener('click', () => setMobile(false)));
  root.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', () => setMobile(false)));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') setMobile(false); });
  root.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); }));
  root.querySelector('[data-publish]')?.addEventListener('click', async () => {
    if (!confirm('Rebuild and publish the site with the latest content?')) return;
    try { await api('/api/admin/publish', { method: 'POST' }); flash('Publishing started. Changes go live in a few minutes.'); } catch (x) { flash(x.message, false); }
  });
  window.addEventListener('hashchange', route);
}

async function route() {
  let key = location.hash.slice(1).split(/[/?]/)[0] || 'command';
  if (key === 'dashboard') key = 'command';
  const arg = decodeURIComponent(location.hash.split('?')[0].split('/')[1] || '');
  stopLive();
  const navKey = ['new-order', 'invoice', 'slips'].includes(key) ? 'orders' : key;
  root.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  // Each navigation renders into a fresh container, so a slower screen that finishes late can never draw over
  // the one the person has moved on to (it writes into a detached element instead).
  const old = root.querySelector('[data-view]');
  const view = document.createElement('div');
  view.setAttribute('data-view', '');
  old.replaceWith(view);
  view.innerHTML = '<div class="skeleton" style="height:32px;width:30%"></div><div class="skeleton" style="height:240px;margin-top:24px"></div>';
  document.title = `${NAV.find(([k]) => k === key)?.[1] || 'Command Center'} · CNM Group OS`;
  try { await (VIEWS[key] || VIEWS.command)(view, arg); } catch (x) { view.innerHTML = `<p class="alert alert--err">${e(x.message)}</p>`; }
}

const VIEWS = {
  command: (v) => command(v, { me }),
  orders: (v, number) => (number ? orderPage(v, number, { me, flash }) : ordersView(v, { me, flash })),
  fulfilment: (v) => fulfilmentView(v, { me, flash }),
  'new-order': (v) => newOrderView(v, { me, flash }),
  invoice: (v, number) => invoiceView(v, number),
  slips: (v, list) => slipsView(v, list.split(',').filter(Boolean)),
  'ops-settings': (v) => opsSettingsView(v, { me, flash }),
  companies: (v) => companiesView(v, { me }, flash),
  audit: (v) => auditView(v),

  async customers(v) {
    const { customers } = await api('/api/admin/customers', { loader: false });
    v.innerHTML = `<h1 class="h2">Customers</h1><div class="card-a"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th><th>Marketing</th></tr></thead><tbody>${customers.map((c) => `<tr><td>${e(c.name)}</td><td>${e(c.email)}</td><td>${formatDate(c.createdAt)}</td><td>${c.orders}</td><td>${c.marketing ? 'Opted in' : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No customers yet.</td></tr>'}</tbody></table></div>`;
  },

  async inventory(v) {
    const { products } = await api('/api/admin/inventory', { loader: false });
    v.innerHTML = `<h1 class="h2">Products &amp; inventory</h1><p class="muted">Base values come from the catalogue (<code>content/products.json</code>). Overrides here apply live to prices and stock and are baked into pages on the next publish. Tick “Price approved” only when CNM has confirmed the price. Until then it is labelled as a demo price and kept out of Google Shopping.</p>
    <form data-inv><div class="card-a" style="overflow-x:auto"><table class="table"><thead><tr><th>Product</th><th>Price ₦</th><th>Compare at ₦</th><th>Stock</th><th>Available</th><th>Price approved</th><th>Details</th></tr></thead><tbody>${products.map((p) => {
      const o = p.override || {};
      return `<tr data-id="${p.id}"><td><strong>${e(p.name)}</strong><br><span class="muted" style="font-size:.75rem">${e(p.id)}</span></td>
      <td><input class="in" name="price" type="number" min="0" value="${o.price ?? ''}" placeholder="${p.base.price ?? ''}"></td>
      <td><input class="in" name="compareAt" type="number" min="0" value="${o.compareAt ?? ''}"></td>
      <td><input class="in" name="stock" type="number" min="0" value="${o.stock ?? ''}" placeholder="${p.base.stock ?? ''}"></td>
      <td><input name="available" type="checkbox"${o.available === false ? '' : ' checked'}></td>
      <td><input name="priceApproved" type="checkbox"${o.priceApproved ? ' checked' : ''}></td>
      <td><details><summary class="textlink">Edit</summary><div class="form" style="min-width:320px;margin-top:8px">
        <label class="field"><span class="field-label">Description (CNM-approved copy only)</span><textarea name="description">${e(o.description || '')}</textarea></label>
        <label class="field"><span class="field-label">Images (one per line: URL | alt text)</span><textarea name="images" placeholder="/api/media/123-photo.jpg | Stoneglow reed diffuser on marble">${e((o.images || []).map((i) => `${i.src} | ${i.alt}`).join('\n'))}</textarea></label>
        <label class="field"><span class="field-label">SEO title (≤70)</span><input name="seoTitle" maxlength="70" value="${e(o.seo?.title || '')}"></label>
        <label class="field"><span class="field-label">Meta description (≤160)</span><input name="seoDescription" maxlength="160" value="${e(o.seo?.description || '')}"></label>
      </div></details></td></tr>`;
    }).join('')}</tbody></table></div><button class="btn btn--green" type="submit">Save inventory</button></form>`;
    v.querySelector('[data-inv]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const body = { products: {} };
      v.querySelectorAll('tr[data-id]').forEach((tr) => {
        const g = (n) => tr.querySelector(`[name="${n}"]`);
        body.products[tr.dataset.id] = {
          price: g('price').value, compareAt: g('compareAt').value, stock: g('stock').value, available: g('available').checked, priceApproved: g('priceApproved').checked,
          description: g('description').value,
          images: g('images').value.split('\n').map((l) => l.split('|').map((s) => s.trim())).filter(([s]) => s).map(([src, alt]) => ({ src, alt: alt || '' })),
          seo: { title: g('seoTitle').value, description: g('seoDescription').value },
        };
      });
      try { await api('/api/admin/inventory', { method: 'PUT', body }); flash('Inventory saved. Prices and stock are live; publish to update page content.'); } catch (x) { flash(x.message, false); }
    });
  },

  async discounts(v) {
    const { discounts } = await api('/api/admin/discounts', { loader: false });
    const row = (d = {}) => `<tr><td><input class="in" name="code" value="${e(d.code || '')}" required></td><td><select name="type"><option value="percent"${d.type === 'percent' ? ' selected' : ''}>% off</option><option value="fixed"${d.type === 'fixed' ? ' selected' : ''}>₦ off</option></select></td><td><input class="in" name="value" type="number" min="0" value="${d.value ?? ''}"></td><td><input class="in" name="minSubtotal" type="number" min="0" value="${d.minSubtotal ?? 0}"></td><td><input type="checkbox" name="active"${d.active !== false ? ' checked' : ''}></td><td><input class="in" name="note" value="${e(d.note || '')}"></td><td><button class="textlink" type="button" data-del>Remove</button></td></tr>`;
    v.innerHTML = `<h1 class="h2">Discounts &amp; promotions</h1><form data-disc><div class="card-a" style="overflow-x:auto"><table class="table"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min subtotal ₦</th><th>Active</th><th>Note</th><th></th></tr></thead><tbody>${discounts.map(row).join('')}</tbody></table></div>
    <div style="display:flex;gap:10px"><button class="btn btn--ghost" type="button" data-add>Add code</button><button class="btn btn--green" type="submit">Save discounts</button></div></form>`;
    const tbody = v.querySelector('tbody');
    v.querySelector('[data-add]').addEventListener('click', () => tbody.insertAdjacentHTML('beforeend', row()));
    tbody.addEventListener('click', (ev) => ev.target.closest('[data-del]')?.closest('tr').remove());
    v.querySelector('[data-disc]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const list = [...tbody.querySelectorAll('tr')].map((tr) => ({ code: tr.querySelector('[name=code]').value, type: tr.querySelector('[name=type]').value, value: Number(tr.querySelector('[name=value]').value), minSubtotal: Number(tr.querySelector('[name=minSubtotal]').value), active: tr.querySelector('[name=active]').checked, note: tr.querySelector('[name=note]').value }));
      try { await api('/api/admin/discounts', { method: 'PUT', body: { discounts: list } }); flash('Discounts saved and live.'); } catch (x) { flash(x.message, false); }
    });
  },

  async content(v) {
    const [{ value: home }, { value: ann }] = await Promise.all([api('/api/admin/content/homepage', { loader: false }), api('/api/admin/content/announcements', { loader: false })]);
    const h = home || {};
    v.innerHTML = `<h1 class="h2">Content &amp; merchandising</h1>
    <form class="card-a form" data-home style="max-width:720px"><h2 class="label">Homepage hero</h2>
      <label class="field"><span class="field-label">Eyebrow</span><input name="tagline" value="${e(h.tagline || '')}" placeholder="The art of atmosphere"></label>
      <label class="field"><span class="field-label">Headline</span><input name="heroHeadline" value="${e(h.heroHeadline || '')}" placeholder="Scent your space."></label>
      <label class="field"><span class="field-label">Lead</span><input name="heroLead" value="${e(h.heroLead || '')}"></label>
      <label class="field"><span class="field-label">Campaign video URL (optional)</span><input name="heroVideo" value="${e(h.heroVideo || '')}" placeholder="/api/media/…mp4"></label>
      <label class="field"><span class="field-label">Featured product IDs (comma separated, in order)</span><input name="featured" value="${e((h.featured || []).join(', '))}"></label>
      <button class="btn btn--green" type="submit" style="justify-self:start">Save homepage</button></form>
    <form class="card-a form" data-ann style="max-width:720px"><h2 class="label">Announcement bar</h2>
      <label class="field"><span class="field-label">Message (leave empty to hide)</span><input name="message" value="${e(ann?.message || '')}"></label>
      <label class="field"><span class="field-label">Link</span><input name="href" value="${e(ann?.href || '')}"></label>
      <button class="btn btn--green" type="submit" style="justify-self:start">Save announcement</button></form>
    <p class="muted">Editorial articles live in <code>content/articles/*.md</code> (versioned in Git). Changes here go live after <strong>Publish site</strong>.</p>`;
    const save = (key, f, map) => f.addEventListener('submit', async (ev) => { ev.preventDefault(); try { await api(`/api/admin/content/${key}`, { method: 'PUT', body: map(Object.fromEntries(new FormData(f))) }); flash('Saved. Publish to make it live.'); } catch (x) { flash(x.message, false); } });
    save('homepage', v.querySelector('[data-home]'), (o) => ({ ...o, featured: o.featured.split(',').map((s) => s.trim()).filter(Boolean) }));
    save('announcements', v.querySelector('[data-ann]'), (o) => o);
  },

  async stores(v) {
    const { value } = await api('/api/admin/content/stores', { loader: false });
    const base = await fetch('/catalogue.json').then(() => null).catch(() => null);
    const stores = value?.stores || [{ slug: 'lagos', city: 'Lagos', region: 'Lagos' }, { slug: 'abuja', city: 'Abuja', region: 'FCT' }];
    v.innerHTML = `<h1 class="h2">Stores</h1><p class="muted">Name, address and phone must match the Google Business Profile exactly (NAP consistency). Tick “Verified” only once confirmed. That enables LocalBusiness structured data and the map.</p>
    <form data-stores>${stores.map((s, i) => `<fieldset class="card-a form" data-i="${i}" style="max-width:720px"><legend class="label">${e(s.city)}</legend>
      <input type="hidden" name="slug" value="${e(s.slug)}"><input type="hidden" name="city" value="${e(s.city)}"><input type="hidden" name="region" value="${e(s.region || '')}">
      <label class="field"><span class="field-label">Store name</span><input name="name" value="${e(s.name || `CNM Essentials ${s.city}`)}"></label>
      <label class="field"><span class="field-label">Street address</span><input name="address" value="${e(s.address || '')}"></label>
      <div class="form-row"><label class="field"><span class="field-label">Phone</span><input name="phone" value="${e(s.phone || '')}"></label><label class="field"><span class="field-label">Email</span><input name="email" value="${e(s.email || '')}"></label></div>
      <div class="form-row"><label class="field"><span class="field-label">Latitude</span><input name="lat" value="${e(s.geo?.lat || '')}"></label><label class="field"><span class="field-label">Longitude</span><input name="lng" value="${e(s.geo?.lng || '')}"></label></div>
      <label class="field"><span class="field-label">Opening hours (one per line: Days | open | close | schema e.g. Mo-Fr)</span><textarea name="hours">${e((s.hours || []).map((h) => `${h.days} | ${h.open} | ${h.close} | ${h.schema}`).join('\n'))}</textarea></label>
      <label class="field"><span class="field-label">Photo URLs (one per line: URL | alt)</span><textarea name="images">${e((s.images || []).map((m) => `${m.src} | ${m.alt}`).join('\n'))}</textarea></label>
      <label class="check"><input type="checkbox" name="verified"${s.verified ? ' checked' : ''}> Verified by CNM</label></fieldset>`).join('')}
      <button class="btn btn--green" type="submit">Save stores</button></form>`;
    void base;
    v.querySelector('[data-stores]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const lines = (t) => t.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0]);
      const out = [...v.querySelectorAll('fieldset')].map((fs) => {
        const g = (n) => fs.querySelector(`[name="${n}"]`);
        return {
          slug: g('slug').value, city: g('city').value, region: g('region').value, country: 'NG', name: g('name').value, address: g('address').value || null, phone: g('phone').value || null, email: g('email').value || null,
          geo: g('lat').value && g('lng').value ? { lat: Number(g('lat').value), lng: Number(g('lng').value) } : null,
          hours: lines(g('hours').value).map(([days, open, close, schema]) => ({ days, open, close, schema })), images: lines(g('images').value).map(([src, alt]) => ({ src, alt })),
          services: ['In-store shopping', 'Collect in store', 'Fragrance as a Service consultations'], verified: g('verified').checked, mapQuery: `CNM Essentials ${g('city').value}`,
        };
      });
      try { await api('/api/admin/content/stores', { method: 'PUT', body: { stores: out } }); flash('Stores saved. Publish to update store pages.'); } catch (x) { flash(x.message, false); }
    });
  },

  async seo(v) {
    const [{ value: seo }, { value: red }] = await Promise.all([api('/api/admin/content/seo', { loader: false }), api('/api/admin/content/redirects', { loader: false })]);
    v.innerHTML = `<h1 class="h2">SEO &amp; redirects</h1>
    <form class="card-a form" data-seo><h2 class="label">Page metadata overrides</h2><p class="muted">One per line: <code>/path/ | Title | Meta description</code></p><textarea class="mono" name="pages" rows="8">${e(Object.entries(seo?.pages || {}).map(([p, m]) => `${p} | ${m.title || ''} | ${m.description || ''}`).join('\n'))}</textarea><button class="btn btn--green" type="submit" style="justify-self:start">Save metadata</button></form>
    <form class="card-a form" data-red><h2 class="label">Redirects</h2><p class="muted">One per line: <code>/old-path /new-path 301</code>. Use when URLs change to protect rankings.</p><textarea class="mono" name="rules" rows="8">${e((red?.redirects || []).map((r) => `${r.from} ${r.to} ${r.status}`).join('\n'))}</textarea><button class="btn btn--green" type="submit" style="justify-self:start">Save redirects</button></form>
    <div class="card-a"><h2 class="label">Search infrastructure</h2><ul><li><a class="textlink" href="/sitemap.xml" target="_blank">sitemap.xml</a></li><li><a class="textlink" href="/robots.txt" target="_blank">robots.txt</a></li><li><a class="textlink" href="/feeds/google-merchant.xml" target="_blank">Google Merchant feed</a> (only approved products)</li></ul></div>`;
    v.querySelector('[data-seo]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const pages = {};
      ev.currentTarget.pages.value.split('\n').map((l) => l.split('|').map((s) => s.trim())).filter(([p]) => p?.startsWith('/')).forEach(([p, title, description]) => { pages[p] = { title, description }; });
      try { await api('/api/admin/content/seo', { method: 'PUT', body: { pages } }); flash('Saved. Publish to apply.'); } catch (x) { flash(x.message, false); }
    });
    v.querySelector('[data-red]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const redirects = ev.currentTarget.rules.value.split('\n').map((l) => l.trim().split(/\s+/)).filter(([f, t]) => f?.startsWith('/') && t).map(([from, to, status]) => ({ from, to, status: Number(status) || 301 }));
      try { await api('/api/admin/content/redirects', { method: 'PUT', body: { redirects } }); flash('Saved. Publish to apply.'); } catch (x) { flash(x.message, false); }
    });
  },

  async enquiries(v) {
    const { enquiries } = await api('/api/admin/enquiries', { loader: false });
    v.innerHTML = `<h1 class="h2">Service enquiries</h1>${enquiries.map((q) => `<div class="card-a"><div class="row-a"><strong>${e(q.name)}${q.company ? ` · ${e(q.company)}` : ''}</strong><span>${formatDate(q.createdAt)}</span></div>
      <p class="muted">${e(q.sector === 'group' ? `CNM Group${q.division && q.division !== 'group' ? ` · ${q.division}` : ''} · ${q.subject || 'General Enquiry'}` : q.sector)}${q.interest ? ` · ${e(q.interest)}` : ''}${q.timeline ? ` · ${e(q.timeline)}` : ''}${q.company ? ` · ${e(q.company)}` : ''}${q.eventDate ? ` · ${e(q.eventDate)}` : ''}${q.location ? ` · ${e(q.location)}` : ''} · <a class="textlink" href="mailto:${e(q.email)}">${e(q.email)}</a>${q.phone ? ` · ${e(q.phone)}` : ''}</p><p>${e(q.message)}</p>
      <label>Status <select data-enq="${e(q.id)}">${['new', 'contacted', 'quoted', 'won', 'lost'].map((s) => `<option${s === q.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label></div>`).join('') || '<p class="muted">No enquiries yet.</p>'}`;
    v.addEventListener('change', async (ev) => { const s = ev.target.closest('[data-enq]'); if (!s) return; try { await api(`/api/admin/enquiries/${s.dataset.enq}`, { method: 'PATCH', body: { status: s.value } }); flash('Enquiry updated'); } catch (x) { flash(x.message, false); } });
  },

  async subscribers(v) {
    const { subscribers, backInStock } = await api('/api/admin/subscribers', { loader: false });
    const csv = 'email,source,consent_at\n' + subscribers.map((s) => `${s.email},${s.source},${s.consentAt}`).join('\n');
    v.innerHTML = `<h1 class="h2">Subscribers</h1><a class="btn btn--ghost" download="cnm-subscribers.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}">Export CSV</a>
    <div class="card-a"><table class="table"><thead><tr><th>Email</th><th>Source</th><th>Consent</th></tr></thead><tbody>${subscribers.map((s) => `<tr><td>${e(s.email)}</td><td>${e(s.source)}</td><td>${formatDate(s.consentAt)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">None yet.</td></tr>'}</tbody></table></div>
    <div class="card-a"><h2 class="label">Back-in-stock requests</h2><table class="table"><tbody>${backInStock.map((b) => `<tr><td>${e(b.productId)}</td><td>${e(b.email)}</td><td>${formatDate(b.createdAt)}</td></tr>`).join('') || '<tr><td class="muted">None yet.</td></tr>'}</tbody></table></div>`;
  },

  async media(v) {
    const { media } = await api('/api/admin/media', { loader: false });
    v.innerHTML = `<h1 class="h2">Media</h1><p class="muted">Upload original CNM photography, logo and campaign video (max 4 MB per file). Copy the URL into a product, store or homepage field.</p>
    <form class="card-a form" data-up><input type="file" name="file" accept="image/*,video/mp4" required><button class="btn btn--green" type="submit" style="justify-self:start">Upload</button></form>
    <div class="media-grid">${media.map((m) => `<figure><img src="${m.url}" alt="" loading="lazy"><figcaption><input class="in mono" readonly value="${e(m.url)}" onfocus="this.select()"></figcaption></figure>`).join('') || '<p class="muted">No media uploaded yet.</p>'}</div>`;
    v.querySelector('[data-up]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const file = ev.currentTarget.file.files[0];
      if (!file || file.size > 4 * 1024 * 1024) { flash('Choose a file under 4 MB.', false); return; }
      const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
      try { await api('/api/admin/media', { method: 'POST', body: { name: file.name, type: file.type, data } }); flash('Uploaded'); route(); } catch (x) { flash(x.message, false); }
    });
  },

  async analytics(v) {
    const a = await api('/api/admin/analytics', { loader: false });
    const max = Math.max(1, ...a.funnel.map((f) => f.count));
    const labels = { view_item: 'Viewed product', add_to_cart: 'Added to bag', begin_checkout: 'Started checkout', add_payment_info: 'Reached payment', purchase: 'Purchased' };
    v.innerHTML = `<h1 class="h2">Analytics</h1><p class="muted">First-party, cookie-less event counts (last 30 days). Full reporting lives in Google Analytics 4 once <code>GA_MEASUREMENT_ID</code> is set.</p>
    <div class="card-a"><h2 class="label">Conversion funnel</h2>${a.funnel.map((f, i) => `<div class="funnel-row"><span>${labels[f.step]}</span><div class="funnel-track"><span style="width:${(f.count / max) * 100}%"></span></div><strong>${f.count}</strong><span class="muted">${i && a.funnel[i - 1].count ? `${Math.round((f.count / a.funnel[i - 1].count) * 100)}%` : ''}</span></div>`).join('')}</div>
    <div class="admin-grid"><div class="card-a"><h2 class="label">Top searches</h2><table class="table"><tbody>${a.topSearches.map(([t, n]) => `<tr><td>${e(t)}</td><td>${n}</td></tr>`).join('') || '<tr><td class="muted">No data yet.</td></tr>'}</tbody></table></div>
    <div class="card-a"><h2 class="label">Zero-result searches</h2><p class="muted" style="font-size:.75rem">Demand signals for products or content.</p><table class="table"><tbody>${a.zeroResultSearches.map(([t, n]) => `<tr><td>${e(t)}</td><td>${n}</td></tr>`).join('') || '<tr><td class="muted">None.</td></tr>'}</tbody></table></div></div>
    <div class="card-a"><h2 class="label">All events</h2><table class="table"><tbody>${Object.entries(a.totals).sort((x, y) => y[1] - x[1]).map(([k, n]) => `<tr><td>${e(k)}</td><td>${n}</td></tr>`).join('') || '<tr><td class="muted">No events yet.</td></tr>'}</tbody></table></div>`;
  },

  async users(v) {
    const [{ users, roles, stagingBootstrap }, { entries }] = await Promise.all([api('/api/admin/users', { loader: false }), api('/api/admin/audit', { loader: false })]);
    const perms = [...new Set(Object.values(roles).flat())];
    v.innerHTML = `<h1 class="h2">Users &amp; roles</h1><p class="muted">Admin accounts are managed with the <code>ADMIN_USERS</code> environment variable (see DEPLOYMENT.md). This keeps credentials out of the database and the browser.</p>
    ${stagingBootstrap ? '<p class="alert">The staging bootstrap owner is enabled. Remove <code>ADMIN_STAGING_PASSWORD</code> before launch.</p>' : ''}
    <div class="card-a"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>${users.map((u) => `<tr><td>${e(u.name || '')}</td><td>${e(u.email)}</td><td>${pill(u.role)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No admin users configured.</td></tr>'}</tbody></table></div>
    <div class="card-a" style="overflow-x:auto"><h2 class="label">Permission matrix</h2><table class="table"><thead><tr><th>Area</th>${Object.keys(roles).map((r) => `<th>${r}</th>`).join('')}</tr></thead><tbody>${perms.map((p) => `<tr><td>${p}</td>${Object.values(roles).map((list) => `<td>${list.includes(p) ? '✓' : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="card-a"><h2 class="label">Audit log</h2><table class="table"><tbody>${entries.map((x) => `<tr><td>${e(x.at.replace('T', ' ').slice(0, 19))}</td><td>${e(x.admin)}</td><td>${e(x.action)}</td><td class="muted">${e(JSON.stringify(x.detail))}</td></tr>`).join('') || '<tr><td class="muted">No activity yet.</td></tr>'}</tbody></table></div>`;
  },
};

boot();

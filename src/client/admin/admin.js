// CNM Admin — operations back office (single-page, role-aware). All authorisation is enforced server-side.
import { escapeHtml as e, formatDate, formatMoney } from '../../shared/format.mjs';
import { api } from '../api.js';

const root = document.querySelector('[data-admin]');
let me = null;

const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'], ['orders', 'Orders', 'orders'], ['customers', 'Customers', 'customers'],
  ['inventory', 'Products & inventory', 'inventory'], ['discounts', 'Discounts & promotions', 'discounts'],
  ['content', 'Content & merchandising', 'content'], ['stores', 'Stores', 'content'], ['seo', 'SEO & redirects', 'content'],
  ['enquiries', 'Service enquiries', 'enquiries'], ['subscribers', 'Subscribers', 'subscribers'], ['media', 'Media', 'media'],
  ['analytics', 'Analytics', 'analytics'], ['users', 'Users & roles', 'users'],
];
const pill = (s) => `<span class="pill pill--${e(s)}">${e(String(s).replace(/_/g, ' '))}</span>`;
const flash = (msg, ok = true) => { const f = document.querySelector('[data-flash]'); f.className = `alert ${ok ? 'alert--ok' : 'alert--err'}`; f.textContent = msg; f.hidden = false; setTimeout(() => { f.hidden = true; }, 3500); };

async function boot() {
  try { ({ admin: me } = await api('/api/admin/me', { loader: false })); shell(); route(); } catch { login(); }
}

function login(err = '') {
  root.innerHTML = `<div class="admin-login"><div class="stack">${document.body.dataset.logo ? `<img src="${document.body.dataset.logo}" alt="CNM Essentials" style="height:32px">` : '<p class="label">CNM Essentials</p>'}<h1 class="h2">Admin sign in</h1>
  ${err ? `<p class="alert alert--err">${e(err)}</p>` : ''}
  <form class="form" data-login novalidate><div class="field"><label for="ae">Email</label><input id="ae" name="email" type="email" autocomplete="username" required></div>
  <div class="field"><label for="ap">Password</label><input id="ap" name="password" type="password" autocomplete="current-password" required></div>
  <button class="btn btn--green" type="submit">Sign in</button></form>
  <p class="muted" style="font-size:.75rem">Access is restricted to CNM staff. Activity is audited.</p></div></div>`;
  root.querySelector('[data-login]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    try { ({ admin: me } = await api('/api/admin/login', { method: 'POST', body: { email: f.email.value.trim(), password: f.password.value } })); shell(); route(); } catch (x) { login(x.message); }
  });
}

function shell() {
  root.innerHTML = `<div class="admin">
    <aside class="admin__nav"><a class="admin__brand" href="/admin/">${document.body.dataset.logo ? `<img src="${document.body.dataset.logo}" alt="CNM Essentials" style="height:26px;filter:brightness(0) invert(.95)">` : 'CNM'} <span>Admin</span></a>
      <nav>${NAV.filter(([, , p]) => me.permissions.includes(p)).map(([k, l]) => `<a href="#${k}" data-nav="${k}">${l}</a>`).join('')}</nav>
      <div class="admin__me"><span>${e(me.name)}</span><span class="pill">${e(me.role)}</span>${me.permissions.includes('publish') ? '<button class="btn btn--light" type="button" data-publish>Publish site</button>' : ''}<a class="textlink" href="/" target="_blank">View store</a><button class="textlink" type="button" data-logout>Sign out</button></div>
    </aside>
    <main class="admin__main"><div class="alert" data-flash hidden></div><div data-view></div></main></div>`;
  root.querySelector('[data-logout]').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); });
  root.querySelector('[data-publish]')?.addEventListener('click', async () => {
    if (!confirm('Rebuild and publish the site with the latest content?')) return;
    try { await api('/api/admin/publish', { method: 'POST' }); flash('Publishing started. Changes go live in a few minutes.'); } catch (x) { flash(x.message, false); }
  });
  window.addEventListener('hashchange', route);
}

async function route() {
  const key = location.hash.slice(1).split(/[/?]/)[0] || 'dashboard';
  const arg = decodeURIComponent(location.hash.split('?')[0].split('/')[1] || '');
  root.querySelectorAll('[data-nav]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.nav === key)));
  const view = root.querySelector('[data-view]');
  view.innerHTML = '<div class="skeleton" style="height:32px;width:30%"></div><div class="skeleton" style="height:240px;margin-top:24px"></div>';
  try { await (VIEWS[key] || VIEWS.dashboard)(view, arg); } catch (x) { view.innerHTML = `<p class="alert alert--err">${e(x.message)}</p>`; }
}

/* ---------- charts: single-series bars, brand green, tooltip on hover, table fallback ---------- */
function barChart(series, { valueKey, label, fmt = (n) => n }) {
  const max = Math.max(1, ...series.map((d) => d[valueKey]));
  return `<figure class="chart"><figcaption class="label">${e(label)}</figcaption>
  <div class="chart__plot" role="img" aria-label="${e(label)}">${series.map((d) => `<div class="chart__col" tabindex="0"><span class="chart__bar" style="height:${Math.max(2, (d[valueKey] / max) * 100)}%"></span><span class="chart__tip">${e(formatDate(d.date))}<br><strong>${e(fmt(d[valueKey]))}</strong></span></div>`).join('')}</div>
  <div class="chart__axis"><span>${e(formatDate(series[0].date))}</span><span>${e(formatDate(series.at(-1).date))}</span></div>
  <details><summary class="textlink" style="font-size:.75rem">View as table</summary><table class="table"><thead><tr><th>Date</th><th>${e(label)}</th></tr></thead><tbody>${series.map((d) => `<tr><td>${e(d.date)}</td><td>${e(fmt(d[valueKey]))}</td></tr>`).join('')}</tbody></table></details></figure>`;
}

const VIEWS = {
  async dashboard(v) {
    const d = await api('/api/admin/dashboard', { loader: false });
    const k = d.kpis;
    v.innerHTML = `<h1 class="h2">Dashboard</h1>
    <div class="kpis">${[['Revenue (paid)', formatMoney(k.revenue)], ['Paid orders', k.orders], ['Average order', formatMoney(k.aov)], ['To fulfil', k.awaitingFulfilment], ['Awaiting payment', k.pendingPayment], ['New enquiries', k.newEnquiries], ['Subscribers', k.subscribers]].map(([l, n]) => `<div class="kpi"><span class="label muted">${l}</span><strong>${n}</strong></div>`).join('')}</div>
    <div class="admin-grid"><div class="card-a">${barChart(d.series, { valueKey: 'revenue', label: 'Revenue per day — last 14 days', fmt: formatMoney })}</div>
    <div class="card-a"><h2 class="label">Low stock</h2>${d.lowStock.length ? `<ul>${d.lowStock.map((p) => `<li class="row-a"><span>${e(p.name)}</span><strong class="${p.stock === 0 ? 'stock-out' : 'stock-low'}">${p.stock}</strong></li>`).join('')}</ul>` : '<p class="muted">All products healthy.</p>'}</div></div>
    <div class="card-a"><h2 class="label">Recent orders</h2>${ordersTable(d.recentOrders)}</div>`;
  },

  async orders(v, number) {
    if (number) return orderDetail(v, number);
    const status = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || '';
    const { orders } = await api(`/api/admin/orders${status ? `?status=${status}` : ''}`, { loader: false });
    v.innerHTML = `<h1 class="h2">Orders</h1><div class="search-chips" style="margin:16px 0">${['', 'pending_payment', 'paid', 'processing', 'dispatched', 'delivered', 'payment_failed', 'cancelled', 'refunded'].map((s) => `<a class="chip" href="#orders?status=${s}"${s === status ? ' aria-pressed="true"' : ''}>${s ? s.replace(/_/g, ' ') : 'All'}</a>`).join('')}</div><div class="card-a">${ordersTable(orders)}</div>`;
  },

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
      <p class="muted">${e(q.sector === 'group' ? `CNM Group · ${q.subject || 'General Enquiry'}` : q.sector)}${q.eventDate ? ` · ${e(q.eventDate)}` : ''}${q.location ? ` · ${e(q.location)}` : ''} · <a class="textlink" href="mailto:${e(q.email)}">${e(q.email)}</a>${q.phone ? ` · ${e(q.phone)}` : ''}</p><p>${e(q.message)}</p>
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

function ordersTable(orders) {
  return `<table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>${orders.map((o) => `<tr><td><a class="textlink" href="#orders/${encodeURIComponent(o.number)}">${e(o.number)}</a></td><td>${e(o.customer)}</td><td>${formatDate(o.createdAt)}</td><td>${pill(o.status)}</td><td>${formatMoney(o.total)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No orders yet.</td></tr>'}</tbody></table>`;
}

async function orderDetail(v, number) {
  const { order: o, transitions } = await api(`/api/admin/orders/${encodeURIComponent(number)}`, { loader: false });
  v.innerHTML = `<a class="textlink" href="#orders">← Orders</a><h1 class="h2">${e(o.number)} ${pill(o.status)}</h1>
  <div class="admin-grid"><div class="card-a"><h2 class="label">Items</h2><table class="table"><tbody>${o.lines.map((l) => `<tr><td>${e(l.name)}</td><td>× ${l.qty}</td><td>${formatMoney(l.lineTotal)}</td></tr>`).join('')}
    <tr><td>Subtotal</td><td></td><td>${formatMoney(o.totals.subtotal)}</td></tr>${o.totals.discount ? `<tr><td>Discount (${e(o.promoCode)})</td><td></td><td>−${formatMoney(o.totals.discount)}</td></tr>` : ''}<tr><td>Delivery</td><td></td><td>${formatMoney(o.totals.delivery)}</td></tr><tr><td><strong>Total</strong></td><td></td><td><strong>${formatMoney(o.totals.total)}</strong></td></tr></tbody></table></div>
  <div class="card-a"><h2 class="label">Customer</h2><p>${e(o.contact.firstName)} ${e(o.contact.lastName)}<br><a class="textlink" href="mailto:${e(o.contact.email)}">${e(o.contact.email)}</a><br>${e(o.contact.phone)}</p>
    <h2 class="label">Delivery</h2><p>${e(o.delivery.label)}<br>${o.delivery.address ? `${e(o.delivery.address.line1)}${o.delivery.address.line2 ? `, ${e(o.delivery.address.line2)}` : ''}<br>${e(o.delivery.address.city)}, ${e(o.delivery.address.state)}` : `Collect: ${e(o.delivery.storeSlug)}`}</p>${o.notes ? `<p class="muted">Note: ${e(o.notes)}</p>` : ''}
    <h2 class="label">Payment</h2><p>${e(o.payment.provider)} · ${e(o.payment.status)}<br><span class="muted mono">${e(o.payment.reference)}</span></p></div></div>
  ${transitions.length ? `<form class="card-a form" data-status style="max-width:520px"><h2 class="label">Update status</h2><select name="status">${transitions.map((t) => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`).join('')}</select><input class="in" name="note" placeholder="Note (optional, e.g. courier & tracking number)"><button class="btn btn--green" type="submit" style="justify-self:start">Update &amp; notify customer</button></form>` : ''}
  <div class="card-a"><h2 class="label">History</h2><ul>${o.history.map((h) => `<li class="row-a"><span>${pill(h.status)} ${e(h.note || '')}</span><span class="muted">${e(h.by || '')} · ${formatDate(h.at)}</span></li>`).join('')}</ul></div>`;
  v.querySelector('[data-status]')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await api(`/api/admin/orders/${encodeURIComponent(o.number)}`, { method: 'PATCH', body: { status: ev.currentTarget.status.value, note: ev.currentTarget.note.value } }); flash('Status updated; customer notified.'); route(); } catch (x) { flash(x.message, false); }
  });
}

boot();

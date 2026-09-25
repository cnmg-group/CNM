// Predictive search overlay + shared search helpers.
import { escapeHtml, formatMoney } from '../shared/format.mjs';
import { buildIndex, highlight, search } from '../shared/search.mjs';
import { track } from './analytics.js';

const RECENT_KEY = 'cnm.searches';
export const POPULAR = ['Diffuser oil', 'Reed diffuser', 'Scent machine', 'Refill oil', 'Body butter', 'Car diffuser'];
const TYPE_LABEL = { product: 'Product', category: 'Category', collection: 'Collection', article: 'Journal', service: 'Service', store: 'Store' };

let indexPromise;
export const loadIndex = () => (indexPromise ||= fetch('/search-index.json').then((r) => r.json()).then(buildIndex));

export const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
export function remember(q) {
  const v = q.trim();
  if (!v) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([v, ...recent().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6))); } catch { /* ignore */ }
}

export function resultsHTML(results, q, { limit = 8 } = {}) {
  const products = results.filter((r) => r.type === 'product').slice(0, limit);
  const others = results.filter((r) => r.type !== 'product').slice(0, 6);
  const opt = (r, inner) => `<li><a role="option" href="${r.url}" data-search-hit="${escapeHtml(r.type)}">${inner}</a></li>`;
  return `${products.length ? `<h3 class="label" style="margin-bottom:8px">Products</h3><ul class="suggest-list">${products.map((r) => opt(r, `<span style="display:flex;gap:14px;align-items:center"><img src="${r.image}" alt="" width="40" height="50" style="width:40px;height:50px;object-fit:cover;background:var(--cream)"><span>${highlight(escapeHtml(r.title), q)}</span></span><span class="muted">${r.price != null ? formatMoney(r.price) : ''}</span>`)).join('')}</ul>` : ''}
  ${others.length ? `<h3 class="label" style="margin:24px 0 8px">Categories, stories &amp; services</h3><ul class="suggest-list">${others.map((r) => opt(r, `<span>${highlight(escapeHtml(r.title), q)}</span><span class="suggest-type">${TYPE_LABEL[r.type]}</span>`)).join('')}</ul>` : ''}`;
}

export function zeroHTML(q, index) {
  const recs = index.filter((d) => d.type === 'product').slice(0, 4);
  return `<p class="h3" style="margin-bottom:8px">No results for “${escapeHtml(q)}”</p><p class="muted">Check the spelling or try a broader term. You might like:</p>
  <ul class="suggest-list">${recs.map((r) => `<li><a role="option" href="${r.url}">${escapeHtml(r.title)}<span class="muted">${r.price != null ? formatMoney(r.price) : ''}</span></a></li>`).join('')}</ul>`;
}

function asideHTML() {
  const r = recent();
  return `${r.length ? `<h3 class="label">Recent searches</h3><div class="search-chips" style="margin-bottom:24px">${r.map((x) => `<button class="chip" type="button" data-search-term="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}<button class="chip" type="button" data-search-clear>Clear</button></div>` : ''}
  <h3 class="label">Popular searches</h3><div class="search-chips">${POPULAR.map((x) => `<button class="chip" type="button" data-search-term="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div>`;
}

export async function initOverlay(panel) {
  const input = panel.querySelector('[data-search-input]');
  const results = panel.querySelector('[data-search-results]');
  const aside = panel.querySelector('[data-search-aside]');
  const form = panel.querySelector('[data-search-form]');
  aside.innerHTML = asideHTML();
  results.innerHTML = '<p class="muted">Start typing to search products, scents, services and stories.</p>';
  const index = await loadIndex();
  let t;
  const run = () => {
    const q = input.value.trim();
    input.setAttribute('aria-expanded', String(!!q));
    if (!q) { results.innerHTML = '<p class="muted">Start typing to search products, scents, services and stories.</p>'; return; }
    const hits = search(index, q, { limit: 20 });
    results.innerHTML = hits.length ? resultsHTML(hits, q) : zeroHTML(q, index);
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 60); });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    results.querySelector('[role="option"]')?.focus();
  });
  results.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const opts = [...results.querySelectorAll('[role="option"]')];
    const i = opts.indexOf(document.activeElement);
    e.preventDefault();
    if (e.key === 'ArrowDown') opts[Math.min(opts.length - 1, i + 1)]?.focus();
    else if (i <= 0) input.focus(); else opts[i - 1].focus();
  });
  panel.addEventListener('click', (e) => {
    const term = e.target.closest('[data-search-term]');
    if (term) { input.value = term.dataset.searchTerm; run(); input.focus(); }
    if (e.target.closest('[data-search-clear]')) { try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } aside.innerHTML = asideHTML(); }
    if (e.target.closest('[data-search-hit]')) { remember(input.value); track('search', { search_term: input.value.trim() }); }
  });
  form.addEventListener('submit', (e) => {
    const q = input.value.trim();
    if (!q) { e.preventDefault(); return; }
    remember(q);
  });
  if (input.value) run();
}

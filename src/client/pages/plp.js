// Listing filters & sorting: instant, no reloads, state mirrored to the URL so views are shareable and back/forward works.
import { escapeHtml } from '../../shared/format.mjs';
import { track } from '../analytics.js';
import * as S from '../store.js';

const MULTI = ['category', 'collection', 'type', 'scent'];
const FLAGS = ['instock', 'new', 'best'];

export async function init() {
  const root = document.querySelector('[data-plp]');
  const form = root.querySelector('[data-filter-form]');
  const grid = root.querySelector('[data-grid]');
  const sortSel = root.querySelector('[data-sort]');
  const empty = root.querySelector('[data-empty]');
  const chips = root.querySelector('[data-active-filters]');
  const sheet = root.querySelector('[data-filters]');
  const counts = document.querySelectorAll('[data-result-count]');
  const cards = grid ? [...grid.querySelectorAll('[data-product-card]')] : [];

  // Apply live price/stock (admin overrides) to facet data before filtering.
  S.catalogue().then(({ byId }) => cards.forEach((c) => {
    const p = byId.get(c.dataset.id);
    if (!p) return;
    if (p.price.amount != null) c.dataset.fPrice = p.price.amount;
    const q = p.stock?.quantity;
    c.dataset.fStock = p.available === false || q === 0 ? 'out' : q != null && q <= 5 ? 'low' : 'in';
  })).catch(() => {});

  const readState = () => {
    const s = { sort: sortSel.value };
    for (const k of MULTI) s[k] = [...form.querySelectorAll(`input[name="${k}"]:checked`)].map((i) => i.value);
    for (const k of FLAGS) s[k] = form.querySelector(`input[name="${k}"]`)?.checked || false;
    s.min = form.querySelector('input[name="min"]').value;
    s.max = form.querySelector('input[name="max"]').value;
    return s;
  };

  const writeUrl = (s) => {
    const u = new URL(location.href);
    u.search = '';
    for (const k of MULTI) s[k].forEach((v) => u.searchParams.append(k, v));
    for (const k of FLAGS) if (s[k]) u.searchParams.set(k, '1');
    if (s.min) u.searchParams.set('min', s.min);
    if (s.max) u.searchParams.set('max', s.max);
    if (s.sort !== 'featured') u.searchParams.set('sort', s.sort);
    history.replaceState(null, '', u);
  };

  const fromUrl = () => {
    const p = new URLSearchParams(location.search);
    for (const k of MULTI) p.getAll(k).forEach((v) => { const i = form.querySelector(`input[name="${k}"][value="${CSS.escape(v)}"]`); if (i) i.checked = true; });
    for (const k of FLAGS) { const i = form.querySelector(`input[name="${k}"]`); if (i) i.checked = p.get(k) === '1'; }
    form.querySelector('input[name="min"]').value = p.get('min') || '';
    form.querySelector('input[name="max"]').value = p.get('max') || '';
    if (p.get('sort')) sortSel.value = p.get('sort');
  };

  const matches = (c, s) => {
    const d = c.dataset;
    if (s.category.length && !s.category.includes(d.fCategory)) return false;
    if (s.collection.length && !s.collection.some((v) => d.fCollection.split(' ').includes(v))) return false;
    if (s.type.length && !s.type.includes(d.fType)) return false;
    if (s.scent.length && !s.scent.includes(d.fScent)) return false;
    if (s.instock && d.fStock === 'out') return false;
    if (s.new && d.fNew !== '1') return false;
    if (s.best && d.fBest !== '1') return false;
    const price = Number(d.fPrice);
    if (s.min && price < Number(s.min)) return false;
    if (s.max && price > Number(s.max)) return false;
    return true;
  };

  const SORTS = {
    featured: (a, b) => a.dataset.fOrder - b.dataset.fOrder,
    new: (a, b) => b.dataset.fNew - a.dataset.fNew || a.dataset.fOrder - b.dataset.fOrder,
    'price-asc': (a, b) => a.dataset.fPrice - b.dataset.fPrice,
    'price-desc': (a, b) => b.dataset.fPrice - a.dataset.fPrice,
    name: (a, b) => a.dataset.fName.localeCompare(b.dataset.fName),
  };

  const label = (k, v) => form.querySelector(`input[name="${k}"][value="${CSS.escape(v)}"]`)?.parentElement.textContent.replace(/\d+$/, '').trim() || v;

  const apply = ({ trackIt = false } = {}) => {
    const s = readState();
    let n = 0;
    const sorted = [...cards].sort(SORTS[s.sort] || SORTS.featured);
    for (const c of sorted) {
      const ok = matches(c, s);
      c.hidden = !ok;
      if (ok) n++;
      grid.appendChild(c);
    }
    counts.forEach((x) => { x.textContent = n; });
    if (empty) empty.hidden = n > 0;
    const active = [
      ...MULTI.flatMap((k) => s[k].map((v) => ({ k, v, text: label(k, v) }))),
      ...FLAGS.filter((k) => s[k]).map((k) => ({ k, v: '1', text: { instock: 'In stock', new: 'New arrivals', best: 'Best sellers' }[k] })),
      ...(s.min ? [{ k: 'min', v: s.min, text: `From ₦${Number(s.min).toLocaleString()}` }] : []),
      ...(s.max ? [{ k: 'max', v: s.max, text: `Up to ₦${Number(s.max).toLocaleString()}` }] : []),
    ];
    chips.innerHTML = active.map((a) => `<button class="chip" type="button" data-remove-filter="${a.k}" data-value="${escapeHtml(a.v)}" aria-label="Remove filter ${escapeHtml(a.text)}">${escapeHtml(a.text)} ×</button>`).join('') + (active.length ? '<button class="chip" type="button" data-filters-clear>Clear all</button>' : '');
    writeUrl(s);
    if (trackIt) track('filter_products', { list: root.dataset.list, filters: active.map((a) => `${a.k}:${a.v}`).join('|'), sort: s.sort, results: n });
  };

  if (!cards.length) return;
  fromUrl();
  apply();

  let t;
  form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => apply({ trackIt: true }), 120); });
  form.addEventListener('submit', (e) => e.preventDefault());
  sortSel.addEventListener('change', () => apply({ trackIt: true }));
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove-filter]');
    if (rm) {
      const { removeFilter: k, value: v } = rm.dataset;
      const i = k === 'min' || k === 'max' ? form.querySelector(`input[name="${k}"]`) : form.querySelector(`input[name="${k}"]${FLAGS.includes(k) ? '' : `[value="${CSS.escape(v)}"]`}`);
      if (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }
      apply({ trackIt: true });
    }
    if (e.target.closest('[data-filters-clear]')) { form.reset(); apply({ trackIt: true }); }
    if (e.target.closest('[data-filters-open]')) { sheet.classList.add('is-open'); document.querySelector('[data-scrim]').classList.add('is-on'); sheet.querySelector('summary')?.focus(); }
    if (e.target.closest('[data-filters-close]') || (e.target.matches('[data-scrim]') && sheet.classList.contains('is-open'))) { sheet.classList.remove('is-open'); document.querySelector('[data-scrim]').classList.remove('is-on'); }
  });
}

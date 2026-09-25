import { productCardHTML } from '../../shared/card.mjs';
import { escapeHtml } from '../../shared/format.mjs';
import { search } from '../../shared/search.mjs';
import { track } from '../analytics.js';
import { paintWish } from '../render.js';
import { loadIndex, POPULAR, remember, resultsHTML, zeroHTML } from '../search-ui.js';
import * as S from '../store.js';

export async function init() {
  const q = new URLSearchParams(location.search).get('q')?.trim() || '';
  const box = document.querySelector('[data-search-page-results]');
  const input = document.querySelector('#sq');
  input.value = q;
  const heading = document.querySelector('[data-search-heading]');
  if (!q) {
    box.innerHTML = `<h2 class="label">Popular searches</h2><div class="search-chips" style="margin-top:12px">${POPULAR.map((x) => `<a class="chip" href="/search/?q=${encodeURIComponent(x)}">${escapeHtml(x)}</a>`).join('')}</div>`;
    return;
  }
  heading.textContent = `Results for “${q}”`;
  document.title = `Search: ${q} | CNM Essentials`;
  const [index, { byId }] = await Promise.all([loadIndex(), S.catalogue()]);
  const hits = search(index, q, { limit: 60 });
  remember(q);
  track('search', { search_term: q, results: hits.length });
  if (!hits.length) { box.innerHTML = zeroHTML(q, index); return; }
  const products = hits.filter((h) => h.type === 'product').map((h) => byId.get(h.id)).filter(Boolean);
  const other = hits.filter((h) => h.type !== 'product');
  box.innerHTML = `${products.length ? `<p class="muted" style="margin-bottom:16px">${products.length} product${products.length === 1 ? '' : 's'}</p><div class="grid-products">${products.map((p, i) => productCardHTML(p, { position: i + 1, list: 'search_results' })).join('')}</div>` : ''}
    ${other.length ? `<div style="margin-top:64px;max-width:720px">${resultsHTML(other, q)}</div>` : ''}`;
  paintWish(box);
}

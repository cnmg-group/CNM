import { productCardHTML } from '../shared/card.mjs';
import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { stockState } from '../shared/product.mjs';
import { approval, breadcrumbs } from './layout.mjs';

function facetCounts(products, key) {
  const m = new Map();
  for (const p of products) for (const v of [].concat(p[key] ?? [])) if (v) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()];
}

function group(title, name, entries, labelFor, open = true) {
  if (!entries.length) return '';
  return `<details class="filter-group"${open ? ' open' : ''}><summary>${escapeHtml(title)}</summary><div class="opts">${entries
    .map(([v, n]) => `<label class="check"><input type="checkbox" name="${name}" value="${escapeHtml(v)}"> ${escapeHtml(labelFor(v))}<span class="n">${n}</span></label>`)
    .join('')}</div></details>`;
}

function cardWithFacets(p, i, list) {
  const s = stockState(p);
  const facets = `data-f-category="${p.category}" data-f-collection="${(p.collections || []).join(' ')}" data-f-type="${escapeHtml(p.productType)}" data-f-brand="${escapeHtml(p.brand)}" data-f-scent="${escapeHtml(p.scentFamily || '')}" data-f-price="${p.price.amount ?? ''}" data-f-stock="${s.key}" data-f-new="${p.isNew ? 1 : 0}" data-f-best="${p.isBestSeller ? 1 : 0}" data-f-name="${escapeHtml(p.name)}" data-f-order="${i}"`;
  return productCardHTML(p, { position: i + 1, list, eager: i < 4 }).replace('<article class="card"', `<article class="card" ${facets}`);
}

/**
 * Product listing page with client-side filtering (no reloads; state mirrored in the URL).
 */
export function listingPage(ctx, { title, intro, introStatus, products, trail, list, showCategoryFacet = true, tabs = true, current, extra = '', extraHead = '' }) {
  const { html: crumbs, ld } = breadcrumbs(ctx, trail);
  const catName = (slug) => ctx.categories.find((c) => c.slug === slug)?.name || slug;
  const colName = (slug) => ctx.collections.find((c) => c.slug === slug)?.name || slug;
  const prices = products.map((p) => p.price.amount).filter((n) => n != null);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;

  const filters = [
    showCategoryFacet ? group('Category', 'category', facetCounts(products, 'category'), catName) : '',
    group('Brand', 'brand', facetCounts(products, 'brand'), (v) => v),
    group('Collection', 'collection', facetCounts(products, 'collections'), colName),
    group('Product type', 'type', facetCounts(products, 'productType'), (v) => v),
    group('Scent family', 'scent', facetCounts(products, 'scentFamily'), (v) => v),
    `<details class="filter-group" open><summary>Price</summary><div class="opts"><div class="price-range">
      <label class="field"><span class="field-label">Min (₦)</span><input type="number" inputmode="numeric" name="min" min="0" placeholder="${min}"></label>
      <label class="field"><span class="field-label">Max (₦)</span><input type="number" inputmode="numeric" name="max" min="0" placeholder="${max}"></label></div></div></details>`,
    `<details class="filter-group" open><summary>Availability</summary><div class="opts">
      <label class="check"><input type="checkbox" name="instock" value="1"> In stock only</label>
      ${products.some((p) => p.isNew) ? '<label class="check"><input type="checkbox" name="new" value="1"> New arrivals</label>' : ''}
      ${products.some((p) => p.isBestSeller) ? '<label class="check"><input type="checkbox" name="best" value="1"> Best sellers</label>' : ''}</div></details>`,
  ].join('');

  const catTabs = tabs
    ? `<nav class="cat-tabs" aria-label="Categories"><a class="chip" href="/shop/"${current === 'all' ? ' aria-current="page"' : ''}>All</a>${ctx.categories
        .map((c) => `<a class="chip" href="/shop/${c.slug}/"${current === c.slug ? ' aria-current="page"' : ''}>${escapeHtml(c.name)}</a>`)
        .join('')}</nav>`
    : '';

  const body = `<div class="container">
  ${crumbs}
  <header class="plp-head">
    <h1 class="h1">${escapeHtml(title)}</h1>
    ${intro ? `<p class="lead">${escapeHtml(intro)}</p>` : ''}
    ${introStatus === 'NEEDS_CNM_APPROVAL' && !intro ? `<div style="max-width:560px">${approval('Category introduction copy.')}</div>` : ''}
    ${extraHead || ''}
  </header>
  ${catTabs}
  ${extra}
  <div class="plp" data-plp data-list="${escapeHtml(list)}">
    <aside class="filters" id="filters" aria-label="Filters" data-filters>
      <div class="sheet-head"><h2 class="label">Filter</h2><button class="icon-btn" type="button" data-filters-close aria-label="Close filters">${icon('close')}</button></div>
      <form class="filters__scroll" data-filter-form>${filters}</form>
      <div class="sheet-foot"><button class="btn btn--ghost" type="button" data-filters-clear>Clear</button><button class="btn" type="button" data-filters-close>Show <span data-result-count>${products.length}</span> results</button></div>
    </aside>
    <div>
      <div class="toolbar">
        <button class="btn btn--ghost filter-open-btn" type="button" data-filters-open aria-controls="filters" style="min-height:40px;padding:0 16px">${icon('filter')} Filter</button>
        <span class="toolbar__count" aria-live="polite"><span data-result-count>${products.length}</span> items</span>
        <label><span class="sr-only">Sort by</span><select class="select" data-sort>
          <option value="featured">Sort: Featured</option><option value="new">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name A–Z</option>
        </select></label>
      </div>
      <div class="active-filters" data-active-filters></div>
      ${products.length
        ? `<div class="grid-products grid-products--3" data-grid data-impressions="${escapeHtml(list)}">${products.map((p, i) => cardWithFacets(p, i, list)).join('')}</div>`
        : ''}
      <div class="empty-state" data-empty ${products.length ? 'hidden' : ''}>${products.length ? '<p class="h3">No products match these filters.</p><p class="muted">Try removing a filter, or explore everything we stock.</p><button class="btn btn--ghost" type="button" data-filters-clear>Clear filters</button>' : `<p class="h3">Coming soon online.</p><p class="muted">Visit us in Lagos or Abuja, or explore the rest of the shop.</p><div class="hero__cta" style="justify-content:center"><a class="btn" href="/shop/">Shop all</a><a class="btn btn--ghost" href="/stores/">Find a store</a></div>`}</div>
    </div>
  </div>
</div>`;

  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: title,
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ctx.siteUrl}/products/${p.slug}/` })),
  };
  return { body, jsonld: [ld, itemList] };
}

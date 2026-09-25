// Product card markup — rendered at build time for SEO and re-used in the browser (wishlist, search, recently viewed).
import { escapeHtml, formatMoney } from './format.mjs';
import { icon } from './icons.mjs';
import { productImages, productUrl, stockState } from './product.mjs';

export function priceHTML(p) {
  const { amount, compareAt, demo } = p.price || {};
  if (amount == null) return '<span class="muted">Price to be confirmed</span>';
  const sale = compareAt && compareAt > amount;
  return `${sale ? `<span class="price-was">${formatMoney(compareAt)}</span>` : ''}<span class="${sale ? 'price-now--sale' : ''}" data-price="${escapeHtml(p.id)}">${formatMoney(amount)}</span>${demo ? '<span class="demo-tag" title="Staging demo price — needs CNM approval">Demo</span>' : ''}`;
}

export function productCardHTML(p, { position = 0, list = 'grid', eager = false } = {}) {
  const imgs = productImages(p);
  const stock = stockState(p);
  const url = productUrl(p);
  const badges = [];
  if (p.isNew) badges.push('<span class="badge">New</span>');
  if (p.isBestSeller) badges.push('<span class="badge">Best seller</span>');
  if (stock.key === 'out') badges.push('<span class="badge badge--dark">Sold out</span>');
  const loading = eager ? 'eager' : 'lazy';
  return `<article class="card" data-product-card data-id="${escapeHtml(p.id)}" data-list="${escapeHtml(list)}" data-position="${position}">
  <a class="card__media" href="${url}" tabindex="-1" aria-hidden="true">
    <img src="${imgs[0].src}" alt="" width="800" height="1000" loading="${loading}" decoding="async">
    ${imgs[1] ? `<img class="alt" src="${imgs[1].src}" alt="" width="800" height="1000" loading="lazy" decoding="async">` : ''}
  </a>
  ${badges.length ? `<div class="card__badges">${badges.join('')}</div>` : ''}
  <button class="icon-btn card__wish" type="button" data-wish="${escapeHtml(p.id)}" aria-pressed="false" aria-label="Save ${escapeHtml(p.name)} to wishlist">${icon('heart')}</button>
  ${stock.orderable ? `<div class="card__quick"><button class="btn" type="button" data-add="${escapeHtml(p.id)}">Add to bag</button></div>` : ''}
  <div class="card__body">
    <span class="card__brand">${escapeHtml(p.brand)}</span>
    <h3 class="card__title"><a href="${url}">${escapeHtml(p.name)}</a></h3>
    <div class="card__price">${priceHTML(p)}</div>
    ${stock.key === 'low' || stock.key === 'out' ? `<span class="card__stock stock-${stock.key}" data-stock="${escapeHtml(p.id)}">${stock.label}</span>` : ''}
  </div>
</article>`;
}

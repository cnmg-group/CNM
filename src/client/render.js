// Rendering helpers shared by the entry module and page modules.
import { escapeHtml, formatMoney } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { productImages, productUrl, stockState } from '../shared/product.mjs';
import * as S from './store.js';

export function paintWish(root = document) {
  const ids = new Set(S.getWish());
  root.querySelectorAll('[data-wish]').forEach((b) => b.setAttribute('aria-pressed', String(ids.has(b.dataset.wish))));
}
export function lineHTML(p, l, { compact = false } = {}) {
  const img = productImages(p)[0];
  const max = Math.min(10, p.stock?.quantity ?? 10);
  return `<div class="line-item" data-line="${p.id}">
    <a class="line-item__media" href="${productUrl(p)}"><img src="${img.src}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></a>
    <div>
      <div class="line-item__top"><div><a class="line-item__name" href="${productUrl(p)}">${escapeHtml(p.name)}</a><div class="line-item__meta">${escapeHtml(p.brand)}${l.variant ? ` · ${escapeHtml(l.variant)}` : ''}</div></div><strong style="font-size:.9375rem;white-space:nowrap">${formatMoney((p.price.amount || 0) * l.qty)}</strong></div>
      <div class="line-item__actions">
        <div class="qty qty--sm" role="group" aria-label="Quantity for ${escapeHtml(p.name)}"><button type="button" data-line-dec="${p.id}" aria-label="Decrease">${icon('minus')}</button><input type="number" value="${l.qty}" min="1" max="${max}" aria-label="Quantity" data-line-qty="${p.id}"><button type="button" data-line-inc="${p.id}" aria-label="Increase"${l.qty >= max ? ' disabled' : ''}>${icon('plus')}</button></div>
        ${compact ? '' : `<button class="textlink" type="button" data-line-wish="${p.id}">Move to wishlist</button>`}
        <button class="textlink" type="button" data-line-remove="${p.id}">Remove</button>
      </div>
      ${stockState(p).key === 'low' ? `<div class="line-item__meta stock-low" style="margin-top:6px">${stockState(p).label}</div>` : ''}
    </div>
  </div>`;
}


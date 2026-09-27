import { productCardHTML } from '../../shared/card.mjs';
import { paintWish } from '../render.js';
import * as S from '../store.js';
import { toast } from '../ui.js';

export async function init() {
  const grid = document.querySelector('[data-wishlist-grid]');
  const empty = document.querySelector('[data-wishlist-empty]');
  const shared = new URLSearchParams(location.search).get('items');
  const { byId } = await S.catalogue();

  if (S.getUser()) {
    document.querySelector('[data-wish-note]').textContent = 'Synced to your account across web and app.';
    fetch('/api/account/wishlist', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d && JSON.stringify(d.items) !== JSON.stringify(S.getWish())) S.mergeWishlistOnSignIn();
    }).catch(() => {});
  }

  const render = () => {
    const ids = shared ? shared.split(',') : S.getWish();
    const products = ids.map((id) => byId.get(id)).filter(Boolean);
    grid.innerHTML = products.map((p, i) => productCardHTML(p, { position: i + 1, list: 'wishlist' }).replace('</article>', `<div class="card__actions">${p.stock?.quantity === 0 ? '<button class="btn btn--ghost" type="button" disabled>Sold out</button>' : `<button class="btn btn--ghost" type="button" data-move-to-bag="${p.id}">Move to bag</button>`}${shared ? '' : `<button class="icon-btn" type="button" data-wish-remove="${p.id}" aria-label="Remove ${p.name}" style="border:1px solid var(--line)">×</button>`}</div></article>`)).join('');
    empty.hidden = products.length > 0;
    paintWish(grid);
    if (shared) document.querySelector('.plp-head h1').textContent = 'Shared wishlist';
  };
  grid.addEventListener('click', (e) => {
    const mv = e.target.closest('[data-move-to-bag]');
    if (mv) { e.stopPropagation(); S.addToBag(mv.dataset.moveToBag, 1); if (!shared) S.removeWish(mv.dataset.moveToBag); toast('Moved to your bag', { action: 'View bag', href: '/bag/' }); }
    const rm = e.target.closest('[data-wish-remove]');
    if (rm) { e.stopPropagation(); S.removeWish(rm.dataset.wishRemove); }
  }, true);
  document.querySelector('[data-wish-share]').addEventListener('click', async () => {
    const url = `${location.origin}/wishlist/?items=${S.getWish().join(',')}`;
    try {
      if (navigator.share) await navigator.share({ title: 'My CNM wishlist', url });
      else { await navigator.clipboard.writeText(url); toast('Wishlist link copied'); }
    } catch { /* cancelled */ }
  });
  S.on('wish', render);
  render();
}

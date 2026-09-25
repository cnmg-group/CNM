// Client state: bag, wishlist, recently viewed. Persisted locally (guests) and synced to the account when signed in.
import { applyLive } from '../shared/product.mjs';

const KEYS = { bag: 'cnm.bag', wish: 'cnm.wish', recent: 'cnm.recent', user: 'cnm.user' };
const bus = new EventTarget();

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export const on = (type, fn) => bus.addEventListener(type, fn);
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

// ---- catalogue ----
let cataloguePromise = null;
export function catalogue() {
  if (!cataloguePromise) {
    cataloguePromise = Promise.all([
      fetch('/catalogue.json').then((r) => r.json()),
      fetch('/api/catalogue/live').then((r) => (r.ok ? r.json() : { products: {} })).catch(() => ({ products: {} })),
    ]).then(([cat, live]) => {
      const products = cat.products.map((p) => applyLive(p, live.products?.[p.id]));
      return { ...cat, products, byId: new Map(products.map((p) => [p.id, p])) };
    });
  }
  return cataloguePromise;
}

// ---- bag ----
export const getBag = () => read(KEYS.bag, []);
function setBag(lines) { write(KEYS.bag, lines); emit('bag', lines); }
export function addToBag(id, qty = 1, max = 10) {
  const lines = getBag();
  const line = lines.find((l) => l.id === id);
  if (line) line.qty = Math.min(max, line.qty + qty);
  else lines.unshift({ id, qty: Math.min(max, qty), addedAt: Date.now() });
  setBag(lines);
}
export function setQty(id, qty) { setBag(getBag().map((l) => (l.id === id ? { ...l, qty } : l)).filter((l) => l.qty > 0)); }
export function removeFromBag(id) { setBag(getBag().filter((l) => l.id !== id)); }
export function clearBag() { setBag([]); }
export const bagCount = () => getBag().reduce((n, l) => n + l.qty, 0);

// ---- wishlist ----
export const getWish = () => read(KEYS.wish, []);
function setWish(ids, { sync = true } = {}) {
  write(KEYS.wish, ids);
  emit('wish', ids);
  if (sync && getUser()) syncWishlist(ids);
}
export const inWish = (id) => getWish().includes(id);
export function toggleWish(id) {
  const ids = getWish();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
  setWish(next);
  return next.includes(id);
}
export function removeWish(id) { setWish(getWish().filter((x) => x !== id)); }

let syncTimer;
function syncWishlist(ids) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch('/api/account/wishlist', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CNM-Request': '1' }, body: JSON.stringify({ items: ids }), credentials: 'same-origin' }).catch(() => {});
  }, 400);
}
/** On sign-in: merge the guest wishlist into the account and adopt the merged list. */
export async function mergeWishlistOnSignIn() {
  const res = await fetch('/api/account/wishlist?merge=1', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CNM-Request': '1' }, body: JSON.stringify({ items: getWish() }), credentials: 'same-origin' });
  if (res.ok) { const { items } = await res.json(); setWish(items, { sync: false }); }
}

// ---- recently viewed ----
export const getRecent = () => read(KEYS.recent, []);
export function pushRecent(id) { write(KEYS.recent, [id, ...getRecent().filter((x) => x !== id)].slice(0, 12)); }

// ---- user (non-sensitive profile cache for UI only; the session itself is an HttpOnly cookie) ----
export const getUser = () => read(KEYS.user, null);
export function setUser(u) { if (u) write(KEYS.user, u); else localStorage.removeItem(KEYS.user); emit('user', u); }

// Product helpers shared by the build, the browser and functions.
const ART = {
  'Diffuser oil': 'dropper', 'Refill oil': 'bottle', 'Scent machine': 'machine', 'Body butter': 'jar',
  'Reed diffuser': 'reed', 'Car diffuser': 'car', 'Body wash': 'pump', 'Home fragrance': 'spray',
};

export const LOW_STOCK = 5;

export const productUrl = (p) => `/products/${p.slug}/`;

/** Resolved images; falls back to an illustrated placeholder until CNM supplies original photography. */
export function productImages(p) {
  if (p.images && p.images.length) return p.images.map((img) => ({ ...img, placeholder: false }));
  const art = ART[p.productType] || 'bottle';
  return [
    { src: `/assets/placeholders/${art}.svg`, alt: `${p.name} — illustration; original CNM photography awaiting approval`, placeholder: true },
    { src: `/assets/placeholders/${art}-alt.svg`, alt: `${p.name} — alternate illustration`, placeholder: true },
  ];
}

export function stockState(p) {
  const q = p.stock?.quantity;
  if (p.available === false) return { key: 'out', label: 'Currently unavailable', orderable: false };
  if (q == null) return { key: 'unknown', label: 'Availability to be confirmed', orderable: true };
  if (q <= 0) return { key: 'out', label: 'Out of stock', orderable: false };
  if (q <= LOW_STOCK) return { key: 'low', label: `Only ${q} left`, orderable: true };
  return { key: 'in', label: 'In stock', orderable: true };
}

/** Merge live admin overrides (price/stock/availability) onto a static product. */
export function applyLive(p, live) {
  if (!live) return p;
  return {
    ...p,
    price: { ...p.price, amount: live.price ?? p.price.amount, compareAt: live.compareAt ?? p.price.compareAt },
    stock: { ...p.stock, quantity: live.stock ?? p.stock.quantity },
    available: live.available ?? p.available,
  };
}

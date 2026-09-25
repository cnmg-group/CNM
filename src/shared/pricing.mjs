// Order pricing. The server is authoritative; the browser uses the same code only for instant estimates.

/**
 * @param {object} args
 * @param {{id:string, qty:number}[]} args.items
 * @param {Map<string, object>} args.products   id -> product (already merged with live overrides)
 * @param {object} args.commerce                content/commerce.json (+ admin overrides)
 * @param {string} [args.promoCode]
 * @param {string} [args.deliveryMethod]
 */
export function computeQuote({ items, products, commerce, promoCode, deliveryMethod }) {
  const errors = [];
  const maxQty = commerce.maxQtyPerLine ?? 10;
  const merged = new Map();
  for (const it of items || []) {
    if (!it || typeof it.id !== 'string') continue;
    const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (!qty) continue;
    merged.set(it.id, (merged.get(it.id) || 0) + qty);
  }

  const lines = [];
  for (const [id, requested] of merged) {
    const p = products.get(id);
    if (!p) { errors.push({ id, code: 'not_found', message: 'This product is no longer available.' }); continue; }
    const stock = p.stock?.quantity;
    if (p.available === false || stock === 0) { errors.push({ id, code: 'out_of_stock', message: `${p.name} is out of stock.` }); continue; }
    let qty = Math.min(requested, maxQty);
    if (stock != null && qty > stock) { qty = stock; errors.push({ id, code: 'qty_reduced', message: `Only ${stock} of ${p.name} available.` }); }
    const unit = p.price.amount;
    lines.push({ id, name: p.name, slug: p.slug, qty, unitPrice: unit, lineTotal: unit * qty });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let discount = 0;
  let promo = null;
  if (promoCode) {
    const code = String(promoCode).trim().toUpperCase();
    const d = (commerce.discounts || []).find((x) => x.code.toUpperCase() === code && x.active);
    if (!d) promo = { code, valid: false, message: 'This code is not valid.' };
    else if (subtotal < (d.minSubtotal || 0)) promo = { code, valid: false, message: `Spend ${d.minSubtotal} or more to use this code.` };
    else {
      discount = d.type === 'percent' ? Math.round((subtotal * d.value) / 100) : Math.min(d.value, subtotal);
      promo = { code, valid: true, message: d.type === 'percent' ? `${d.value}% off applied.` : 'Discount applied.' };
    }
  }

  const afterDiscount = subtotal - discount;
  const methods = (commerce.deliveryMethods || []).map((m) => ({
    id: m.id, label: m.label, eta: m.eta, regions: m.regions,
    fee: m.freeOver != null && afterDiscount >= m.freeOver ? 0 : m.fee,
  }));
  const method = methods.find((m) => m.id === deliveryMethod) || null;
  const delivery = lines.length && method ? method.fee : 0;
  const total = afterDiscount + delivery;
  const rate = commerce.vatRate?.value ?? 0;
  const vat = commerce.pricesIncludeVat?.value ? Math.round(total - total / (1 + rate)) : Math.round(total * rate);
  const grand = commerce.pricesIncludeVat?.value ? total : total + vat;

  return {
    currency: commerce.currency || 'NGN', lines, subtotal, discount, delivery, vat,
    vatIncluded: !!commerce.pricesIncludeVat?.value, total: grand,
    promo, deliveryMethod: method?.id || null, deliveryMethods: methods, errors,
  };
}

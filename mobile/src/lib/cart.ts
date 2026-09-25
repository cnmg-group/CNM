import { findProduct, stockState } from './catalogue';
import { roundKobo } from './format';
import type { BagLine, Catalogue, Commerce, DeliveryMethod, Product } from './types';

export interface BagState {
  lines: BagLine[];
  promoCode: string | null;
}

export type BagAction =
  | { type: 'hydrate'; state: BagState }
  | { type: 'add'; id: string; qty: number; max: number }
  | { type: 'setQty'; id: string; qty: number; max: number }
  | { type: 'remove'; id: string }
  | { type: 'setPromo'; code: string | null }
  | { type: 'clear' };

export const EMPTY_BAG: BagState = { lines: [], promoCode: null };

export function clampQty(qty: number, max: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(0, Math.min(Math.floor(qty), Math.max(0, max)));
}

/**
 * Per-line ceiling: the lower of commerce.maxQtyPerLine and known stock.
 * Unknown stock (null) is orderable up to maxQtyPerLine; CNM confirms availability.
 */
export function maxQtyFor(product: Product | undefined, commerce: Pick<Commerce, 'maxQtyPerLine'>): number {
  if (!product || stockState(product) === 'out_of_stock') return 0;
  const qty = product.stock.quantity;
  return qty == null ? commerce.maxQtyPerLine : Math.min(commerce.maxQtyPerLine, qty);
}

export function bagReducer(state: BagState, action: BagAction): BagState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'add': {
      const existing = state.lines.find((l) => l.id === action.id);
      const nextQty = clampQty((existing?.qty ?? 0) + action.qty, action.max);
      if (nextQty <= 0) return state;
      const lines = existing
        ? state.lines.map((l) => (l.id === action.id ? { ...l, qty: nextQty } : l))
        : [...state.lines, { id: action.id, qty: nextQty }];
      return { ...state, lines };
    }
    case 'setQty': {
      const qty = clampQty(action.qty, action.max);
      if (qty <= 0) return { ...state, lines: state.lines.filter((l) => l.id !== action.id) };
      return { ...state, lines: state.lines.map((l) => (l.id === action.id ? { ...l, qty } : l)) };
    }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.id !== action.id) };
    case 'setPromo':
      return { ...state, promoCode: action.code ? action.code.trim().toUpperCase() : null };
    case 'clear':
      return EMPTY_BAG;
    default:
      return state;
  }
}

export function bagCount(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export interface LocalTotals {
  subtotal: number;
  discount: number;
  delivery: number;
  vat: number;
  total: number;
  estimated: true;
}

/**
 * Client-side ESTIMATE shown only while the server quote is loading or
 * unreachable. The server (`/api/checkout/quote`) is always authoritative and
 * promo codes are only ever validated there, so discount is 0 here.
 * Prices include VAT when commerce.pricesIncludeVat is true; VAT is then the
 * portion already inside the total.
 */
export function estimateTotals(
  lines: BagLine[],
  catalogue: Catalogue,
  commerce: Pick<Commerce, 'pricesIncludeVat' | 'vatRate'>,
  delivery?: DeliveryMethod | null,
): LocalTotals {
  // Prices can carry kobo (e.g. ₦14,888.75); round at each step to avoid float drift.
  const subtotal = roundKobo(
    lines.reduce((sum, l) => {
      const p = findProduct(catalogue, l.id);
      return p ? sum + roundKobo(p.price.amount * l.qty) : sum;
    }, 0),
  );
  const discount = 0;
  const deliveryFee = !delivery
    ? 0
    : delivery.freeOver != null && subtotal - discount >= delivery.freeOver
      ? 0
      : delivery.fee;
  const rate = commerce.vatRate.value;
  const net = roundKobo(subtotal - discount + deliveryFee);
  let vat: number;
  let total: number;
  if (commerce.pricesIncludeVat.value) {
    total = net;
    vat = roundKobo(net - net / (1 + rate));
  } else {
    vat = roundKobo(net * rate);
    total = roundKobo(net + vat);
  }
  return { subtotal, discount, delivery: deliveryFee, vat, total, estimated: true };
}

/** Lines whose product vanished or sold out — surfaced to the user in the bag. */
export function unavailableLines(lines: BagLine[], catalogue: Catalogue): BagLine[] {
  return lines.filter((l) => {
    const p = findProduct(catalogue, l.id);
    return !p || stockState(p) === 'out_of_stock';
  });
}

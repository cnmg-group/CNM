export type WishlistAction =
  | { type: 'hydrate'; ids: string[] }
  | { type: 'add'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'toggle'; id: string };

export function wishlistReducer(state: string[], action: WishlistAction): string[] {
  switch (action.type) {
    case 'hydrate':
      return dedupe(action.ids);
    case 'add':
      return state.includes(action.id) ? state : [action.id, ...state];
    case 'remove':
      return state.filter((id) => id !== action.id);
    case 'toggle':
      return state.includes(action.id) ? state.filter((id) => id !== action.id) : [action.id, ...state];
    default:
      return state;
  }
}

export function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.length > 0)));
}

/** Local merge used as a fallback if the server merge call fails. */
export function mergeWishlists(local: string[], remote: string[]): string[] {
  return dedupe([...local, ...remote]);
}

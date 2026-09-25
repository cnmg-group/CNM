import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { KEYS, readJSON, writeJSON } from '@/lib/storage';

const MAX = 12;

type Action = { type: 'hydrate'; ids: string[] } | { type: 'view'; id: string };

function reducer(state: string[], action: Action): string[] {
  switch (action.type) {
    case 'hydrate':
      return action.ids.slice(0, MAX);
    case 'view':
      return [action.id, ...state.filter((x) => x !== action.id)].slice(0, MAX);
    default:
      return state;
  }
}

const Ctx = createContext<{ ids: string[]; markViewed: (id: string) => void } | null>(null);

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [ids, dispatch] = useReducer(reducer, []);
  const hydrated = useRef(false);

  useEffect(() => {
    readJSON<string[]>(KEYS.recentlyViewed, []).then((saved) => {
      hydrated.current = true;
      if (Array.isArray(saved)) dispatch({ type: 'hydrate', ids: saved });
    });
  }, []);

  useEffect(() => {
    if (hydrated.current) writeJSON(KEYS.recentlyViewed, ids);
  }, [ids]);

  const markViewed = useCallback((id: string) => dispatch({ type: 'view', id }), []);
  const value = useMemo(() => ({ ids, markViewed }), [ids, markViewed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecentlyViewed() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRecentlyViewed must be used inside RecentlyViewedProvider');
  return ctx;
}

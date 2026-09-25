import { useCallback, useEffect, useRef, useState } from 'react';

import { api, errorMessage } from '@/lib/api';
import type { BagLine, Quote } from '@/lib/types';

/**
 * Server-authoritative totals from POST /api/checkout/quote.
 * Debounced so rapid stepper taps send one request; stale responses are discarded.
 */
export function useQuote(lines: BagLine[], promoCode: string | null, deliveryMethod?: string | null) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const key = JSON.stringify({ lines, promoCode, deliveryMethod });

  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      setLoading(false);
      setError(null);
      return;
    }
    const id = ++seq.current;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await api<Quote>('/api/checkout/quote', {
          method: 'POST',
          body: { items: lines.map((l) => ({ id: l.id, qty: l.qty })), promoCode: promoCode ?? undefined, deliveryMethod: deliveryMethod ?? undefined },
          signal: controller.signal,
        });
        if (id !== seq.current) return;
        setQuote(q);
        setError(null);
      } catch (e) {
        if (id !== seq.current || controller.signal.aborted) return;
        setError(errorMessage(e));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { quote, loading, error, refetch };
}

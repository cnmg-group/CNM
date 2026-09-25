import { store } from './store.mjs';
import { fail } from './http.mjs';

const LIMITS = { auth: [10, 60], checkout: [20, 60], quote: [120, 60], lead: [5, 60], admin: [5, 60], events: [120, 60], otp: [5, 600] };

/** Fixed-window limiter per bucket+key. Best-effort (eventual writes), sufficient to blunt brute force & spam. */
export async function rateLimit(bucket, key) {
  const [max, windowSec] = LIMITS[bucket];
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const s = await store('ratelimit');
  const k = `${bucket}/${key}`;
  const cur = await s.get(k);
  const n = cur?.win === win ? cur.n + 1 : 1;
  await s.set(k, { win, n });
  if (n > max) fail(429, 'rate_limited', 'Too many attempts. Please wait a moment and try again.');
}

// Idempotency for state-changing admin requests (create company, manual order, refund, bulk import…).
// The client sends an `Idempotency-Key` header (a UUID per user action). The first response is stored for 24 hours;
// a retry with the same key and the same body gets the stored response instead of repeating the action. Reusing a key
// with a different body is rejected (422) so a bug can't silently apply the wrong change.
import { createHash } from 'node:crypto';
import { store } from './store.mjs';
import { fail } from './http.mjs';

const TTL = 24 * 36e5;
const hash = (x) => createHash('sha256').update(JSON.stringify(x ?? null)).digest('hex');

/**
 * @param req    the Request (reads the Idempotency-Key header)
 * @param scope  who/what the key belongs to, e.g. `${admin.email}:companies.create`
 * @param body   the parsed request body (fingerprinted)
 * @param run    async () => ({ status, body }) — performs the action once
 */
export async function idempotent(req, scope, body, run) {
  const key = req.headers.get('idempotency-key');
  if (!key) return run();
  if (!/^[\w-]{8,100}$/.test(key)) fail(400, 'invalid_idempotency_key', 'Idempotency-Key must be 8–100 letters, numbers, dashes or underscores.');
  const s = await store('idempotency');
  const id = `${hash(scope)}:${key}`;
  const prior = await s.get(id);
  const fp = hash(body);
  if (prior && Date.now() - Date.parse(prior.at) < TTL) {
    if (prior.fingerprint !== fp) fail(422, 'idempotency_mismatch', 'This Idempotency-Key was already used for a different request.');
    return { ...prior.response, replayed: true };
  }
  const response = await run();
  await s.set(id, { at: new Date().toISOString(), fingerprint: fp, response });
  return response;
}

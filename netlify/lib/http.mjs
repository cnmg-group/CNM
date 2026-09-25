// Response helpers, request parsing and CSRF/origin enforcement.
export class HttpError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

export function json(data, status = 200, headers = {}) {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const [k, v] of Object.entries(headers)) {
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else h.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

export const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra); };

export async function readJson(req, maxBytes = 32 * 1024) {
  const text = await req.text();
  if (text.length > maxBytes) fail(413, 'too_large', 'Request is too large.');
  if (!text) return {};
  try { const v = JSON.parse(text); if (v && typeof v === 'object') return v; } catch { /* fallthrough */ }
  return fail(400, 'bad_json', 'Invalid request body.');
}

export const isMobile = (req) => req.headers.get('x-cnm-client') === 'mobile';

/**
 * Cookie-authenticated state changes must be same-origin and carry our custom header
 * (which cannot be sent cross-site without a CORS preflight we never grant).
 * Bearer-token (mobile) requests carry no ambient credentials and are exempt.
 */
export function assertCsrf(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  if (req.headers.get('authorization')?.startsWith('Bearer ')) return;
  if (req.headers.get('x-cnm-request') !== '1') fail(403, 'csrf', 'Request blocked.');
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) fail(403, 'csrf', 'Request blocked.');
}

export const clientIp = (req, context) => context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

export const segments = (req) => new URL(req.url).pathname.replace(/^\/+|\/+$/g, '').split('/');

/** Wrap a handler with uniform error handling. */
export function handler(fn) {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, message: err.message, ...(err.extra || {}) }, err.status);
      console.error('[cnm] unhandled', err);
      return json({ error: 'server_error', message: 'Something went wrong on our side. Please try again.' }, 500);
    }
  };
}

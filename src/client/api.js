import { withLoader } from './loader.js';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error;
    this.body = body;
  }
}

/** JSON API call. State-changing requests carry the CSRF header; the loader only shows for slow requests. */
export async function api(path, { method = 'GET', body, loader = true, signal, headers: extra = {} } = {}) {
  const headers = { Accept: 'application/json', ...extra };
  if (method !== 'GET') { headers['Content-Type'] = 'application/json'; headers['X-CNM-Request'] = '1'; }
  const run = fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', signal })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, data);
      return data;
    });
  return loader ? withLoader(run) : run;
}

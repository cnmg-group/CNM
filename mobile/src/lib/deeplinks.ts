/**
 * Maps any CNM link (universal link, `cnm://` scheme, or bare path) to an
 * in-app route. Used for notification taps; Expo Router handles OS-level
 * links itself using the same file-based paths.
 */
export const LINK_HOSTS = ['cnmessentials.com', 'www.cnmessentials.com'];

const ROUTES: { pattern: RegExp; to: (m: RegExpMatchArray) => string }[] = [
  { pattern: /^\/products\/([a-z0-9-]+)\/?$/i, to: (m) => `/products/${m[1]}` },
  { pattern: /^\/shop\/([a-z0-9-]+)\/?$/i, to: (m) => `/shop/${m[1]}` },
  { pattern: /^\/shop\/?$/i, to: () => '/shop' },
  { pattern: /^\/account\/orders\/([A-Za-z0-9-]+)\/?$/, to: (m) => `/account/orders/${m[1]}` },
  { pattern: /^\/account\/orders\/?$/, to: () => '/account/orders' },
  { pattern: /^\/account\/?$/, to: () => '/account' },
  { pattern: /^\/wishlist\/?$/, to: () => '/wishlist' },
  { pattern: /^\/bag\/?$/, to: () => '/bag' },
  { pattern: /^\/search\/?$/, to: () => '/search' },
  { pattern: /^\/?$/, to: () => '/' },
];

export function extractPath(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return raw.split(/[?#]/)[0];
  const scheme = /^cnm:\/\/(.*)$/i.exec(raw);
  if (scheme) return '/' + scheme[1].split(/[?#]/)[0].replace(/^\/+/, '');
  const web = /^https:\/\/([^/?#]+)(\/[^?#]*)?/i.exec(raw);
  if (web && LINK_HOSTS.includes(web[1].toLowerCase())) return web[2] || '/';
  return null;
}

/** Returns an in-app route for a trusted CNM link, or null for anything else. */
export function routeForUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = extractPath(url);
  if (path == null) return null;
  for (const r of ROUTES) {
    const m = path.match(r.pattern);
    if (m) return r.to(m);
  }
  return null;
}

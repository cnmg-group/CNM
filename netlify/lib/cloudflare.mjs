// Cloudflare Pages adapter: runs the same /api handlers as Netlify (they take a web Request and return a Response).
// functions/api/[[path]].js hands every /api/* request here. Needs the nodejs_compat compatibility flag and,
// for storage, a D1 database bound as CNM_DB (or Supabase via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
import * as account from '../functions/account.mjs';
import * as admin from '../functions/admin.mjs';
import * as auth from '../functions/auth.mjs';
import * as catalogueLive from '../functions/catalogue-live.mjs';
import * as checkout from '../functions/checkout.mjs';
import * as courierWebhook from '../functions/courier-webhook.mjs';
import * as events from '../functions/events.mjs';
import * as leads from '../functions/leads.mjs';
import * as media from '../functions/media.mjs';
import * as ops from '../functions/ops.mjs';
import * as orders from '../functions/orders.mjs';
import * as payments from '../functions/payments.mjs';
import * as recommend from '../functions/recommend.mjs';

const MODULES = [account, admin, auth, catalogueLive, checkout, courierWebhook, events, leads, media, ops, orders, payments, recommend];

// Same matching as scripts/dev-server.mjs: each handler's config.path patterns, most specific first.
export const ROUTES = MODULES.flatMap((m) => [].concat(m.config.path).map((p) => ({
  re: new RegExp(`^${p.replace(/:[a-zA-Z]+/g, '([^/]+)')}/?$`),
  fn: m.default,
  specificity: p.split('/').filter((s) => !s.startsWith(':')).length,
}))).sort((a, b) => b.specificity - a.specificity);

export const matchRoute = (pathname) => ROUTES.find((r) => r.re.test(pathname)) || null;

/** Copies string settings (Cloudflare "variables and secrets") into process.env, where the handlers read them. */
export function applyEnv(env = {}) {
  globalThis.process ||= { env: {} };
  process.env ||= {};
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
  process.env.CNM_PLATFORM = 'cloudflare';
  if (env.CNM_DB && typeof env.CNM_DB.prepare === 'function') globalThis.__CNM_D1 = env.CNM_DB;
}

export async function handleApi({ request, env }) {
  applyEnv(env);
  const r = matchRoute(new URL(request.url).pathname);
  if (!r) return new Response(JSON.stringify({ error: 'not_found', message: 'Unknown API route.' }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  return r.fn(request, { ip: request.headers.get('cf-connecting-ip') || undefined });
}

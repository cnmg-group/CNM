// Stateless signed sessions. Cookies for the web (HttpOnly), bearer tokens for the mobile apps.
import { hmac, randomToken, safeEqual } from './crypto.mjs';
import { fail } from './http.mjs';
import { store } from './store.mjs';

const USER_COOKIE = 'cnm_session';
const ADMIN_COOKIE = 'cnm_admin';
const USER_TTL = 60 * 60 * 24 * 30;
const ADMIN_TTL = 60 * 60 * 12;
export const ADMIN_REMEMBER_TTL = 60 * 60 * 24; // "Keep me signed in": never longer than 24 hours

let secretPromise;
/** SESSION_SECRET env var; if absent (fresh staging), a random secret is generated once and kept server-side in Blobs. */
export function secret() {
  if (process.env.SESSION_SECRET) return Promise.resolve(process.env.SESSION_SECRET);
  secretPromise ||= (async () => {
    const s = await store('config');
    let v = await s.get('secrets/session');
    if (!v) { v = randomToken(48); await s.set('secrets/session', v); }
    return v;
  })();
  return secretPromise;
}

export async function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(await secret(), body)}`;
}

export async function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!safeEqual(sig, hmac(await secret(), body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Math.floor(Date.now() / 1000) ? p : null;
  } catch { return null; }
}

export function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const secure = (req) => new URL(req.url).protocol === 'https:';
/** maxAge null → a browser-session cookie (gone when the browser closes). */
export function cookie(req, name, value, maxAge, sameSite = 'Lax') {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${sameSite}${maxAge == null ? '' : `; Max-Age=${maxAge}`}${secure(req) ? '; Secure' : ''}`;
}

export async function issueUserSession(req, user) {
  const token = await sign({ typ: 'user', uid: user.id, v: user.sessionVersion || 0, exp: Math.floor(Date.now() / 1000) + USER_TTL });
  return { token, setCookie: cookie(req, USER_COOKIE, token, USER_TTL) };
}
export const clearUserCookie = (req) => cookie(req, USER_COOKIE, '', 0);

/** Returns the signed-in user record or null. Honours sessionVersion (log out everywhere / password reset). */
export async function currentUser(req) {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : readCookie(req, USER_COOKIE);
  const p = await verify(token);
  if (!p || p.typ !== 'user') return null;
  const users = await store('users');
  const u = await users.get(`user/${p.uid}`);
  if (!u || (u.sessionVersion || 0) !== p.v) return null;
  return u;
}
export async function requireUser(req) {
  const u = await currentUser(req);
  if (!u) fail(401, 'unauthenticated', 'Please sign in.');
  return u;
}

/** Admin session: 12 hours and gone when the browser closes, or — "Keep me signed in" — up to 24 hours on this device. */
export async function issueAdminSession(req, admin, { remember = false } = {}) {
  const ttl = remember ? ADMIN_REMEMBER_TTL : ADMIN_TTL;
  const token = await sign({ typ: 'admin', email: admin.email, role: admin.role, name: admin.name, ...(Array.isArray(admin.companies) && admin.companies.length ? { companies: admin.companies } : {}), rem: remember ? 1 : 0, exp: Math.floor(Date.now() / 1000) + ttl });
  return cookie(req, ADMIN_COOKIE, token, remember ? ttl : null, 'Strict');
}
export const clearAdminCookie = (req) => cookie(req, ADMIN_COOKIE, '', 0, 'Strict');

// Admin sign-in is three steps: email + password → emailed code (OTP) → PIN. Between steps the browser holds a short-lived
// signed "step" cookie saying which step it has reached; it never grants access to anything by itself.
const ADMIN_STEP_COOKIE = 'cnm_admin_step';
export const ADMIN_STEP_TTL = 60 * 10;
export async function issueAdminStep(req, { email, stage, nonce, remember = false }) {
  const token = await sign({ typ: 'admin_step', email, stage, nonce, rem: remember ? 1 : 0, exp: Math.floor(Date.now() / 1000) + ADMIN_STEP_TTL });
  return cookie(req, ADMIN_STEP_COOKIE, token, ADMIN_STEP_TTL, 'Strict');
}
export async function readAdminStep(req) {
  const p = await verify(readCookie(req, ADMIN_STEP_COOKIE));
  return p?.typ === 'admin_step' ? p : null;
}
export const clearAdminStep = (req) => cookie(req, ADMIN_STEP_COOKIE, '', 0, 'Strict');
/**
 * Admin preview: while the site is pre-launch, /admin opens straight to the dashboard with no sign-in so it can be
 * shared for review. It is READ-ONLY (anything that changes data is refused) and switches itself off at launch
 * (CONTEXT=production + CNM_LAUNCH_APPROVED=true), or earlier with CNM_ADMIN_PREVIEW=false. Local runs and tests
 * keep the normal sign-in unless CNM_ADMIN_PREVIEW=true.
 */
export function adminPreviewOn() {
  const flag = process.env.CNM_ADMIN_PREVIEW;
  if (flag === 'false') return false;
  const launched = process.env.CONTEXT === 'production' && process.env.CNM_LAUNCH_APPROVED === 'true';
  if (launched) return false;
  return flag === 'true' || process.env.CNM_LOCAL_STORE !== '1';
}
export const PREVIEW_ADMIN = Object.freeze({ typ: 'admin', email: 'preview@cnm-group.net', role: 'owner', name: 'Preview', preview: true });

export async function currentAdmin(req) {
  const p = await verify(readCookie(req, ADMIN_COOKIE));
  if (p?.typ === 'admin') return p;
  if (!adminPreviewOn()) return null;
  if (!['GET', 'HEAD'].includes(req.method)) fail(403, 'preview_read_only', 'This is a preview: changes are switched off. Everything can be viewed, nothing is saved.');
  return PREVIEW_ADMIN;
}

export const publicUser = (u) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone || '', createdAt: u.createdAt });

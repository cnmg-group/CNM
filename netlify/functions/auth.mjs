// /api/auth/* — register, login, logout, me, password reset, passwordless email code.
import { emailKey, hashPassword, randomCode, randomToken, sha256, verifyPassword } from '../lib/crypto.mjs';
import { emailConfigured, otpEmail, resetEmail, sendEmail } from '../lib/email.mjs';
import { assertCsrf, clientIp, fail, handler, isMobile, json, readJson, segments } from '../lib/http.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';
import { clearUserCookie, currentUser, issueUserSession, publicUser } from '../lib/session.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';

const siteUrl = (req) => process.env.URL && process.env.CONTEXT === 'production' ? process.env.URL : new URL(req.url).origin;
const staging = () => process.env.CONTEXT !== 'production';

async function findByEmail(users, email) {
  const idx = await users.get(`email/${emailKey(email)}`);
  return idx ? users.get(`user/${idx.id}`) : null;
}

async function signedIn(req, user, status = 200) {
  const { token, setCookie } = await issueUserSession(req, user);
  return json({ user: publicUser(user), ...(isMobile(req) ? { token } : {}) }, status, { 'Set-Cookie': setCookie });
}

// A fixed dummy hash so unknown emails take the same time as wrong passwords (no user enumeration by timing).
const DUMMY = 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export default handler(async (req, context) => {
  const action = segments(req)[2];
  const ip = clientIp(req, context);
  const users = await store('users');

  if (action === 'me' && req.method === 'GET') {
    const u = await currentUser(req);
    if (!u) fail(401, 'unauthenticated', 'Not signed in.');
    return json({ user: publicUser(u) });
  }

  if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
  assertCsrf(req);
  await rateLimit(action?.startsWith('otp') ? 'otp' : 'auth', ip);
  const body = await readJson(req);

  switch (action) {
    case 'register': {
      const email = v.email(body.email);
      const password = v.str(body.password, { name: 'Password', min: 10, max: 200 });
      const firstName = v.str(body.firstName, { name: 'First name', max: 80 });
      const lastName = v.str(body.lastName, { name: 'Last name', max: 80 });
      if (await findByEmail(users, email)) fail(409, 'exists', 'An account with this email already exists. Try signing in.');
      const now = new Date().toISOString();
      const user = {
        id: randomToken(12), email, firstName, lastName, phone: '', passwordHash: await hashPassword(password), sessionVersion: 0, createdAt: now,
        addresses: [], wishlist: [], pushTokens: [],
        preferences: {
          email: { orders: true, backInStock: true, wishlist: false, newArrivals: v.bool(body.marketingOptIn), events: v.bool(body.marketingOptIn), promotions: v.bool(body.marketingOptIn) },
          sms: { orders: true, backInStock: false, wishlist: false, newArrivals: false, events: false, promotions: false },
          push: { orders: true, backInStock: true, wishlist: false, newArrivals: false, events: false, promotions: false },
        },
      };
      await users.set(`user/${user.id}`, user);
      await users.set(`email/${emailKey(email)}`, { id: user.id });
      return signedIn(req, user, 201);
    }
    case 'login': {
      const email = v.email(body.email);
      const password = v.str(body.password, { name: 'Password', max: 200 });
      const user = await findByEmail(users, email);
      const ok = await verifyPassword(password, user?.passwordHash || DUMMY);
      if (!user || !ok) fail(401, 'invalid_credentials', 'Email or password is incorrect.');
      return signedIn(req, user);
    }
    case 'logout':
      return json({ ok: true }, 200, { 'Set-Cookie': clearUserCookie(req) });
    case 'reset-request': {
      const email = v.email(body.email);
      const user = await findByEmail(users, email);
      let devLink;
      if (user) {
        const token = randomToken(32);
        await (await store('tokens')).set(`reset/${sha256(token)}`, { uid: user.id, exp: Date.now() + 30 * 60 * 1000 });
        const link = `${siteUrl(req)}/account/reset/?token=${token}`;
        await sendEmail(resetEmail(email, link));
        if (!emailConfigured() && staging()) devLink = link;
      }
      return json({ ok: true, ...(devLink ? { devLink } : {}) });
    }
    case 'reset-confirm': {
      const token = v.str(body.token, { name: 'Token', max: 200 });
      const password = v.str(body.password, { name: 'Password', min: 10, max: 200 });
      const tokens = await store('tokens');
      const rec = await tokens.get(`reset/${sha256(token)}`);
      if (!rec || rec.exp < Date.now()) fail(400, 'invalid_token', 'This reset link has expired. Please request a new one.');
      const user = await users.get(`user/${rec.uid}`);
      if (!user) fail(400, 'invalid_token', 'This reset link is no longer valid.');
      user.passwordHash = await hashPassword(password);
      user.sessionVersion = (user.sessionVersion || 0) + 1; // sign out everywhere
      await users.set(`user/${user.id}`, user);
      await tokens.delete(`reset/${sha256(token)}`);
      return json({ ok: true });
    }
    case 'otp-request': {
      const email = v.email(body.email);
      const user = await findByEmail(users, email);
      let devCode;
      if (user) {
        const code = randomCode(6);
        await (await store('tokens')).set(`otp/${emailKey(email)}`, { hash: sha256(code), exp: Date.now() + 10 * 60 * 1000, attempts: 0 });
        await sendEmail(otpEmail(email, code));
        if (!emailConfigured() && staging()) devCode = code;
      }
      return json({ ok: true, ...(devCode ? { devCode } : {}) });
    }
    case 'otp-verify': {
      const email = v.email(body.email);
      const code = v.str(body.code, { name: 'Code', max: 6 });
      const tokens = await store('tokens');
      const key = `otp/${emailKey(email)}`;
      const rec = await tokens.get(key);
      if (!rec || rec.exp < Date.now() || rec.attempts >= 5) fail(400, 'invalid_code', 'This code has expired. Please request a new one.');
      if (sha256(code) !== rec.hash) { rec.attempts++; await tokens.set(key, rec); fail(400, 'invalid_code', 'That code is incorrect.'); }
      await tokens.delete(key);
      const user = await findByEmail(users, email);
      if (!user) fail(400, 'invalid_code', 'That code is incorrect.');
      return signedIn(req, user);
    }
    default:
      fail(404, 'not_found', 'Unknown action.');
  }
});

export const config = { path: '/api/auth/:action' };

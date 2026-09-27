// /api/auth/* — register, login, logout, me, password reset, passwordless email code.
import { emailKey, hashPassword, randomCode, randomToken, safeEqual, sha256, verifyPassword } from '../lib/crypto.mjs';
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

async function createUser(users, { email, firstName = '', lastName = '', passwordHash = null, marketing = false, verified = false }) {
  const user = {
    id: randomToken(12), email, firstName, lastName, phone: '', passwordHash, sessionVersion: 0, createdAt: new Date().toISOString(),
    emailVerifiedAt: verified ? new Date().toISOString() : null, addresses: [], wishlist: [], pushTokens: [],
    preferences: {
      email: { orders: true, backInStock: true, wishlist: false, newArrivals: marketing, events: marketing, promotions: marketing },
      sms: { orders: true, backInStock: false, wishlist: false, newArrivals: false, events: false, promotions: false },
      push: { orders: true, backInStock: true, wishlist: false, newArrivals: false, events: false, promotions: false },
    },
  };
  await users.set(`user/${user.id}`, user);
  await users.set(`email/${emailKey(email)}`, { id: user.id });
  return user;
}

const OTP_TTL = 10 * 60 * 1000;
const OTP_RESEND_AFTER = 60 * 1000;

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
      const user = await createUser(users, { email, firstName, lastName, passwordHash: await hashPassword(password), marketing: v.bool(body.marketingOptIn) });
      return signedIn(req, user, 201);
    }
    case 'login': {
      const email = v.email(body.email);
      const password = v.str(body.password, { name: 'Password', max: 200 });
      const user = await findByEmail(users, email);
      const ok = await verifyPassword(password, user?.passwordHash || DUMMY);
      if (!user || !ok) fail(401, 'invalid_credentials', user && !user.passwordHash ? 'This account signs in with an email code. Choose "Email me a code".' : 'Email or password is incorrect.');
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
      // Passwordless sign-in: anyone with an email address gets a 6-digit code. New emails get an account on first verify.
      const email = v.email(body.email);
      const tokens = await store('tokens');
      const key = `otp/${emailKey(email)}`;
      const prev = await tokens.get(key);
      if (prev && prev.sentAt && Date.now() - prev.sentAt < OTP_RESEND_AFTER) {
        fail(429, 'otp_cooldown', `Please wait ${Math.ceil((OTP_RESEND_AFTER - (Date.now() - prev.sentAt)) / 1000)} seconds before requesting another code.`);
      }
      const code = randomCode(6);
      await tokens.set(key, { hash: sha256(code), exp: Date.now() + OTP_TTL, attempts: 0, sentAt: Date.now() });
      const { sent } = await sendEmail(otpEmail(email, code));
      const devCode = !emailConfigured() && staging() ? code : undefined;
      if (emailConfigured() && !sent) fail(502, 'email_failed', 'We could not send your code right now. Please try again in a moment.');
      return json({ ok: true, expiresInMinutes: OTP_TTL / 60000, resendAfterSeconds: OTP_RESEND_AFTER / 1000, ...(devCode ? { devCode } : {}) });
    }
    case 'otp-verify': {
      const email = v.email(body.email);
      const code = v.str(body.code, { name: 'Code', max: 6 });
      if (!/^\d{6}$/.test(code)) fail(400, 'invalid_code', 'Enter the 6-digit code from your email.');
      const tokens = await store('tokens');
      const key = `otp/${emailKey(email)}`;
      const rec = await tokens.get(key);
      if (!rec || rec.exp < Date.now() || rec.attempts >= 5) fail(400, 'invalid_code', 'This code has expired. Please request a new one.');
      if (!safeEqual(sha256(code), rec.hash)) { rec.attempts++; await tokens.set(key, rec); fail(400, 'invalid_code', `That code is incorrect. ${Math.max(0, 5 - rec.attempts)} attempts left.`); }
      await tokens.delete(key);
      let user = await findByEmail(users, email);
      const isNew = !user;
      if (!user) {
        user = await createUser(users, {
          email, verified: true, marketing: v.bool(body.marketingOptIn),
          firstName: v.str(body.firstName, { name: 'First name', max: 80, required: false }),
          lastName: v.str(body.lastName, { name: 'Last name', max: 80, required: false }),
        });
      } else if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date().toISOString();
        await users.set(`user/${user.id}`, user);
      }
      const res = await signedIn(req, user, isNew ? 201 : 200);
      const data = await res.json();
      return json({ ...data, isNew, needsProfile: !user.firstName }, res.status, { 'Set-Cookie': res.headers.get('set-cookie') });
    }
    default:
      fail(404, 'not_found', 'Unknown action.');
  }
});

export const config = { path: '/api/auth/:action' };

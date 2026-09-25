// /api/account/* — profile, addresses, preferences, wishlist, orders, push tokens.
import { randomToken } from '../lib/crypto.mjs';
import { assertCsrf, fail, handler, json, readJson, segments } from '../lib/http.mjs';
import { getOrder, listOrders, publicOrder, summary } from '../lib/orders.mjs';
import { baseProducts } from '../lib/catalogue.mjs';
import { requireUser } from '../lib/session.mjs';
import { store } from '../lib/store.mjs';
import * as v from '../lib/validate.mjs';

const TOPICS = ['orders', 'backInStock', 'wishlist', 'newArrivals', 'events', 'promotions'];
const CHANNELS = ['email', 'sms', 'push'];
const PRODUCT_IDS = new Set(baseProducts.map((p) => p.id));

export default handler(async (req) => {
  assertCsrf(req);
  const [, , section, sub] = segments(req);
  const user = await requireUser(req);
  const users = await store('users');
  const save = () => users.set(`user/${user.id}`, user);
  const put = req.method === 'PUT' || req.method === 'POST';

  switch (section) {
    case 'profile': {
      if (put) {
        const b = await readJson(req);
        user.firstName = v.str(b.firstName, { name: 'First name', max: 80 });
        user.lastName = v.str(b.lastName, { name: 'Last name', max: 80 });
        user.phone = v.phone(b.phone, { required: false });
        await save();
      }
      return json({ profile: { firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' } });
    }
    case 'addresses': {
      if (put) {
        const b = await readJson(req);
        if (!Array.isArray(b.addresses) || b.addresses.length > 10) fail(422, 'invalid', 'Up to 10 addresses can be saved.');
        const list = b.addresses.map((a) => ({
          id: typeof a.id === 'string' && a.id ? a.id.slice(0, 24) : randomToken(8),
          label: v.str(a.label, { name: 'Label', max: 40 }), firstName: v.str(a.firstName, { name: 'First name', max: 80 }), lastName: v.str(a.lastName, { name: 'Last name', max: 80 }),
          phone: v.phone(a.phone), line1: v.str(a.line1, { name: 'Address', max: 200 }), line2: v.str(a.line2, { name: 'Address line 2', max: 200, required: false }),
          city: v.str(a.city, { name: 'City', max: 80 }), state: v.str(a.state, { name: 'State', max: 40 }), country: 'NG', isDefault: v.bool(a.isDefault),
        }));
        if (list.length && !list.some((a) => a.isDefault)) list[0].isDefault = true;
        user.addresses = list;
        await save();
      }
      return json({ addresses: user.addresses || [] });
    }
    case 'preferences': {
      if (put) {
        const b = await readJson(req);
        const next = {};
        for (const c of CHANNELS) { next[c] = {}; for (const t of TOPICS) next[c][t] = v.bool(b?.[c]?.[t]); }
        user.preferences = next;
        await save();
      }
      return json({ preferences: user.preferences });
    }
    case 'wishlist': {
      if (put) {
        const b = await readJson(req);
        const incoming = (Array.isArray(b.items) ? b.items : []).filter((id) => PRODUCT_IDS.has(id));
        const merge = new URL(req.url).searchParams.get('merge') === '1';
        user.wishlist = [...new Set(merge ? [...incoming, ...(user.wishlist || [])] : incoming)].slice(0, 200);
        await save();
      }
      return json({ items: user.wishlist || [] });
    }
    case 'orders': {
      if (sub) {
        const o = await getOrder(decodeURIComponent(sub));
        if (!o || o.userId !== user.id) fail(404, 'not_found', 'Order not found.');
        return json({ order: publicOrder(o) });
      }
      return json({ orders: (await listOrders({ userId: user.id })).map(summary) });
    }
    case 'push-token': {
      const b = await readJson(req);
      const token = v.str(b.token, { name: 'Token', max: 200 });
      const platform = v.oneOf(b.platform, ['ios', 'android'], 'Platform');
      user.pushTokens = [{ token, platform, at: new Date().toISOString() }, ...(user.pushTokens || []).filter((t) => t.token !== token)].slice(0, 5);
      await save();
      return json({ ok: true });
    }
    case 'logout-all': {
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      await save();
      return json({ ok: true }, 200, { 'Set-Cookie': 'cnm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    }
    default:
      fail(404, 'not_found', 'Unknown section.');
  }
});

export const config = { path: ['/api/account/:section', '/api/account/:section/:sub'] };

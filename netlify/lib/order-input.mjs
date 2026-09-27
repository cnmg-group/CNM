// Validation shared by storefront checkout and staff manual orders, so both follow exactly the same rules.
import { fail } from './http.mjs';
import * as v from './validate.mjs';

export function parseContact(c = {}, { phoneRequired = true } = {}) {
  return {
    email: v.email(c.email), phone: v.phone(c.phone, { required: phoneRequired }),
    firstName: v.str(c.firstName, { name: 'First name', max: 80 }), lastName: v.str(c.lastName, { name: 'Last name', max: 80 }),
    marketing: v.bool(c.marketing),
  };
}

export function parseAddress(a = {}) {
  return {
    line1: v.str(a.line1, { name: 'Address', max: 200 }), line2: v.str(a.line2, { name: 'Address line 2', max: 200, required: false }),
    city: v.str(a.city, { name: 'City', max: 80 }), state: v.str(a.state, { name: 'State', max: 40 }), country: 'NG',
  };
}

/** Delivery choice → { method, label, address | storeSlug }, checked against the method's regions. */
export function parseDelivery(d = {}, rules, stores) {
  const method = rules.deliveryMethods.find((m) => m.id === d.method);
  if (!method) fail(422, 'invalid', 'Please choose a delivery method.');
  if (method.id === 'store-pickup') {
    const st = stores.find((s) => s.slug === d.storeSlug);
    if (!st) fail(422, 'invalid', 'Please choose a store for collection.');
    return { method: method.id, label: method.label, storeSlug: st.slug };
  }
  const address = parseAddress(d.address);
  if (!method.regions.includes('*') && !method.regions.includes(address.state)) fail(422, 'region', `${method.label} isn't available for ${address.state}. Please choose another delivery method.`);
  return { method: method.id, label: method.label, address };
}

import { fail } from './http.mjs';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function str(v, { name, min = 0, max = 200, required = true } = {}) {
  if (v == null || v === '') { if (required) fail(422, 'invalid', `${name} is required.`); return ''; }
  if (typeof v !== 'string') fail(422, 'invalid', `${name} is invalid.`);
  const s = v.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (required && !s) fail(422, 'invalid', `${name} is required.`);
  if (s.length < min) fail(422, 'invalid', `${name} must be at least ${min} characters.`);
  if (s.length > max) fail(422, 'invalid', `${name} is too long.`);
  return s;
}

export function email(v, name = 'Email') {
  const s = str(v, { name, max: 254 }).toLowerCase();
  if (!EMAIL.test(s)) fail(422, 'invalid', 'Please enter a valid email address.');
  return s;
}

export function phone(v, { required = true } = {}) {
  const s = str(v, { name: 'Phone', max: 24, required });
  if (s && !/^\+?[0-9 ()-]{7,20}$/.test(s)) fail(422, 'invalid', 'Please enter a valid phone number.');
  return s;
}

export const bool = (v) => v === true || v === 'true' || v === 'on';

export function oneOf(v, list, name) {
  if (!list.includes(v)) fail(422, 'invalid', `${name} is invalid.`);
  return v;
}

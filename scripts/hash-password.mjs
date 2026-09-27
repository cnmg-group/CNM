// Usage: node scripts/hash-password.mjs 'password'   → scrypt hash for "passwordHash" in ADMIN_USERS
//        node scripts/hash-password.mjs --pin 123456 → scrypt hash for "pinHash" (6 digits)
import { hashPassword } from '../netlify/lib/crypto.mjs';
const pin = process.argv[2] === '--pin';
const secret = process.argv[pin ? 3 : 2];
if (pin ? !/^\d{6}$/.test(secret || '') : !secret || secret.length < 12) { console.error(pin ? 'Provide a 6-digit PIN.' : 'Provide a password of at least 12 characters.'); process.exit(1); }
console.log(await hashPassword(secret));

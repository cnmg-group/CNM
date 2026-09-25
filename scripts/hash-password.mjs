// Usage: node scripts/hash-password.mjs 'password'  → prints an scrypt hash for ADMIN_USERS
import { hashPassword } from '../netlify/lib/crypto.mjs';
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error('Provide a password of at least 12 characters.'); process.exit(1); }
console.log(await hashPassword(pw));

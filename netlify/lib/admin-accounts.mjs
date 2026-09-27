// Admin accounts shipped with the site. Only scrypt hashes live here — never passwords or PINs.
// Accounts in the ADMIN_USERS environment variable (Netlify) take precedence over these for the same email,
// so a password or PIN can be rotated without a code change: node scripts/hash-password.mjs '<new secret>'.
// Sign-in for every account: email + password → 6-digit code emailed to the account → PIN.
export const BOOTSTRAP_ADMINS = [
  {
    email: 'gabeth.ai4@gmail.com',
    name: 'Gabeth',
    role: 'owner',
    passwordHash: 'scrypt$16384$Lqm0zm4mIxdV7CEdCVcOCg==$/53BJb7cAgFhuWo0h/2zucgco6Q/IysWr3Uk9zf5cXijd1QoLVfvDHMzsaOyYWjdknUMCtPRe+knfjN3qPe+aQ==',
    pinHash: 'scrypt$16384$FCGuXu3Wf5+r/bWf7+CDwA==$sMgezmTexidStSJKfLbTi6zD93b4fEBRCuSoT/3r3QTbwiSibl74XraJ17WFCCnTsGBsiVg6sgwghKQ6P25ZVQ==',
  },
];

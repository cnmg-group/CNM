# Architecture

```
                 ┌──────────────── Netlify CDN ────────────────┐
 Browser ──────▶ │ dist/  static HTML per page (SEO), hashed JS/CSS, fonts, JSON │
 iOS/Android ──▶ │ /api/*  Netlify Functions (Node 22)                         │
                 └───────────────┬─────────────────────────────┘
                                 │
                 Netlify Blobs (users, orders, leads, config, media, events, audit)
                                 │
            Paystack (payments, webhook) · Resend (email) · Expo Push · GA4
```

## Why this shape

- **Static-first rendering.** Every indexable page is pre-rendered HTML (`scripts/build.mjs`), so TTFB and LCP come straight from the CDN, and crawlers see complete content, canonicals and JSON-LD without executing JavaScript.
- **Small client.** The main module is about 6 KB; page behaviour (filters, PDP, checkout, account) is code-split and loaded only where needed. There is no framework runtime.
- **Server-authoritative commerce.** `src/shared/pricing.mjs` is shared by the browser (instant estimates) and the functions. The server recomputes every quote and order from the catalogue plus live admin overrides and never trusts client prices.
- **Minimal dependencies.** Runtime: `@netlify/blobs`. Build: `esbuild`, `marked`, and fonts from `@fontsource`. Tests: `@playwright/test`.
- **Headless-ready.** The catalogue is plain JSON (`content/`). The importer can pull CNM's existing Shopify or WooCommerce store. If CNM chooses Shopify as the long-term commerce engine, `netlify/lib/catalogue.mjs` and `checkout.mjs` are the only modules to swap for Storefront API calls (cart → Shopify checkout). The UI and SEO layers stay unchanged.

## Code map

| Path | Purpose |
| --- | --- |
| `content/` | CMS source of truth (products, categories, stores, story, services, commerce rules, articles) |
| `src/shared/` | Isomorphic modules: pricing, search, product helpers, formatting, card markup, icons |
| `src/templates/` | Page templates (layout, home, listing, product, commerce, account, content) |
| `src/client/` | Browser modules: state, API client, loader, analytics, UI, page modules, admin SPA |
| `src/styles/` | Design system (`site.css`) and admin styles |
| `scripts/` | Build, dev server, catalogue/logo importer, screenshots, password hashing |
| `netlify/functions/` | API endpoints (`docs/API.md`) |
| `netlify/lib/` | Store adapter, sessions, crypto, HTTP/CSRF, validation, rate limiting, email, orders, Paystack |
| `mobile/` | Expo iOS/Android app (see `mobile/README.md`) |
| `tests/` | Unit/integration (`node --test`) and E2E (Playwright) |

## Data (Netlify Blobs stores)

| Store | Keys |
| --- | --- |
| `users` | `user/<id>`, `email/<sha256(email)>` → id |
| `orders` | `order/<number>`, `user/<uid>/<number>`, `ref/<paymentRef>` |
| `leads` | `enquiry/<id>`, `newsletter/<email>`, `bis/<productId>/<email>` |
| `config` | `inventory`, `discounts`, `content/<key>`, `secrets/session` |
| `tokens` | `reset/<sha256>`, `otp/<sha256(email)>` |
| `media` | `file/<key>` (admin uploads) |
| `events` | `daily/<date>` aggregate counters (no personal data) |
| `audit` | admin actions |
| `ratelimit` | fixed-window counters |

For higher order volumes (thousands of orders a day or complex reporting), move `orders` and `users` to Postgres (Netlify DB, Neon or Supabase) behind the same `netlify/lib/orders.mjs` interface.

## Loading and performance policy

- There are no artificial delays. The butterfly loader (`src/client/loader.js`) appears only when a request is still pending after **250 ms** and is removed the moment it resolves.
- Skeletons are used for client-rendered panels (bag, account); product grids are server-rendered.
- Budgets: main JS ≤ 15 KB gz, CSS ≤ 15 KB gz, LCP < 2.5 s on 4G, CLS < 0.05, INP < 200 ms. Images carry explicit dimensions; below-the-fold images are lazy-loaded.

## Security

- **Sessions:** HMAC-signed, HttpOnly, Secure, SameSite cookies (web) or bearer tokens (mobile). A `sessionVersion` supports "sign out everywhere" and invalidates sessions on password reset.
- **CSRF:** a custom header plus an Origin check on every state-changing cookie request.
- **Rate limiting** on auth, OTP, checkout, leads and admin login. **Validation** on every input. **Honeypot** on enquiries.
- **Passwords:** scrypt-hashed (N=16384). Unknown emails take the same time as wrong passwords, and reset and OTP requests never reveal whether an account exists.
- **Admin:** separate SameSite=Strict cookie; role-based permissions (owner, manager, fulfilment, editor) enforced server-side; allowed order-status transitions only; audit log.
- **Payments:** card data is entered only on Paystack's hosted page. The webhook is verified with HMAC-SHA512, the amount is checked against the order, and payment is marked idempotently.
- **Headers:** CSP, HSTS, `nosniff`, `frame-ancestors 'none'`, a restrictive Permissions-Policy, and noindex on staging.

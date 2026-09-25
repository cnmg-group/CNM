# CNM Essentials — API contract

All endpoints are Netlify Functions (v2) served from the same origin as the website.
JSON in, JSON out. Money is whole Naira (NGN) integers. Errors: `{ "error": "code", "message": "Human text" }` with a 4xx/5xx status.

## Clients and authentication

| Client | Auth transport | CSRF |
| --- | --- | --- |
| Web | `cnm_session` cookie (HttpOnly, Secure, SameSite=Lax, 30 days) | State-changing requests must send `X-CNM-Request: 1`; `Origin` must match the site when present |
| Mobile (iOS/Android) | `Authorization: Bearer <token>` | Not applicable (no ambient cookies). Send `X-CNM-Client: mobile` |

Login/register return `token` in the body **only** when the request carries `X-CNM-Client: mobile`. The web never sees the raw token.

Sessions are HMAC-SHA256 signed (`SESSION_SECRET`), stateless, and include a per-user `sessionVersion` so "log out everywhere" and password resets invalidate all sessions.

Rate limits (per IP, fixed window): auth 10/min, checkout 20/min, enquiry/newsletter 5/min, admin login 5/min. Exceeding returns `429`.

## Static data (built at deploy time)

- `GET /catalogue.json` — `{ generatedAt, currency, products[], categories[], collections[] }`. Product shape is `content/products.json` plus `url` and resolved `images[]` (`{ src, alt, placeholder }`).
- `GET /search-index.json` — search documents `{ type: product|category|collection|article|service|store, title, url, text, keywords[] }`.

## Catalogue

- `GET /api/catalogue/live` → `{ products: { [id]: { price, compareAt, stock, available } } }` — live price/stock overrides set in Admin. Clients merge this over `catalogue.json`.

## Auth — `/api/auth/*`

- `POST /api/auth/register` `{ email, password, firstName, lastName, marketingOptIn? }` → `{ user, token? }` (password ≥ 10 chars)
- `POST /api/auth/login` `{ email, password }` → `{ user, token? }`
- `POST /api/auth/logout` → `{ ok: true }`
- `GET /api/auth/me` → `{ user }` or `401`
- `POST /api/auth/reset-request` `{ email }` → `{ ok: true }` (always 200; never reveals whether an account exists)
- `POST /api/auth/reset-confirm` `{ token, password }` → `{ ok: true }`
- `POST /api/auth/otp-request` `{ email }` / `POST /api/auth/otp-verify` `{ email, code }` → passwordless sign-in (6-digit code, 10 minutes, 5 attempts)

`user` = `{ id, email, firstName, lastName, createdAt }`.

## Account — `/api/account/*` (auth required)

- `GET|PUT /api/account/profile` `{ firstName, lastName, phone }`
- `GET|PUT /api/account/addresses` `{ addresses: [{ id, label, firstName, lastName, phone, line1, line2, city, state, country, isDefault }] }`
- `GET|PUT /api/account/preferences` `{ email: { orders, newArrivals, backInStock, wishlist, events, promotions }, sms: {...}, push: {...} }` (order updates default on, marketing default off)
- `GET|PUT /api/account/wishlist` `{ items: [productId] }` — PUT merges when `?merge=1` (used on sign-in to merge guest wishlist)
- `GET /api/account/orders` → `{ orders: [OrderSummary] }`
- `GET /api/account/orders/:number` → `{ order }`
- `POST /api/account/push-token` `{ token, platform: "ios"|"android" }` (Expo push token)
- `POST /api/account/logout-all`

## Checkout

- `POST /api/checkout/quote` `{ items: [{ id, qty }], promoCode?, deliveryMethod? }` → `{ lines, subtotal, discount, delivery, vat, total, currency, promo: { code, valid, message }, deliveryMethods }`
  Totals are always recomputed on the server from the catalogue plus live overrides. Client prices are never trusted.
- `POST /api/checkout` `{ items, contact: { email, phone, firstName, lastName }, delivery: { method, address? , storeSlug? }, promoCode?, notes? }`
  → `{ order: { number, accessToken, total, status }, payment: { mode: "paystack"|"simulated", authorizationUrl?, reference } }`
- `POST /api/payments/simulate` `{ number, accessToken, outcome: "success"|"failure" }` — only when no payment secret is configured (staging).
- `GET /api/payments/verify?reference=` — confirms a Paystack payment on return from the hosted page.
- `POST /api/payments/paystack-webhook` — Paystack webhook, verified with `x-paystack-signature` (HMAC-SHA512 of the raw body).
- `GET /api/orders/:number?token=<accessToken>` → `{ order }` (guest order lookup for the confirmation page).

Order statuses: `pending_payment → paid → processing → dispatched → delivered`, or `payment_failed`, `cancelled`, `refunded`.

## Leads

- `POST /api/enquiry` `{ name, email, phone?, company?, sector, eventDate?, location?, message, consent: true }`
- `POST /api/newsletter` `{ email, consent: true, source? }`
- `POST /api/back-in-stock` `{ email, productId }`

## Admin — `/api/admin/*`

Separate `cnm_admin` cookie. Roles: `owner` (everything), `manager` (catalogue, content, orders, customers, discounts), `fulfilment` (orders only), `editor` (content, SEO, stores). Admin users are defined in the `ADMIN_USERS` env var (see `.env.example`).

- `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`, `GET /api/admin/orders/:number`, `PATCH /api/admin/orders/:number` `{ status, note }`
- `GET /api/admin/customers`
- `GET /api/admin/enquiries`, `PATCH /api/admin/enquiries/:id` `{ status }`
- `GET /api/admin/subscribers`
- `GET|PUT /api/admin/inventory` `{ products: { [id]: { price?, compareAt?, stock?, available? } } }`
- `GET|PUT /api/admin/discounts`
- `GET|PUT /api/admin/content/:key` — `homepage`, `seo`, `redirects`, `stores`, `announcements`
- `POST /api/admin/publish` — triggers the Netlify build hook so content edits are re-rendered statically
- `GET /api/admin/analytics` — funnel from first-party events
- `POST /api/events` (public) — first-party analytics beacon `{ name, params }`

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

Rate limits (per IP, fixed window): auth 10/min, checkout 20/min, enquiry/newsletter 5/min, admin login 5/min, scent finder 8/min. Exceeding returns `429`.

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
- `POST /api/auth/otp-request` `{ email }` → `{ ok, expiresInMinutes, resendAfterSeconds }` (429 `otp_cooldown` within 60 s). Works for any email.
- `POST /api/auth/otp-verify` `{ email, code, firstName?, lastName? }` → `{ user, token?, isNew, needsProfile }`. Creates the account on first sign-in. 6-digit code, 10 minutes, single use, 5 attempts. This is the **default** sign-in.

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
  The quote also returns `payment: { provider: "paystack"|"simulated", testMode, methods: [{ id, label, detail }] }`.
- `POST /api/checkout` `{ items, contact: { email, phone, firstName, lastName }, delivery: { method, address? , storeSlug? }, paymentMethod?: "card"|"bank_transfer"|"ussd", promoCode?, notes? }`
  → `{ order: { number, accessToken, total, status }, payment: { mode: "paystack"|"simulated", method, testMode, authorizationUrl?, reference } }`
  `paymentMethod` defaults to `card` and opens Paystack on that channel. A live Paystack key is only used on the approved production deploy.
- `POST /api/payments/simulate` `{ number, accessToken, outcome: "success"|"failure" }` — only when no payment secret is configured (staging).
- `GET /api/payments/verify?reference=` — confirms a Paystack payment on return from the hosted page.
- `POST /api/payments/paystack-webhook` — Paystack webhook, verified with `x-paystack-signature` (HMAC-SHA512 of the raw body).
- `GET /api/orders/:number?token=<accessToken>` → `{ order }` (guest order lookup for the confirmation page).

Order statuses: `pending_payment → paid → processing → dispatched → delivered`, or `payment_failed`, `cancelled`, `refunded`.

## Leads

- `POST /api/enquiry` `{ name, email, phone?, company?, sector, eventDate?, location?, subject?, division?: "group"|"essentials"|"spectra"|"cnmworx"|"foundation", interest?, timeline?, message, consent: true }`
- `POST /api/newsletter` `{ email, consent: true, source? }`
- `POST /api/back-in-stock` `{ email, productId }`

## Scent finder

- `POST /api/recommend` `{ families?: string[], room?, moods?: string[] (max 3), budget?: "any"|"u15"|"u20"|"u35", notes?: string (≤280) }`
  → `{ source: "ai"|"rules", model?, fallback?, summary, tip, picks: [{ id, reason }] }` (max 4 picks, always real, in-stock, in-budget products).
  Vocabularies are in `src/shared/scent-match.mjs`. The AI path runs through the Netlify AI Gateway; see `docs/INTEGRATIONS.md`.

## Admin — `/api/admin/*`

Separate `cnm_admin` cookie. Roles: `owner` (everything), `manager` (catalogue, content, orders, customers, discounts), `fulfilment` (orders only), `editor` (content, SEO, stores). Admin users are defined in the `ADMIN_USERS` env var (see `.env.example`); add `"companies": ["spectra"]` to an entry to limit that person to specific companies. Full platform spec: [ADMIN-OS-SPEC.md](ADMIN-OS-SPEC.md).

- Sign-in, in order (each step needs the previous one; a short-lived signed `cnm_admin_step` cookie carries progress and grants nothing by itself):
  1. `POST /api/admin/login` `{ email, password }` → emails a 6-digit code (10 minutes) → `{ step: "otp", email (masked) }`
  2. `POST /api/admin/login/otp` `{ code }` → `{ step: "pin" }` (5 tries, then start again); `POST /api/admin/login/resend` sends a new code (30 s apart)
  3. `POST /api/admin/login/pin` `{ pin }` → sets the `cnm_admin` session → `{ admin }` (5 tries, then start again)
  Session length: by default the cookie ends when the browser closes (and the token after 12 h); with `remember: true` on step 1 ("Keep me signed in") it lasts 24 hours — never longer. "Remember my login details" is client-side only: the email is kept in `localStorage` (`cnm.admin.remember`) until the admin presses Forget, and the password is offered to the browser's password manager; the page never stores a password.
  Every success and failure is written to the audit log. Without email configured a deployed site refuses to sign in (`email_not_configured`) rather than skip the code.
- `POST /api/admin/logout`, `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/command?from=YYYY-MM-DD&to=YYYY-MM-DD&compare=previous|year|none&company=all|<id>&location=all|<state>&channel=all|web|app|manual|pos`: CNM Group OS Command Center (KPIs with deltas, ops, attention, series, per-company roll-up, locations, channels, top sellers/viewed/trending, low stock, live feed). Company-scoped admins get only their companies; others return 403.
- `GET /api/admin/pulse`: live-update change stamp (poll every ~20 s; refetch `command` when it changes).
- `GET /api/admin/companies`, `POST /api/admin/companies` (owner; send an `Idempotency-Key` header), `PATCH /api/admin/companies/:id` (edit fields, `status: archived|active`). Every change is audited with before and after.
- `GET /api/admin/audit`: last 300 audit entries (owner, manager).
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


## Operations — `/api/ops/*` (CNM Group OS, phase 1)

Admin session + `X-CNM-Request` header, like `/api/admin/*`. Any role with orders access can read orders and move deliveries. Only owners and managers can refund, record payments, create manual orders, cancel paid orders or edit couriers; only owners can change settings. Company-scoped admins only see their companies (others return 404). Every change is audited. Creates and refunds accept `Idempotency-Key`.

- `GET /api/ops/orders?q&status=all|open|<status>&company&channel&payment&location&shipment&from&to&exception=1&limit&cursor`: `{ orders, total, next, counts, exceptions, locations, couriers }`. `q` matches order number, name, email, phone (any format), product, tracking number or RMA. Pages are keyset (`cursor` = the previous `next`).
- `GET /api/ops/orders/export?…`: CSV of the filtered orders (audited).
- `POST /api/ops/orders`: manual order `{ items, contact, delivery, paymentMode: paid|link|unpaid, paymentMethod, paymentReason, channel: manual|pos, promoCode?, note? }`.
- `POST /api/ops/orders/bulk`: `{ action: "pack", numbers: [...] }`.
- `GET /api/ops/orders/:number`: order + timeline + customer summary + refunds + allowed actions + seller details for documents.
- `POST …/notes` `{ text }` · `PATCH …/address` `{ address }` (before hand-over) · `POST …/resend` `{ kind: confirmation|status }` · `POST …/mark-paid` `{ method, reason }` · `POST …/cancel` `{ reason }`.
- `PATCH …/shipment` `{ courier, trackingNumber, eta, promisedBy }` · `POST …/shipment` `{ status, note?, pod?: { recipient, note, photoUrl }, rescheduleTo? }`.
- `POST …/exception` `{ kind, note }` · `PATCH …/exception` `{ resolution }`.
- `POST …/refunds` `{ amount, reason, note?, rma? }` → issued at once below the approval threshold, otherwise `requested` · `POST …/refunds/:id/approve` (a different manager) · `POST …/refunds/:id/reject` `{ reason }`.
- `POST …/returns` `{ lines: [{ id, qty }], reason, kind: refund|exchange|store_credit, note? }` · `POST …/returns/:rma` `{ status: approved|rejected|received|inspected|exchanged|credited, note?, restock? }`. A refund with `rma` completes the return.
- `GET /api/ops/fulfilment`: board columns by delivery stage, open exceptions, 30-day delivery performance (success, first attempt, on time, average and p90 time, by courier and state).
- `GET/PUT /api/ops/couriers` · `GET/PUT /api/ops/settings` `{ refundApprovalThreshold }`.

### Courier webhook — `POST /api/couriers/:courier/webhook`

Header `X-CNM-Signature` = hex HMAC-SHA256 of the raw body with `COURIER_WEBHOOK_SECRET_<COURIER_ID>` (e.g. `COURIER_WEBHOOK_SECRET_GIG`). Body `{ event_id, order_number | tracking_number, status, at?, note?, recipient?, eta? }`. The same `event_id` is only applied once, and couriers may skip forward stages.

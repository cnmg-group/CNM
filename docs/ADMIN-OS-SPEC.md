# CNM Group OS — admin platform specification

**What it is:** the operating system for CNM Group and every company under it (CNM Essentials, CNM Spectra, CNMWorX, CNM Foundation, and any added later). One sign-in shows, for the whole group or any single company:

- what is happening right now;
- what has been sold, who bought it, and where it is;
- what is pending, delayed or trending;
- which companies and products need attention.

**Status legend:**
- ✅ built and tested in this repository
- 🟡 partly built (the current single-shop admin covers it, not yet multi-company)
- ⬜ specified here and not yet built

| Area | Status | Where |
|---|---|---|
| Command Center (KPIs, comparisons, filters, trends, attention, live feed) | ✅ | `netlify/lib/metrics.mjs`, `src/client/admin/os.js` |
| Multi-company registry (create / edit / archive, logo, colour, domains, currency, payments, delivery, company admins, scoped access) | ✅ | `netlify/lib/companies.mjs`, `#companies` |
| Audit log with before → after, IP, device | ✅ | `admin.mjs` `audit()`, `#audit` |
| Idempotency keys on creates | ✅ | `netlify/lib/idempotency.mjs` |
| Live updates without reload (change-stamp polling) | ✅ | `/api/admin/pulse` |
| App shell (grouped, collapsible sidebar, mobile drawer, URL-driven filters) | ✅ | `src/client/admin/admin.js`, `src/styles/admin.css` |
| **Phase 1 operations:** orders search/filters/pages/bulk/CSV, order page (timeline, customer LTV, staff notes, address edit, resend, cancel, record payment), manual orders, invoices & packing slips (A4 print/PDF) | ✅ | `netlify/functions/ops.mjs`, `netlify/lib/ops.mjs`, `src/client/admin/ops.js` |
| **Phase 1 delivery:** shipments (courier, tracking, ETA, promised-by, attempts, reschedule, proof of delivery), delivery exceptions, fulfilment board, delivery performance, signed idempotent courier webhooks, configurable couriers | ✅ | `#fulfilment`, `/api/couriers/:id/webhook`, `#ops-settings` |
| **Phase 1 returns & refunds:** RMA (request → approve → receive → inspect/restock → refund/exchange/credit), partial refunds, second-approver threshold, manual-payment refunds | ✅ | order page |
| Products & inventory overrides, discounts, homepage/banners, stores, SEO, media, analytics funnel, subscribers, enquiries | 🟡 | existing admin views |
| Relational schema for every module below | ✅ (design, validated on Postgres 16) | `docs/schema/cnm-os.sql` |
| Everything else in §§5–6, 10–17 | ⬜ | this document |

---

## 1. Principles

1. **One group, isolated companies.** Every tenant record carries `company_id`. A company admin only ever sees their own company. Group roles see roll-ups across companies. Isolation is enforced server-side: API scope today, Postgres Row Level Security later. It never relies on the UI.
2. **Numbers finance can sign.** Every metric has one written definition (§3.2), computed in one place (`metrics.mjs`, later SQL rollups). Money is stored as integer minor units. The day boundary is Africa/Lagos.
3. **Attention first.** The first screen answers "what needs me now?" before it answers "how are we doing?".
4. **Nothing sensitive without a trace.** Every state change that touches money, stock, access or customer data writes an audit entry with before and after values.
5. **Safe to retry.** Every create and money movement accepts an `Idempotency-Key`.
6. **Fast by construction.** Dashboards read pre-aggregated rollups, never raw tables (§12).
7. **Calm, premium UI.** Navy and gold for CNM Group, each company's own colour inside its views, no gratuitous motion, and it works on a phone.

---

## 2. Information architecture

**Sidebar:** grouped, collapsible to an icon rail (remembered per browser); a slide-out drawer on phones.

| Section | Items |
|---|---|
| Overview | Command Center, Companies |
| Commerce | Orders, Products & catalogue, Inventory, Customers, Carts & wishlists, Reviews, Returns & refunds, Leads & enquiries |
| Operations | Fulfilment queue, Deliveries & couriers, Pickup points & locations |
| Finance | Transactions, Settlements & reconciliation, Taxes & fees, Reports |
| Growth | Promotions & coupons, Bundles & flash sales, Referrals, Campaigns, Notifications |
| Content | Homepage & banners, Pages, Navigation, Media, SEO |
| Insights | Analytics, Funnels, Cohorts & retention, Scheduled reports |
| Settings | Staff & roles, Audit log, Security & sessions, Risk rules, Integrations |

**Global controls** (top of every data view), all stored in the URL so any view can be bookmarked or shared:

- **Company:** "All companies", or one company. A company-scoped admin only sees their companies.
- **Period:** Today, 7 days, 30 days, 90 days, Year to date, 12 months, or Custom.
- **Compare:** previous period, same period last year, or off.
- **Location:** state or pickup location.
- **Channel:** web, app, manual/phone, POS, or marketplace.

---

## 3. Command Center ✅

### 3.1 Layout (desktop; phone stacks the same order)

1. **Header:** company chip, title, the period and the comparison period, and a live indicator (pulsing dot, "checked just now").
2. **Filter bar** (sticky), plus Export CSV.
3. **KPI tiles.** Each shows its value, a delta arrow (green or red, inverted for "bad" metrics) and the previous value:
   - Revenue (hero tile)
   - Net sales
   - Gross sales
   - Orders
   - Average order
   - Active users
   - Conversion
   - Delivered
   - Failed deliveries
   - Refunds
4. **"Right now" strip.** Operational state as of now, whatever the period. Each tile links to a filtered list, and late or empty-stock tiles get an amber underline.
   - Awaiting payment
   - To fulfil
   - In transit
   - Late to dispatch
   - Delivery overdue
   - Low stock
   - New leads
5. **Revenue trend:** the current period as a solid line with a gradient fill, and the comparison as a dashed line aligned by day. Hover or focus shows a tooltip, and there's a table fallback.
6. **Needs attention:** ranked high → medium → low, each item with its company and a deep link.
7. **Companies table:**
   - Columns: logo, revenue, change, share bar in brand colour, orders, active users, leads, attention count, sparkline.
   - Clicking a row drills into that company.
   - Archived companies leave the table but still count in totals.
8. **Gross vs net:** daily stacked bars, plus a sales bridge (gross − discounts − refunds = net; delivery; VAT).
9. **Funnel:** active users → product views → add to bag → checkout → payment → purchase → delivered, with the step-to-step rate.
10. **Top sellers** (revenue, units), **Most viewed** (views, view→purchase rate), **Trending** (units vs the comparison period).
11. **Where orders go** (by state), **Channels**, **Low stock**, and a **Live activity** feed (orders, payments, status changes, leads).

### 3.2 Metric definitions (single source: `metrics.mjs`)

| Metric | Definition |
|---|---|
| Gross sales | Merchandise subtotal of **paid** orders placed in the period (before discounts, excluding delivery) |
| Discounts | Promotion discounts on those orders |
| Refunds | Money returned in the period (partial refunds count the refunded amount), by refund date |
| Net sales | Gross − discounts − refunds |
| Revenue | Money collected: order totals (incl. delivery, VAT-inclusive) of paid orders − refunds |
| Orders / AOV | Paid orders placed in period; AOV = collected ÷ orders |
| Active users | Sum of daily active browsers: one cookie-less beacon per browser, per company, per Lagos day. No identifiers are stored. |
| Conversion | Paid orders ÷ active users |
| Delivered | Orders whose delivered event falls in the period |
| Failed deliveries | Orders with a `delivery_failed` event in the period (from courier webhooks, §8) |
| Leads | Enquiries, appointment requests, proposal requests and pledges created in the period |

"Paid" means any of paid, processing, dispatched, delivered, or refunded.

**Comparison:**
- *Previous period* is the same number of days immediately before.
- *Same period last year* shifts the dates back one year; 29 Feb maps to 28 Feb.

**Delta:** (current − previous) ÷ previous. If there is no base, it shows "New"; if both are zero, it shows "—".

### 3.3 Attention rules (SLA defaults, per-company overridable in `companies.settings.sla`)

| Rule | Severity | Default |
|---|---|---|
| Paid but not dispatched | high | > 48 h |
| Dispatched but not delivered | high | > 5 days |
| Out of stock | high | available = 0 |
| Low stock | medium | ≤ reorder point (default 5) |
| Lead waiting for a reply | medium | new > 24 h |
| Awaiting payment | low | > 24 h |
| Payment failures in period | low | ≥ 1 |
| ⬜ Delivery exception open | high | any |
| ⬜ Refund awaiting approval | medium | > 24 h |
| ⬜ Risk review pending | high | any |
| ⬜ Settlement discrepancy | high | ≠ 0 |
| ⬜ Revenue drop | medium | company revenue −30% vs comparison with ≥ 10 orders |

### 3.4 Live updates ✅ (now) → ⬜ push (at scale)

**Now:**
- The dashboard polls `GET /api/admin/pulse` every 20 s, only while the tab is visible.
- The pulse returns a change stamp built from the latest order or lead update. The full Command Center is refetched only when the stamp changes, which keeps scroll position and flags "New activity".
- Cost is about 1 small request per open dashboard every 20 s.

**At scale:** state changes write to an `outbox` table in the same transaction. A worker publishes each change to Supabase Realtime (or Ably/Pusher) channels scoped by company (§10). The client patches tiles and the feed in place. Polling remains the fallback.

---

## 4. Multi-company management ✅ (registry) / ⬜ (per-company settings pages)

**Fields:**
- id (slug, immutable)
- name
- business type: retail, services, engineering, nonprofit, marketplace or digital
- status: active or archived
- logo
- brand colour (hex)
- currency
- domains
- payment methods, from card, bank transfer, USSD, cash on delivery, pay in store and invoice
- delivery options, from Lagos standard/express, Abuja standard, nationwide, pickup, on-site service and none
- company admins (emails)

**Coming ⬜:** legal name, RC number, tax ID, timezone, invoice footer, SLA overrides and feature flags.

**Behaviour:**
- **Create:** super admin only (`companies` permission). Uses an idempotency key, so a double-click or retry never creates two companies. Duplicate ID or name returns 409. All input is validated: hex colour, known payment and delivery IDs, domain format, emails.
- **Edit:** only changed fields are applied. The audit entry lists `changed`, `before` and `after`.
- **Archive / restore:** data is kept and still counts in historical reports. The company leaves day-to-day lists.
- **Scope:**
  - Owners see all companies.
  - Other staff are limited to the companies listed on their account (`ADMIN_USERS[].companies`, carried in the signed session) plus any company that lists their email as a company admin.
  - A scoped request for another company returns 403.
- ⬜ **Domain verification** (DNS TXT); a per-company storefront theme, generated from the brand colour and logo.
- ⬜ **Payment-provider credentials:** stored encrypted per company (`company_payment_methods.config`), never returned to the browser.

---

## 5. Products & catalogue ⬜ (🟡 overrides exist)

- **Entities:** product → variants (SKU, barcode, options, price, compare-at, cost, weight) → media; categories (tree); brands; tags; flags (new, bestseller, limited, exclusive, price needs approval).
- **Lifecycle:** draft → scheduled (`launch_at`) → active → archived. Delete is only allowed if the product has never been ordered; otherwise it is archived.
- **Scheduled price changes** use `price_schedules`. The active price is resolved at checkout on the server.
- **Bulk import and export:**
  - CSV or XLSX, with a template per company.
  - The dry run validates everything and shows a diff: create / update / skip / error per row.
  - Applying the import is one idempotent job with progress. Errors come back as a downloadable CSV.
  - Export uses the current filters.
- **Per-product analytics:** views, add-to-carts, units, revenue, conversion (views → purchase), return rate, days of stock left. There's a "top sellers / top viewed / trending / slow movers" board.
- **Media:** drag-drop upload, automatic WebP/AVIF, 1000 px and 2000 px renditions, required alt text, focal point.

## 6. Inventory ⬜ (🟡 single stock number per product)

- **Levels** are kept per variant × location: on hand, reserved, incoming, reorder point. Available = on hand − reserved.
- **Reservations:**
  - A reservation is taken when payment starts.
  - It is released on failure or after 30 min.
  - It is consumed on dispatch.
- **Movement ledger:** every change is an `inventory_movements` row (receive, sale, reserve, release, return, adjust, transfer, count), with reason and actor. On-hand is always ledger-consistent.
- **Transfers:** draft → in transit → received. Stock is deducted at send and added at receipt.
- **Adjustments** require a reason; adjustments above a threshold need a second approver.
- **Low-stock alerts:** a Command Center attention item plus an email or push to the company's ops role. Also shows days of cover from the 28-day sales rate.
- **Stock counts:** cycle counts by location, variance report, one-click adjust.

## 7. Orders ✅ (phase 1)

**Statuses:**
pending payment → paid → processing → ready → dispatched → delivered

Side branches:
- payment failed
- cancelled
- returned
- refunded
- partially refunded

Allowed transitions are enforced server-side, with a table like the current `TRANSITIONS`.

- **List:**
  - Search by order number, name, email, phone, SKU or tracking number.
  - Filters: company, status, channel, location, payment method, date, risk, has exception.
  - Saved views, bulk actions (print packing slips, mark ready, export).
- **Detail:**
  - Timeline (order events + shipment events + payments + notes).
  - Customer card with LTV, items, payment, delivery, risk flags, internal notes.
  - Actions: edit address (before dispatch), resend confirmation, cancel, refund (full or partial), create a return or exchange.
- **Documents:** invoice (company logo, legal details, VAT) and packing slip, as PDF, printable. The customer receipt slip is already live on the storefront.
- **Manual orders:** staff create an order for phone, WhatsApp or showroom sales (channel `manual`), with `placed_by_staff`, a payment link or mark-as-paid (with a reason), and an idempotency key.

## 8. Delivery & logistics ✅ (phase 1; courier API adapters per courier once CNM chooses them)

**Shipment statuses:**
awaiting fulfilment → packed → handed over → in transit → out for delivery → delivered

Also: failed attempt, rescheduled, returned to sender, lost.

- **Courier integrations** (adapter interface like `payments/`): GIG Logistics and dispatch riders booked per delivery (paid manually, cost recorded per shipment) are live; DHL, Kwik, Sendbox can be added later.
  - Create waybill, get label, track.
  - Status webhooks are signature-verified and written to `shipment_events`.
- **Tracking:** tracking number and link, ETA, promised-by date, attempts, proof of delivery (photo, signature, recipient, GPS).
- **Exceptions:** open → assigned → resolved. Resolutions include reschedule, change address, return, or refund. Exceptions feed Attention.
- **Pickup points:** locations of kind `pickup_point`, with opening hours and "ready for collection" notices.
- **KPIs:** delivery success rate (delivered ÷ (delivered + failed + returned)), average and p90 time from payment to delivery, on-time rate vs promised date, per courier and per state.

## 9. Returns, refunds, exchanges ✅ (phase 1; exchanges and store credit are recorded, automatic replacement orders and a store-credit wallet are next)

- **Returns (RMA):**
  1. The customer or staff requests a return, with a reason (damaged, wrong item, not as described, changed mind, other).
  2. It is approved or rejected, then moves through in transit → received → inspected.
  3. It is resolved as a refund, an exchange order or store credit.
- **Refunds:** full or partial. They always go through the payment provider first; the order is only marked refunded on success, as today. Refunds above a threshold need a second approver. Reasons are required.
- **Reporting:** return rate by product and by reason, refund value, time to resolve.

## 10. Customers ⬜ (🟡 list)

- **Identity:** one group-level customer (email / phone), with a per-company relationship (`customer_companies`) that holds first and last order, order count, LTV, notes and segment.
- **Profile:**
  - orders across the companies the viewer may see;
  - addresses, marketing consents, reviews, wishlist, tickets;
  - notes (audited).
- **Segments:** rule builder, e.g. "LTV > ₦200k", "no order in 90 days", "bought diffusers", "Lagos". Segments are used by campaigns and exports.
- **Abandoned carts:** carts updated more than 1 h ago with no order. Recovery email/SMS at 1 h and 24 h, with recovered revenue tracked.
- **Wishlists:** most-wished products (demand signal), back-in-stock subscribers.
- **Reviews:** pending → published or rejected, with a moderation queue, profanity and PII filter, and a "verified purchase" badge.
- **Privacy (NDPR):** export and erase a customer on request (`erased_at`, PII removed, orders kept anonymised).

## 11. Marketing ⬜ (🟡 coupon codes)

- **Promotions:** coupon, automatic, bundle, flash sale (start/end with countdown), BOGO, free shipping.
  - Limits: total and per customer.
  - Rules are JSON (min subtotal, eligible products or categories, customer segment, channel).
- **Referrals:** codes per customer, reward rules, conversions.
- **Banners and campaigns:** schedule banners per company. Campaigns carry UTM tags; performance = sessions, orders and revenue attributed by UTM and coupon, against cost, giving ROAS.

## 12. Content management ⬜ (🟡 homepage hero, announcement bar, SEO, stores)

- **Blocks:** content blocks per page and slot, such as hero, banner, featured products, rich text, collection grid or promo strip.
- **Workflow:** draft → scheduled → published, with versions and one-click rollback.
- **Navigation** menus per company (header, footer, mobile).
- **Preview** as a shareable link before publishing. **Publish** triggers the site build hook (exists today).

## 13. Analytics & reporting ⬜ (🟡 funnel, searches)

- Traffic, the funnel of §3.1 per company, channel and campaign, DAU/MAU, retention cohorts (by first-order month), and acquisition channels (UTM / referrer).
- **Reports:** sales, products, inventory valuation, customers, delivery, returns, finance (§14), tax. Any table can be exported as CSV or XLSX.
- **Scheduled reports:** daily, weekly or monthly to a list of emails (e.g. "Monday group sales pack"), as a PDF summary plus a CSV.

## 14. Payments & finance ⬜

- **Transactions:** every payment attempt with provider, method, status, fee, net, and reference.
- **Settlements:** imported from Paystack (API + webhook).
  - Each payout is matched to transactions and refunds; unmatched items are flagged.
  - Settlements are marked reconciled, and any discrepancy is raised in Attention.
- **Taxes:** VAT 7.5% included (Nigeria), configurable per company and region, with a VAT report per period.
- **Fees:** provider fees and delivery costs vs delivery charged, giving a contribution margin per order (needs cost price per variant).
- **Downloadable reports:** sales ledger, refunds, settlements, VAT, and payouts per company or for the group.

## 15. Staff, permissions, security ⬜ (🟡 4 roles, env-managed accounts)

- **Roles:**
  - super admin (group)
  - group finance
  - company admin
  - operations
  - fulfilment
  - customer support
  - marketing
  - content editor
  - analyst (read-only)
- **Permissions** are granular, at `area.action` level (e.g. `orders.read`, `orders.refund`, `products.write`, `finance.export`, `staff.manage`).
- **Assignments** are `staff × company × role`. A null company means a group-wide grant.
- **Sign-in:** email plus password (argon2id or scrypt), then **2FA** — TOTP or passkeys (WebAuthn) — which is mandatory for roles with money or staff permissions.
- **Sessions:**
  - 12 h admin sessions, with re-authentication (step-up) for refunds, staff changes and exports.
  - A list of active sessions (device, IP, last seen), with revoke-one and revoke-all.
  - An alert on new-device sign-in.
- **Invitations** by email, with an expiring link. Suspending a user revokes their sessions immediately.
- **Hardening:**
  - rate limits per IP and per account;
  - CSRF header on every state change (exists);
  - `SameSite=Strict` admin cookie (exists);
  - IP allow-list option for super admins.

## 16. Notifications ⬜

- Templates per company, channel (email, SMS, push, WhatsApp), event and locale, with versions and a preview using sample data.
- **Events:**
  - order confirmed
  - payment failed
  - dispatched (with tracking)
  - out for delivery
  - delivered
  - delivery failed / rescheduled
  - return approved
  - refund issued
  - back in stock
  - abandoned cart
  - review request
- **Staff alerts:** new high-severity attention item, settlement discrepancy, and a daily summary.
- **Delivery log** (`notification_log`) with provider status, retries and a suppression list.

## 17. Risk & fraud (basic) ⬜

**Rules engine:** each rule has a condition, an action (flag, review or block) and a score. Starter rules:

- order value above 3× the company's AOV and a first-time customer;
- more than 3 failed payments from the same email or phone in 1 h;
- billing/shipping mismatch across states with express delivery;
- a disposable email domain;
- a velocity limit: more than 5 orders from one phone in 24 h;
- the address matches a previous chargeback.

**Handling:**
- Orders scored "review" are held from fulfilment and appear in Attention.
- Staff clear or confirm them; the decision is audited.
- Chargebacks (disputes) are tracked against payments.

---

## 18. Data model

The full table-level design is in [`docs/schema/cnm-os.sql`](schema/cnm-os.sql). It applies cleanly to PostgreSQL 16 (57 tables).

**Key relationships:**

```
companies ─┬─ company_domains / company_payment_methods / company_delivery_options
           ├─ brands, categories, locations (store | warehouse | pickup_point)
           ├─ products ─ product_variants ─┬─ inventory_levels (× location) ─ inventory_movements
           │                              └─ price_schedules
           ├─ orders ─┬─ order_lines, order_events
           │          ├─ payments ─ refunds ; settlements
           │          ├─ shipments ─ shipment_events, delivery_exceptions
           │          ├─ returns
           │          └─ risk_flags ← risk_rules
           ├─ customer_companies ─ customers ─ addresses, carts, wishlist_items, reviews
           ├─ promotions ─ coupon_codes ; referrals ; campaigns
           ├─ content_blocks, navigation, notification_templates, notification_log
           └─ events (partitioned) → daily_metrics, product_daily_metrics
staff ─ staff_company_roles ─ roles ─ role_permissions ─ permissions ; staff_sessions
audit_log (append-only, hash-chained) ; idempotency_keys ; outbox
```

**Today's storage:** records are JSON documents behind one `get/set/list` interface (`netlify/lib/store.mjs`), backed by Supabase `cnm_kv`, Netlify Blobs, or local files. Orders and leads already carry `companyId`; orders carry `channel`.

---

## 19. API

**Conventions:**
- REST + JSON under `/api/admin/*` (staff) and `/api/*` (storefront).
- Session cookie (`SameSite=Strict`) plus the `X-CNM-Request` CSRF header on every state change.
- Errors are `{ error: code, message, fields? }` with correct HTTP status codes (400, 401, 403, 404, 409, 422, 429, 502).
- **Pagination:** cursor based, `?limit=50&cursor=…`, returning `next_cursor`.
- **Filtering:** `?company=&status=&from=&to=&location=&channel=&q=`.
- **Sorting:** `?sort=-created_at`.
- **Idempotency:** `Idempotency-Key` header on every POST that creates or moves money (§21).
- **Versioning:** additive changes only; breaking changes go to `/api/admin/v2/*`.

**Endpoints:**

| Endpoint | Status |
|---|---|
| `GET /api/admin/me` (role, permissions, company scope) | ✅ |
| `GET /api/admin/command?from&to&compare&company&location&channel` | ✅ |
| `GET /api/admin/pulse` | ✅ |
| `GET/POST /api/admin/companies`, `PATCH /api/admin/companies/:id` | ✅ |
| `GET /api/admin/audit` | ✅ |
| `GET /api/admin/orders?status` | ✅ |
| `GET/PATCH /api/admin/orders/:number` (transitions, refunds) | ✅ |
| inventory, discounts, content, media, enquiries, customers, subscribers, analytics, publish | ✅ |
| `POST /orders` (manual), `POST /orders/:id/cancel`, `POST /orders/:id/refunds`, `GET /orders/:id/invoice.pdf`, `GET /orders/:id/packing-slip.pdf` | ⬜ |
| `products` CRUD, `POST /products/import` (dry-run + apply job), `GET /products/export` | ⬜ |
| `inventory/levels`, `inventory/movements`, `inventory/transfers`, `inventory/adjustments` | ⬜ |
| `shipments`, `shipments/:id/events`, `couriers/:id/webhook`, `exceptions` | ⬜ |
| `returns`, `refunds/:id/approve` | ⬜ |
| `customers/:id`, `segments`, `carts/abandoned`, `reviews` moderation | ⬜ |
| `promotions`, `campaigns`, `referrals` | ⬜ |
| `content/blocks`, `navigation` | ⬜ |
| `finance/transactions`, `finance/settlements`, `finance/reports/:type` | ⬜ |
| `staff`, `staff/:id/roles`, `sessions`, `sessions/:id/revoke`, `2fa/enroll` | ⬜ |
| `reports/scheduled` | ⬜ |
| `risk/rules`, `risk/flags` | ⬜ |

---

## 20. Real-time events

- **Topic naming:** `company.<id>.<entity>.<event>`, plus a `group.*` mirror for group roles.
- **Payloads** are small (id, number, status, amount, company, at). Clients refetch detail they are allowed to see.

**Topics:**

- `order.created`
- `order.paid`
- `order.status_changed`
- `order.cancelled`
- `payment.failed`
- `refund.requested`
- `refund.succeeded`
- `shipment.status_changed`
- `shipment.exception_opened`
- `inventory.low`
- `inventory.out`
- `inventory.adjusted`
- `lead.created`
- `review.submitted`
- `risk.flagged`
- `settlement.imported`
- `settlement.discrepancy`
- `company.updated`
- `staff.session_revoked`

**Transport:**
- *Now:* change-stamp polling (§3.4).
- *Next:* transactional outbox, then a worker, then Supabase Realtime channels authorised by the same company scope. Delivery is at-least-once, so events carry an id and clients de-duplicate.

## 21. Idempotency ✅

1. The client generates one UUID per user action (e.g. per opening of the "New company" form) and sends `Idempotency-Key`.
2. The server stores `{scope = actor + operation, key} → {fingerprint of body, status, response}` for 24 h.
3. **Same key + same body:** the stored response is returned (`replayed: true`) and the action is not repeated.
4. **Same key + different body:** 422 `idempotency_mismatch`.
5. **Required on:** create company, manual order, refund, bulk import apply, transfer, adjustment, and payment-link creation.
6. Payment webhooks are idempotent by provider reference; order paid-marking is already idempotent in `payments.mjs`.

## 22. Audit logging ✅ (entries) / ⬜ (hash chain, retention)

**Each entry records:**
- who: email and role
- action
- entity and id
- detail with `changed`, `before` and `after`
- IP and user agent
- time (ISO)

**Logged today:**
- order status changes and refunds
- inventory
- discounts
- content
- media
- publish
- enquiry status
- company create, update, archive and restore

**Next ⬜:**
- the request id;
- a `prev_hash` / `hash` chain so tampering is detectable;
- no update or delete grants;
- 7-year retention for finance actions, with export to cold storage;
- a UI filter by person, company, action or entity (search exists today) and CSV export (exists).

## 23. Performance & scalability

**Budgets:**
- Command Center API p95 < 400 ms.
- Page interactive < 2 s on 4G.
- List views p95 < 300 ms for 50 rows.
- Pulse < 50 ms.

**Today:** the Command Center computes over raw documents (972 demo orders + 400 days of traffic in about 0.3 s locally). That's fine to roughly 20k orders.

**At scale:**
- `daily_metrics` and `product_daily_metrics` are refreshed every 5 min, plus incrementally on `order.*` events. The dashboard reads at most 730 rows per company per metric.
- The raw `events` table is monthly-partitioned.
- There are covering indexes on `(company_id, created_at)` and on open-status partial indexes.
- List endpoints use keyset pagination.
- Responses are gzip. Company, role and permission lookups are cached for 60 s in function memory.
- Charts are SVG with no library (≈ 6 KB). The admin bundle is code-split per area.

## 24. UI/UX system & component list

**Tokens:**
- navy `#0b1120`
- gold `#d4b06a`
- canvas `#f6f4ef`
- card `#fff`
- line `#e7e3da`
- up `#1f7a45`
- down `#b3261e`
- warn `#b76e00`

Company accent colours come from the registry. Radius is 14 px, and numbers use tabular figures.

**Shell ✅:**
- `AppShell` (grid + collapsible `Sidebar` with sections, icons, active state, user card)
- `MobileTopBar` + `Drawer` + `Scrim`
- `Flash` (toast)
- `Skeleton` loading

**Filters ✅:** `FilterBar` containing:
- `CompanySelect`
- `PeriodSegment` (presets)
- `DateRange` (custom)
- `CompareSelect`
- `LocationSelect`
- `ChannelSelect`
- `ExportButton`

It syncs to the URL.

**Data display ✅:**
- `KpiTile` (value, delta, previous, hero variant)
- `OpsStrip` + `OpsTile` (warn state)
- `TrendChart` (current vs comparison, tooltip, table fallback)
- `Sparkline`
- `GrossNetBars` + `SalesBridge`
- `Funnel`
- `HBarList`
- `RankList`
- `CompanyTable` (drill-down rows)
- `AttentionList` (severity dots)
- `ActivityFeed`
- `LiveIndicator`
- `CompanyChip`
- `StatusPill`
- `EmptyState`

**Forms ✅:**
- `CompanyCard`
- `CompanyDialog` (colour picker + hex, checkbox groups, validation errors, idempotency key)
- `ConfirmAction`
- `AuditTable` + search

**Next ⬜:**
- `DataTable` (column chooser, bulk select, saved views, keyset pagination)
- `Timeline`
- `OrderDrawer`
- `InvoiceDocument` / `PackingSlip`
- `ImportWizard` (upload → map → dry-run diff → apply progress)
- `VariantMatrix`
- `MediaPicker`
- `StockLedger`
- `TransferForm`
- `ShipmentTracker`
- `ExceptionBoard`
- `ReturnFlow`
- `SegmentBuilder`
- `PromotionRuleBuilder`
- `BlockEditor` + `PreviewFrame`
- `ReportScheduler`
- `RoleMatrix`
- `SessionList`
- `TwoFactorEnroll`
- `RiskRuleEditor`
- `NotificationTemplateEditor`
- `CohortGrid`

**Accessibility:**
- Every chart has an `aria-label` and a table fallback.
- Full keyboard navigation (rows are focusable; Escape closes drawers and dialogs).
- Colour is never the only signal: arrows and labels accompany the green and red.
- Honours `prefers-reduced-motion`.

---

## 25. Delivery plan

1. **Foundation ✅:** Command Center, companies, scope, audit, idempotency, live updates, OS shell.
2. **Operations:**
   - orders v2 (list/detail, manual orders, invoices and packing slips)
   - shipments and one courier integration
   - exceptions
   - returns and partial refunds with approvals
3. **Catalogue & stock:**
   - products, variants and categories editor
   - bulk import/export
   - multi-location inventory ledger and transfers
4. **Finance:** transactions, Paystack settlements and reconciliation, VAT and finance reports.
5. **Customers & growth:** profiles, segments, abandoned carts, reviews, promotions v2, campaigns, notifications.
6. **Security & scale:**
   - staff in the database, 2FA and passkeys, session management
   - Postgres migration of hot tables with RLS
   - rollups and the outbox → Realtime
   - scheduled reports

The storage interface (`store.mjs`) allows migrating one module at a time.

**Migration of existing data:**
- Orders and leads already carry `companyId` (older records default to CNM Essentials and group).
- The import script maps `cnm_kv` documents into the relational tables.

## 26. Decisions needed from CNM

1. The legal name, RC number and VAT ID of each company (for invoices).
2. Which courier(s) to integrate first, and their API access.
3. The Paystack account structure: one account with subaccounts per company, or separate accounts.
4. Approval thresholds for refunds and stock adjustments.
5. The staff list and roles per company.
6. Whether CNM Spectra will sell online (products/checkout) or stay appointment-led.

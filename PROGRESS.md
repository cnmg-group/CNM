# CNM Essentials — progress register

Status key: **DONE** · **IN PROGRESS** · **BLOCKED** · **NEEDS CNM APPROVAL**

_Last updated: 2026-09-25_

## Blockers (need action from CNM)

| Item | Status | What's needed |
| --- | --- | --- |
| Audit of cnm-group.net, cnmessentials.com, Instagram and socials | **BLOCKED** | The build environment's network policy denies these hosts. Allow `cnmessentials.com`, `www.cnm-group.net` and `cdn.shopify.com` (if on Shopify) in the environment's network settings, **or** upload the assets. |
| Original CNM logo | **BLOCKED** | Supply the file, or run `node scripts/import-catalogue.mjs --logo <url-or-file>`. It is picked up automatically on every page, in the admin and emails. It is never redrawn. |
| Original products, prices, variants and photography | **BLOCKED** | Run `node scripts/import-catalogue.mjs --shopify https://cnmessentials.com` (or `--woo` / `--csv export.csv`). Until then, the 8 product names from CNM's Netlify prototype are shown with **demo** prices and stock, and illustrated placeholders. |
| Founder, company history, timeline, store addresses, hours, phones | **NEEDS CNM APPROVAL** | Enter via Admin → Stores and `content/story.json`. See `docs/CONTENT-APPROVAL.md`. |
| Payment provider and merchant account | **NEEDS CNM APPROVAL** | Paystack is integrated; add `PAYSTACK_SECRET_KEY`. |
| Delivery fees, regions, returns policy, VAT treatment | **NEEDS CNM APPROVAL** | `content/commerce.json`. |
| Apple and Google developer accounts, bundle ID `com.cnmessentials.app` | **NEEDS CNM APPROVAL** | See `mobile/README.md`. |

## Workstreams

| Phase | Item | Status |
| --- | --- | --- |
| Research | Brief analysis, UX references (Apple storytelling, Farfetch commerce) | DONE |
| Audit | Existing CNM assets (sites, social, photography) | **BLOCKED** (network) |
| Architecture | Static-first Netlify site + Functions + Blobs; headless-ready commerce layer | DONE (`docs/ARCHITECTURE.md`) |
| Design system | Tokens, type, grid, buttons, forms, cards, motion, approval slots (`/styleguide/`) | DONE |
| Landing | Cinematic home: hero → new in → home fragrance → oils → smart scent → body → featured → story → FaaS → stores → journal → newsletter | DONE (copy **NEEDS CNM APPROVAL**) |
| Commerce | Shop all, New in, Best sellers, 6 category pages, Stoneglow collection, Gifts | DONE |
| Commerce | Product cards (hover alternate image, wishlist, quick add, badges, stock) | DONE |
| Commerce | Instant filters with URL state; mobile bottom sheet; sorting | DONE |
| Commerce | Predictive search (typo-tolerant, recent/popular, zero-result recommendations) | DONE |
| Commerce | PDP: gallery + zoom + swipe, qty, stock, add/buy now, accordions, related, recently viewed, share, back-in-stock | DONE |
| Commerce | Wishlist: guest + account sync + merge on sign-in, move to bag, share | DONE |
| Commerce | Bag drawer + bag page, promo codes, delivery estimate, server-side totals | DONE |
| Commerce | Checkout Contact → Delivery → Payment → Review → Confirmation; Paystack + staging simulator; failure/retry | DONE |
| Commerce | Order numbers, confirmation email, order history, tracking status | DONE |
| Account | Register, sign in, email-code (OTP) sign-in, reset, profile, addresses, orders, preferences, sign out everywhere | DONE |
| Content | Our Story, Stores + store pages, Fragrance as a Service + enquiry, Journal + articles, CNM Group hub (Energy · Retail · Impact) | DONE (content **NEEDS CNM APPROVAL**) |
| Mobile | Expo iOS + Android app (tabs, shop, search, PDP, wishlist, bag, checkout, account, push, deep links, biometrics) | DONE (typecheck + 58 tests; not device-tested) |
| Mobile | App Store and Play Store submission | **NEEDS CNM APPROVAL** (accounts) |
| Admin | Dashboard, orders, customers, inventory/pricing, discounts, content/merchandising, stores, SEO/redirects, enquiries, subscribers, media, analytics, users/roles, audit log, publish | DONE |
| SEO | SSR/static HTML, canonicals, sitemap, robots, OG, breadcrumbs, Product/Breadcrumb/Organization/WebSite/Article/ItemList/Service JSON-LD, LocalBusiness (gated on verified NAP), Merchant feed (gated on approved prices) | DONE |
| SEO | Search Console, GA4, Merchant Center, Google Business Profiles | **NEEDS CNM APPROVAL** (account access) |
| Analytics | GA4 e-commerce events + consent + first-party funnel in admin | DONE |
| Notifications | Transactional email (Resend); push (Expo) with granular preferences; SMS preferences stored | DONE (email/push credentials **NEEDS CNM APPROVAL**; SMS provider not yet chosen) |
| Performance | Static HTML, 6 KB main JS, code-split pages, self-hosted fonts, immutable caching, lazy images, skeletons, delayed loader | DONE |
| Accessibility | Skip link, focus states, focus-trapped dialogs, labels, ARIA, reduced motion, keyboard search | DONE |
| Security | Signed HttpOnly sessions, CSRF, rate limits, validation, server-side pricing, RBAC, webhook HMAC, CSP/HSTS | DONE |
| Testing | 18 unit/integration tests, 23 Playwright E2E tests (desktop + mobile) | DONE (all passing) |
| Staging | Netlify config; staging is noindexed with a staging banner and payment simulator | DONE (deploy needs Netlify access, see `docs/DEPLOYMENT.md`) |
| Visual QA | 67 screenshots, desktop + mobile, `docs/visual-review/index.html` | DONE (re-run after real assets are imported) |
| Production | Connect cnmessentials.com | Waiting for final CNM approval |

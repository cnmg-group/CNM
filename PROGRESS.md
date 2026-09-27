# CNM Essentials — progress register

Status key: **DONE** · **IN PROGRESS** · **BLOCKED** · **NEEDS CNM APPROVAL**

_Last updated: 2026-09-27_

## Source of truth now in the build

CNM supplied screenshots of **cnmessentials.com** (home, shop, about) and **cnm-group.net** (about, companies, contact). From them the build now uses:

| Item | Status | Source |
| --- | --- | --- |
| Original CNM Essentials logo (header, footer, admin, favicon, structured data, app icon) | **DONE** | Crystal-clear vector (SVG) redraw of the original, matched against cnm-group.net, made with CNM's approval. Master artwork can still replace it. |
| CNM Group logo, CNM Spectra, CNMWorX and CNM Foundation logos | **DONE** | cnm-group.net |
| 20 products: names, product types, brands, prices (incl. kobo), photos | **DONE** | cnmessentials.com/shop. Photos enhanced about 3× with AI super-resolution; original files are still needed for full clarity. |
| Categories: Room & Home Fragrance, Diffusers & Refills, Body Care, Hair Care (+ Beverages, hidden until stocked) | **DONE** | cnmessentials.com |
| Campaign banners (Room & Home Fragrance, Diffusers & Refills, Body Care, Hair Care, Vitamin C Brightening Body Wash) | **DONE** | cnmessentials.com home |
| Store interior photograph | **DONE** | cnmessentials.com About. Which store it shows **NEEDS CNM APPROVAL**. |
| Store addresses, phone, email | **DONE** | cnmessentials.com footer. LocalBusiness schema is now published. |
| Hero, shop, about, newsletter copy and service promises | **DONE** | cnmessentials.com |
| Brand description, core activities, key products, Lease-to-Own Programme | **DONE** | cnm-group.net → CNM Essentials |
| CNM Group structure: Retail (Essentials, Spectra) · Energy (CNMWorX) · Impact (Foundation) | **DONE** | cnm-group.net |
| Brand palette (charcoal #23221e, sage #d3dbce, yellow #fbcc39) | **DONE** | Sampled from the original logo |

## Still needed from CNM

| Item | Status | What's needed |
| --- | --- | --- |
| Remaining catalogue (only page 1 of /shop was supplied), product descriptions, sizes, how-to-use | **NEEDS CNM APPROVAL** | Run `node scripts/import-catalogue.mjs --shopify/--woo/--csv` once the store export or network access is available, or send the remaining pages. |
| Stock levels | **NEEDS CNM APPROVAL** | Not shown on the live site. Set them in Admin → Products & inventory. |
| "Sun Kissed Vanilla": the live site says Bath & Body Works but the photo shows a Febreze pack | **NEEDS CNM APPROVAL** | Confirm the brand. |
| Body Care, Hair Care and CNM's own products (Vitamin C Brightening Body Wash, Rosemary hair & scalp oil) | **NEEDS CNM APPROVAL** | Prices and product pages; the category pages currently say "coming soon online". |
| Opening hours, map coordinates and photos for each store | **NEEDS CNM APPROVAL** | Admin → Stores |
| Founder biography; confirm the quote taken from the Lovable draft (portrait now supplied by CNM); dated milestones; rights to the Spectra/CNMWorX photos from the Lovable draft and a Foundation photo | **NEEDS CNM APPROVAL** | `content/site.json → group.founder`, `content/story.json` |
| Dedicated email/phone for CNM Spectra, CNMWorX and CNM Foundation | **NEEDS CNM APPROVAL** | Their forms currently go to the CNM Group inbox and Admin → Enquiries |
| Enable Netlify AI Gateway for the scent finder | **NEEDS CNM APPROVAL** | One switch in Netlify (see `docs/INTEGRATIONS.md` §5). It uses the rules matcher until then. |
| Instagram and WhatsApp links | **NEEDS CNM APPROVAL** | Icons exist on the live site; URLs not visible in the screenshots |
| Delivery fees, returns policy, VAT treatment, payment provider (the live site lists Visa, Mastercard and PayPal) | **NEEDS CNM APPROVAL** | `content/commerce.json`; Paystack is integrated and ready |
| Original product photo files | **NEEDS CNM APPROVAL** | Replace the enhanced screenshot crops for full clarity |
| Apple and Google developer accounts | **NEEDS CNM APPROVAL** | `mobile/README.md` |

## Workstreams

| Phase | Item | Status |
| --- | --- | --- |
| Research | Brief analysis, UX references (Apple storytelling, Farfetch commerce) | DONE |
| Audit | Existing CNM assets from the supplied screenshots of cnmessentials.com and cnm-group.net | DONE (social media still to audit) |
| Architecture | Static-first Netlify site + Functions + Blobs; headless-ready commerce layer | DONE (`docs/ARCHITECTURE.md`) |
| Design system | Tokens, type, grid, buttons, forms, cards, motion, approval slots (`/styleguide/`) | DONE |
| Landing | Home: hero (live-site copy) → shop by category (CNM campaign banners) → room sprays → diffusers & refills → brands → Lease-to-Own → featured → about → promises → stores → journal → newsletter | DONE |
| Commerce | Shop now (20 real products), 4 CNM category pages with campaign banners, brand filter, gifts | DONE |
| Commerce | Product cards (hover alternate image, wishlist, quick add, badges, stock) | DONE |
| Commerce | Instant filters with URL state; mobile bottom sheet; sorting | DONE |
| Commerce | Predictive search (typo-tolerant, recent/popular, zero-result recommendations) | DONE |
| Commerce | PDP: gallery + zoom + swipe, qty, stock, add/buy now, accordions, related, recently viewed, share, back-in-stock | DONE |
| Commerce | Wishlist: guest + account sync + merge on sign-in, move to bag, share | DONE |
| Commerce | Bag drawer + bag page, promo codes, delivery estimate, server-side totals | DONE |
| Commerce | Checkout Contact → Delivery → Payment (Card / Bank transfer / USSD) → Review → Confirmation; Paystack + staging simulator; failure/retry; mobile collapsible summary + sticky actions; live keys blocked outside approved production | DONE |
| Commerce | AI scent finder (`/scent-finder/`): scents, room, mood, budget → matching products via Netlify AI Gateway, grounded + validated, with rules fallback | DONE (gateway to enable) |
| Commerce | Order numbers, confirmation email, order history, tracking status | DONE |
| Account | Register, sign in, email-code (OTP) sign-in, reset, profile, addresses, orders, preferences, sign out everywhere | DONE |
| Account | Optional sign-in / create-account dialog (email code or password) from the header, mobile menu, checkout, wishlist and confirmation; shopping and checkout never require an account | DONE |
| CNM Group | Dark navy editorial design (from CNM's Lovable draft): founder portrait hero, founder quote, company photo panels, company photos on Spectra/CNMWorX pages | DONE (quote wording and photo rights **NEEDS CNM APPROVAL**) |
| Navigation | Floating CNM control on every page of every site: one click home to CNM Group, clicking the four-dot switch fans out the sister companies (never on hover or scroll); auto-collapses; no back button in any header | DONE |
| Visual | Campaign artwork shown whole (no cropping, no text overlaid); captions sit below | DONE |
| Content | Our Story (brand and group copy, mission, vision, values), Stores (real NAP), For Business / Lease-to-Own + enquiry, Journal, CNM Group hub with its own group header/footer and "Visit store" (Retail · Energy · Impact, leadership), company pages for Spectra (consultation form), CNMWorX (project/tender form), Foundation (partner/volunteer form), group contact page | DONE (founder and hours **NEEDS CNM APPROVAL**) |
| Mobile | Expo iOS + Android app with the original logo, real catalogue and palette (tabs, shop, brand filter, search, PDP, wishlist, bag, checkout, account, push, deep links, biometrics) | DONE (typecheck + 69 tests; not yet device-tested) |
| Mobile | App Store and Play Store submission | **NEEDS CNM APPROVAL** (accounts) |
| Admin | Dashboard, orders, customers, inventory/pricing, discounts, content/merchandising, stores, SEO/redirects, enquiries, subscribers, media, analytics, users/roles, audit log, publish | DONE |
| SEO | SSR/static HTML, canonicals, sitemap, robots, OG, breadcrumbs, Product/Breadcrumb/Organization/WebSite/Article/ItemList/Service JSON-LD, LocalBusiness (gated on verified NAP), Merchant feed (gated on approved prices) | DONE |
| SEO | Search Console, GA4, Merchant Center, Google Business Profiles | **NEEDS CNM APPROVAL** (account access) |
| Analytics | GA4 e-commerce events + consent + first-party funnel in admin | DONE |
| Notifications | Transactional email (Resend); push (Expo) with granular preferences; SMS preferences stored | DONE (email/push credentials **NEEDS CNM APPROVAL**; SMS provider not yet chosen) |
| Performance | Static HTML, 6 KB main JS, code-split pages, self-hosted fonts, immutable caching, lazy images, skeletons, delayed loader | DONE |
| Accessibility | Skip link, focus states, focus-trapped dialogs, labels, ARIA, reduced motion, keyboard search | DONE |
| Integrations | Resend email (sign-in codes, orders), Supabase database adapter + SQL migration, Paystack payment adapter (initialize, verify, webhooks, refunds) | DONE (needs keys in Netlify: see `docs/INTEGRATIONS.md`) |
| Sign-in | Passwordless email code (OTP) as the default sign-in; new customers are created on first code | DONE |
| Experience | Motion & interaction on every site: scroll reveals, parallax photos, smart header (hides on scroll down, returns on scroll up), reading progress bar, back-to-top, count-up stats, smooth page transitions, instant-feeling navigation (prefetch on hover), “Continue exploring” next-page cards, Companies and section dropdowns, product Quick View pop-up, newsletter pop-up (once per visitor, never at checkout), gold group ticker; all respect “reduce motion” | DONE |
| Experience | Light and dark mode on every site (sun/moon switch in each header; follows the device until chosen; remembered across CNMGroup.com and all company sites; no flash on load); each company keeps its identity after dark | DONE |
| Security | Signed HttpOnly sessions, CSRF, rate limits, validation, server-side pricing, RBAC, webhook HMAC, CSP/HSTS | DONE |
| Testing | 38 unit/integration tests, 55 Playwright E2E runs (desktop + mobile), 69 mobile app tests | DONE (all passing) |
| Visual QA | CNM Group, company, contact and scent-finder pages checked at 360 / 390 / 768 / 1024 / 1440 px (no horizontal scroll) | DONE |
| Staging | Netlify config; staging is noindexed with a staging banner and payment simulator | DONE (deploy needs Netlify access, see `docs/DEPLOYMENT.md`) |
| Visual QA | 69 screenshots, desktop + mobile, `docs/visual-review/index.html` | DONE (with real CNM assets) |
| Production | Connect cnmessentials.com | Waiting for final CNM approval |

## CNM Group OS (admin platform)

Full specification: [docs/ADMIN-OS-SPEC.md](docs/ADMIN-OS-SPEC.md). Target relational schema: [docs/schema/cnm-os.sql](docs/schema/cnm-os.sql), validated on PostgreSQL 16 with 57 tables.

| Area | Status |
|---|---|
| Command Center: KPIs with comparisons, company/location/channel filters, revenue trend, gross vs net, funnel, top sellers/viewed/trending, needs-attention, live feed, CSV export | DONE |
| Companies: create/edit/archive, logo, colour, domains, currency, payment & delivery options, company admins, company-scoped access | DONE |
| Audit log (before → after, IP, device) · idempotent creates · live updates | DONE |
| Phase 1 operations: orders (search, filters, bulk, CSV, order page, notes, address edit, resend, cancel, record payment, manual orders), invoices & packing slips, shipments & couriers, delivery exceptions, fulfilment board & delivery performance, courier webhooks, returns (RMA), partial refunds with second approval | DONE |
| Catalogue editor, multi-location stock, finance, customers & growth, 2FA, notifications, risk | SPECIFIED (see delivery plan §25) |

Local demo data for review: `npm run seed:demo -- /path/to/dir`, then start the dev server with `CNM_DATA_DIR` set to that directory. It refuses to run outside local development.

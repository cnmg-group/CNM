# CNM Essentials — digital commerce platform

Editorial brand site, luxury e-commerce, customer accounts, admin/operations, APIs and iOS/Android app for **CNM Essentials**, the retail division of CNM Group (Energy · Retail · Impact).

> **Staging build.** The original CNM logo, the 20 products, prices, photography, campaign banners, store addresses and copy come from cnmessentials.com and cnm-group.net. Anything not yet confirmed (stock, delivery fees, founder story, opening hours) is marked **Needs CNM approval**; nothing has been invented. Import the rest of the catalogue with `scripts/import-catalogue.mjs` (see `PROGRESS.md`).

## Quick start
```bash
cd cnm-essentials
npm install
npm run dev        # build + serve on http://localhost:8888
```
Local admin: http://localhost:8888/admin/ (`admin@cnm.local` / `cnm-local-admin`, local only). Test promo code: `STAGING10`. Staging payments use a simulator (success or failure).

## What's here
- **Web** (`src/`, `scripts/build.mjs`): cinematic landing page, shop with instant filters, predictive search, PDP, wishlist, bag, checkout, account, Our Story, Stores, Fragrance as a Service, Journal, CNM Group hub, design system (`/styleguide/`) and butterfly loader.
- **API** (`netlify/functions/`): auth (password, email code, reset), account, checkout (server pricing), Paystack plus the staging simulator, orders, leads, events, admin (RBAC), media. See `docs/API.md`.
- **Admin** (`/admin/`): dashboard, orders, customers, inventory and pricing, discounts, content and merchandising, stores, SEO and redirects, enquiries, subscribers, media, analytics, users and roles, audit log, publish.
- **Mobile** (`mobile/`): Expo (iOS and Android) with the same API. See `mobile/README.md`.

## Docs
- `PROGRESS.md`: progress register (DONE / IN PROGRESS / BLOCKED / NEEDS CNM APPROVAL)
- `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT.md` (staging → production), `docs/SEO-GROWTH.md`, `docs/CONTENT-APPROVAL.md`
- `docs/visual-review/index.html`: desktop and mobile screenshots of every major page and state
- `.env.example`: environment variables

## Tests
```bash
npm test                                   # 19 unit + API integration tests
CHROME_PATH=/path/to/chrome npm run test:e2e   # 23 Playwright E2E tests (desktop + mobile)
cd mobile && npx jest && npx tsc --noEmit  # 58 mobile tests + typecheck
```

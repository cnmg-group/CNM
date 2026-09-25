# Deployment

## 1. Staging (temporary review URL)

1. In Netlify: **Add new site → Import an existing project → GitHub → `gabeth7/chatbot`**.
2. Branch: `claude/cnm-essentials-platform-s0u4wq` (or `main` once merged). The root `netlify.toml` already sets base `cnm-essentials`, build `npm ci && npm run build`, publish `dist` and functions `netlify/functions`.
3. Site name, e.g. `cnm-essentials-staging`. The URL is `https://cnmshop.netlify.app`.
4. Environment variables (see `.env.example`). The minimum for a fully interactive staging site:
   - `ADMIN_STAGING_PASSWORD`: lets you sign in to `/admin/` as `staging@cnmessentials.com`
   - optional: `SESSION_SECRET`, `RESEND_API_KEY` + `EMAIL_FROM`, `CNM_NOTIFY_EMAIL`, `GA_MEASUREMENT_ID`
   - leave `PAYSTACK_SECRET_KEY` empty to use the payment simulator (no real money)
5. Deploy. Staging is always noindexed (`robots.txt` Disallow, `X-Robots-Tag` and meta robots) and shows the staging banner.
6. Optional: protect it with **Site configuration → Access control → Password protection**.
7. For the admin **Publish** button, create a build hook (**Site configuration → Build & deploy → Build hooks**) and set `NETLIFY_BUILD_HOOK_URL`.

### Staging test checklist
Home · navigation/mega menu · Shop · category · search (try "vanila") · filters (mobile bottom sheet) · PDP (zoom, swipe) · wishlist · bag drawer and page (promo `STAGING10`) · checkout → simulate failed then successful payment · confirmation · account register/sign-in/email code/orders/preferences · Our story · Stores · Fragrance as a Service enquiry · Journal · CNM Group · `/styleguide/#loader` (butterfly loader) · `/admin/`.

## 2. Import CNM's originals

```bash
cd cnm-essentials
node scripts/import-catalogue.mjs --logo https://cnmessentials.com/path/to/logo.svg
node scripts/import-catalogue.mjs --shopify https://cnmessentials.com   # or --woo URL / --csv file
npm run build && npm test
npm run dev   # review at http://localhost:8888, then commit and push
```

## 3. Production (only after CNM's final approval)

1. Replace demo content (see `docs/CONTENT-APPROVAL.md`). Approve prices in **Admin → Products & inventory** (tick "Price approved") so Product offers and the Merchant feed include them.
2. Set production environment variables: `CNM_LAUNCH_APPROVED=true`, `SITE_URL=https://cnmessentials.com`, `SESSION_SECRET`, `PAYSTACK_SECRET_KEY` (live), `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_USERS` (hash passwords with `node scripts/hash-password.mjs`), `GA_MEASUREMENT_ID`. Remove `ADMIN_STAGING_PASSWORD`.
3. In Paystack, set the webhook URL to `https://cnmessentials.com/api/payments/paystack-webhook`.
4. **Domain management → Add domain → cnmessentials.com.** Point DNS (Netlify DNS, or an A/ALIAS record plus a `www` CNAME) and let Netlify issue the TLS certificate. Redirect `www` to the apex (or the reverse) and keep one canonical host.
5. Update the **Retail** link on www.cnm-group.net to point to `https://cnmessentials.com`.
6. Update `public/.well-known/apple-app-site-association` (Apple Team ID) and `assetlinks.json` (Play signing SHA-256) for app deep links.
7. After go-live: submit `https://cnmessentials.com/sitemap.xml` in Google Search Console, connect Merchant Center to `/feeds/google-merchant.xml`, and verify both Google Business Profiles with NAP identical to the store pages.

## Rollback
Netlify keeps every deploy. Use **Deploys → select a previous deploy → Publish deploy** for an instant rollback.

## Local development
```bash
cd cnm-essentials && npm install
npm run dev                      # http://localhost:8888  (admin: admin@cnm.local / cnm-local-admin, local only)
npm test                         # unit + integration
CHROME_PATH=/path/to/chrome npm run test:e2e   # Playwright (desktop + mobile)
npm run screenshots              # visual review board → docs/visual-review/index.html (needs npm run dev)
```

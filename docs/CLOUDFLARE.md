# Hosting on Cloudflare Pages

The same code runs on Cloudflare Pages and on Netlify. On Cloudflare:

- **Pages** serves the built site from `dist/` (with `_headers` and `_redirects`).
- **`functions/api/[[path]].js`** sends every `/api/*` request to the shared handlers in `netlify/functions/`
  via `netlify/lib/cloudflare.mjs` — the same handlers, routes and checks as Netlify.
- **D1** (Cloudflare's SQL database, bound as `CNM_DB`) stores orders, accounts, sign-in codes and settings.
  The table is created automatically on first use. Supabase still works instead if `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` are set.

## One-time setup (Cloudflare dashboard)

1. **Create the database:** Storage & Databases → D1 → Create → name it `cnm`.
2. **Create the site:** Workers & Pages → Create → Pages → **Connect to Git** → choose `cnmg-group/cnm`.
   - Production branch: `claude/cnm-essentials-platform-s0u4wq`
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable (build): `NODE_VERSION` = `22`
3. **Before the first real use**, in the Pages project → Settings:
   - **Functions → Compatibility flags:** add `nodejs_compat` (Production and Preview). Compatibility date: `2025-09-01` or later.
   - **Bindings → Add → D1 database:** variable name `CNM_DB`, database `cnm` (Production and Preview).
   - **Variables and secrets** (as *Secret* where marked):
     - `SESSION_SECRET` *(secret)* — any long random text, 40+ characters
     - `RESEND_API_KEY` *(secret)* — for sign-in codes and order emails
     - `EMAIL_FROM` — e.g. `CNM Group <onboarding@resend.dev>` until a domain is verified in Resend
     - `SITE_URL` — e.g. `https://cnm.pages.dev`
     - Optional: `ADMIN_USERS`, `PAYSTACK_SECRET_KEY`, `CNM_NOTIFY_EMAIL`, `ANTHROPIC_API_KEY`, `DEPLOY_HOOK_URL`
       (a Pages *deploy hook* so "Publish site" in the admin rebuilds the site)
4. **Deployments → Retry deployment** (bindings and flags apply from the next deploy).

Every push to the branch then builds and deploys automatically.

## Notes

- **CPU time:** passwords and PINs are checked with scrypt, which takes tens of milliseconds of CPU. The Workers
  **Free** plan allows 10 ms per request, so admin and customer password sign-in may fail there with
  "Worker exceeded CPU time limit". The Workers **Paid** plan ($5/month) allows much more and is recommended.
- **Host-based redirects** in `_redirects` (the `https://cnmessentials.com/` lines) are Netlify-only; Cloudflare
  skips them. Point that domain at the shop with a Cloudflare redirect rule instead when the domain moves.
- **Staging behaviour** (noindex, staging banner, simulated payments) stays on until `CONTEXT=production` and
  `CNM_LAUNCH_APPROVED=true` are both set as variables.

## Checking it locally on Cloudflare's runtime

```
npm run build
npx wrangler pages dev dist --compatibility-flags=nodejs_compat --compatibility-date=2025-09-01 --d1 CNM_DB=cnm-local --port 8787
npx playwright test -c playwright.cf.config.mjs --project=desktop --grep-invert "admin|operations|CNM Group OS|bag:"
```

Put local-only variables (e.g. `SESSION_SECRET`) in `.dev.vars` (git-ignored). The admin browser tests use the
local demo account, which only exists with the local file store, so they run against `npm run dev` instead.

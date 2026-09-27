# Integrations: Resend, Supabase and Paystack

Every key goes into **Netlify → Site configuration → Environment variables**. None go into the code or chat. After changing them, trigger a redeploy (**Deploys → Trigger deploy**).

## 1. Resend: email (sign-in codes, order emails)

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | Your Resend API key (`re_…`) |
| `EMAIL_FROM` | Leave **empty** until your domain is verified, then `CNM Essentials <hello@cnmessentials.com>` |
| `EMAIL_REPLY_TO` | `cnmessentials@cnm-group.net` |

**Verify your domain so emails reach every customer.** Without it, Resend only delivers to the email address that owns the Resend account.
1. In Resend, go to **Domains → Add domain** and enter `cnmessentials.com`.
2. Add the DNS records it shows (SPF, DKIM, and ideally DMARC) at your domain registrar.
3. Wait until the domain shows **Verified**, then set `EMAIL_FROM` and redeploy.

## 2. Customers sign in with a one-time code

- Customers enter their email on `/account/login/` and receive a 6-digit code by email.
- Codes expire after 10 minutes and work once. Each code allows 5 attempts, a new code can be requested every 60 seconds, and requests are rate-limited per IP.
- New emails get an account automatically, then are asked for their name.
- Password sign-in remains available as an option.
- On staging, **if no Resend key is set**, the code is shown on screen so you can test.

## 3. Supabase: database

1. Open the Supabase dashboard for project `mjyesgbedkmtlrxdzihr`, then go to **SQL Editor**.
2. Paste the contents of `supabase/migrations/20260927000000_cnm_store.sql` and click **Run**. It creates:
   - `cnm_kv`, which holds all data, with Row Level Security locked so the public key can't access it.
   - Views to browse the data: `cnm_orders`, `cnm_customers`, `cnm_enquiries` and `cnm_subscribers`.
3. In Netlify, set:
   - `SUPABASE_URL` = `https://mjyesgbedkmtlrxdzihr.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = the **secret** key from Project Settings → API Keys (it starts `sb_secret_`).
4. Redeploy. Orders, customers, enquiries, stock and admin edits now save to Supabase.

The **publishable** key (`sb_publishable_…`) is safe to be public but can't write this data by design. The website doesn't need it. It's only for a future browser or mobile feature that talks to Supabase directly.

## 4. Paystack: payments

1. In Paystack, go to **Settings → API Keys & Webhooks**.
2. In Netlify, set `PAYSTACK_SECRET_KEY` = `sk_test_…` for staging. Use `sk_live_…` only on the production site after approval.
3. Set the **Webhook URL** in Paystack to `https://cnmgg.netlify.app/api/payments/paystack-webhook` (on production, use your live domain).
4. Redeploy. At checkout the customer picks **Card**, **Bank transfer** or **USSD**, and Paystack's secure page opens on that method. Checkout now sends customers to Paystack's secure page (card, bank, USSD, bank transfer, QR). When they return, the payment is verified, and the webhook confirms it as well. The staging simulator switches off automatically.

**Real payments stay off in staging.** A live key (`sk_live_…`) is ignored unless the deploy is the production context **and** `CNM_LAUNCH_APPROVED=true`. Anywhere else, including branch and preview deploys, checkout uses the simulator even if a live key is set site-wide. A test key (`sk_test_…`) works everywhere and never moves real money. The checkout page and order review both say when no real payment will be taken.

What the adapter handles (`netlify/lib/payments/paystack.mjs`):
- Amounts in kobo, checked against the order.
- A fresh reference when a customer retries after a failed payment.
- Signature-checked webhooks.
- Idempotent "paid" handling, so stock and emails happen once.
- Refunds from **Admin → Orders → Refunded**, full or partial. The money is returned through Paystack before the order is marked refunded.
- Timeouts and one retry.

Test cards: see Paystack's docs (e.g. `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`).

## 5. AI scent finder (Netlify AI Gateway)

`/scent-finder/` lets shoppers pick the scents they like, the room, the mood and a budget, plus an optional note. `POST /api/recommend` then suggests up to four CNM products.

**Turn on the AI:**
1. In Netlify, open the site, then **Extensions → AI Gateway** (or **Project configuration → AI**) and enable the AI Gateway for Anthropic.
2. Netlify then injects `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` into functions automatically. You don't need to paste any key.
3. Redeploy. Results then say "Suggested by our AI scent adviser".

Alternatives: any Anthropic-compatible gateway works if you set `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` yourself. To change the model, set `CNM_AI_MODEL` (default `claude-opus-5`).

**Safeguards:**
- **Without a gateway**, a transparent rules matcher answers instead (labelled "Matched from our range"). The feature always works.
- **Facts come from the catalogue only.** The model sees the catalogue (names, types, brands, prices, availability) and is told not to invent scent notes, ingredients or claims, since CNM hasn't published them.
- **Every pick is checked** against real, in-stock, in-budget products before it is shown.
- **Errors, refusals and timeouts** fall back to the rules matcher.
- **Rate limit:** 8 requests per minute per visitor. Input is limited to fixed choices and a 280-character note.

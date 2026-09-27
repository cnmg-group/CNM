# CNM Group websites: start here

A one-page summary of what's built, how to see it, and what CNM still needs to send.

## 1. What's built

**CNMGroup.com is the main hub.** Each company opens into its own website with its own look, pages and features. Every page of every site carries the **floating CNM control** (bottom-left): one click goes home to CNMGroup.com, and clicking or tapping its four-dot button reveals the other CNM companies for instant switching. There is no separate back button in any header.

| Address | Website | Pages & features |
| --- | --- | --- |
| `/` | **CNM Group** (hub) | Home with the founder's photo and all four companies · About (who we are, leadership, divisions, where we operate) · Contact form |
| `/essentials/` | **CNM Essentials** (online store) | Farfetch-style shop, filters, search, product pages, AI scent finder, wishlist, bag, guest checkout (card, bank transfer, USSD), optional sign in / sign up, order tracking, stores, For Business, journal, admin |
| `/spectra/` | **CNM Spectra** (eyewear) | Home · Eyewear range · Eye care · **Book an appointment** · About · Visit & contact |
| `/cnmworx/` | **CNMWorX Limited** (engineering) | Home · Services · Industries · Quality (ISO 9001:2015) · About · **Request a proposal / tender** · Contact |
| `/foundation/` | **CNM Foundation** (impact) | Home · Programmes · Get involved (partner / volunteer) · **Donate (pledge)** · About · Contact |

All forms arrive in **Admin → Enquiries** (and by email once `CNM_NOTIFY_EMAIL` is set), labelled with the company.

| | Status |
| --- | --- |
| Admin: orders, products and prices, stock, discounts, content, stores, enquiries, analytics, staff roles | ✅ Built |
| iPhone and Android app (same products, account and checkout) | ✅ Built, not yet tested on a phone |
| Logos: CNM Group, Spectra, CNMWorX and Foundation upscaled with the background removed; CNM Essentials as a vector | ✅ Done |
| Photos: founder portrait and company photos at 2000 px (AI super-resolution), with smaller copies for phones | ✅ Done, originals still wanted (see below) |
| Tests: unit/API, browser (desktop and mobile), app | ✅ All passing |

## 2. How to see it

1. **Online (for anyone, on any phone or computer):** https://cnmshop.netlify.app (staging; connected to this repo on Netlify).
2. **Screenshots now:** open `docs/visual-review/index.html` for 69 screenshots, every page on desktop and mobile.
3. **Try it:** promo code `STAGING10`. Payments are simulated, so no money moves; you can test both a successful and a failed payment.

## 3. Connect email, database and payments

Follow `docs/INTEGRATIONS.md`: Resend (sign-in codes and order emails), Supabase (database) and Paystack (payments). Each is a few variables in Netlify.

## 4. What CNM needs to send

| # | Item | Why |
| --- | --- | --- |
| 1 | **Original product photo files** (or allow `cnmessentials.com` in the environment's network settings) | The current photos were enhanced from ~165px screenshots. They're sharper, but only the originals will be truly crystal clear, and small label text may be slightly off. |
| 2 | **Rest of the catalogue** (only page 1 of the shop was supplied) | So every product is online |
| 3 | **Stock levels** | The live site doesn't show them |
| 4 | **Delivery fees and returns policy** | Currently placeholder values |
| 5 | **Store opening hours** | For the store pages and Google Maps |
| 6 | **Founder's original photo file and biography** | The portrait is enhanced from a phone screenshot of cnm-group.net; the original file will be sharper still. The biography goes on the About page. |
| 6a | **Company details**: Spectra addresses and hours, CNMWorX certificate details and case studies, Foundation payment account for online giving | Each marked "Needs CNM approval" on its page |
| 7 | **Instagram and WhatsApp links** | For the footer |
| 8 | **Payment provider decision** (Paystack is ready; the live site lists Visa, Mastercard and PayPal) | To take real payments |
| 9 | **Confirm:** "Sun Kissed Vanilla" brand (listed as Bath & Body Works, pictured as Febreze) | Accuracy |
| 10 | **Apple and Google developer accounts** | To publish the app |

## 5. Going live

Nothing is connected to cnmessentials.com yet. After final approval, follow `docs/DEPLOYMENT.md`, section 3. Then set the **Retail** link on cnm-group.net to `https://cnmessentials.com`.

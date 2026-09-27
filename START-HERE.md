# CNM Essentials: start here

A one-page summary of what's built, how to see it, and what CNM still needs to send.

## 1. What's built

| | Status |
| --- | --- |
| Online store: home, shop, filters, search, product pages, wishlist, bag, checkout, accounts, order tracking | ✅ Built and tested |
| Our Story, Stores (Lagos and Abuja), For Business (Lease-to-Own), Journal | ✅ Built |
| CNM Group page: Retail · Energy · Impact, all four companies, contact form. **Retail opens the store** | ✅ Built |
| Admin: orders, products and prices, stock, discounts, content, stores, enquiries, analytics, staff roles | ✅ Built |
| iPhone and Android app (same products, account and checkout) | ✅ Built, not yet tested on a phone |
| **Logo:** crystal-clear vector (SVG) version of the original CNM Essentials logo, used everywhere | ✅ Done |
| **Photos:** products, campaign banners and store photo sharpened (about 3× the original resolution) | ✅ Done, see note below |
| Tests: 19 unit/API, 25 browser (desktop and mobile), 69 app | ✅ All passing |

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
| 6 | **Founder name, photo and story** | For the Our Story page |
| 7 | **Instagram and WhatsApp links** | For the footer |
| 8 | **Payment provider decision** (Paystack is ready; the live site lists Visa, Mastercard and PayPal) | To take real payments |
| 9 | **Confirm:** "Sun Kissed Vanilla" brand (listed as Bath & Body Works, pictured as Febreze) | Accuracy |
| 10 | **Apple and Google developer accounts** | To publish the app |

## 5. Going live

Nothing is connected to cnmessentials.com yet. After final approval, follow `docs/DEPLOYMENT.md`, section 3. Then set the **Retail** link on cnm-group.net to `https://cnmessentials.com`.

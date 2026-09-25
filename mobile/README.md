# CNM Essentials — iOS & Android app

Expo (SDK 57, React Native 0.86, TypeScript, Expo Router) client for the same
Netlify API as the website (`../docs/API.md`).

Brand palette (sampled from the original logo, `src/theme.ts`): charcoal `#23221e`
(primary / dark sections), sage `#d3dbce`, yellow `#fbcc39` (accent: primary CTAs on
charcoal, badges, labels on dark), off-white `#f6f5f0`, lines `#e3e5de`. Type: Instrument
Serif for headlines, Hanken Grotesk for UI.

```
mobile/
  app.json, eas.json          Expo + EAS config (bundle ids, deep links, plugins)
  scripts/sync-content.mjs    copies ../content/*.json → src/data/ (offline fallback)
  src/app/                    routes (Expo Router)
    (tabs)/                   Home · Shop · Search · Wishlist · Account
    products/[slug].tsx       product detail
    shop/[category].tsx       deep link → Shop tab, pre-filtered
    collections/[collection]  deep link → Shop tab, pre-filtered
    bag.tsx, checkout/        bag, multi-step checkout, payment return
    account/…                 sign-in, register, reset, OTP, profile, addresses,
                              orders, notification preferences, privacy & security
    +native-intent.tsx        normalises incoming universal/app links
  src/lib/                    pure logic (search, filters, cart, catalogue, deep links,
                              payments) + API client, analytics, notifications
  src/state/                  React context + useReducer providers (no Redux)
  src/components/             design system, butterfly loader, product UI, sheets
  __tests__/                  Jest unit tests for the pure logic
```

## Run it

Requirements: Node 20+ (22 recommended), npm, Xcode (iOS simulator) and/or Android Studio (emulator).

```bash
cd mobile
npm install
cp .env.example .env            # optional — defaults to staging
npm start                        # Expo dev server (press i / a, or scan with Expo Go)
npm run ios                      # opens the iOS simulator
npm run android                  # opens the Android emulator
npm run typecheck                # tsc --noEmit
npm test                         # jest (pure logic)
npm run sync-content             # re-copy ../content/*.json into src/data/
```

**Expo Go** runs almost everything. Known Expo Go limits: remote push notifications
(Android Expo Go has no push since SDK 53; iOS needs a dev build for a real token),
Face ID prompts use the Expo Go usage string, and universal/app links only work in a
real build. For those use a development build:

```bash
npm i -g eas-cli
eas login
eas init                         # creates the EAS project and writes extra.eas.projectId to app.json
eas build --profile development --platform ios      # simulator build
eas build --profile development --platform android  # installable APK
npx expo start --dev-client
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `https://cnmshop.netlify.app` | Origin of the website + API. `/catalogue.json`, `/api/*` and web pages (FaaS, stores, policies) are loaded from here. |

Set per build profile in `eas.json` (development/preview → staging, production →
`https://cnmessentials.com`). `EXPO_PUBLIC_*` values are inlined at build time, so never
put secrets in them. The app holds no secrets; Paystack keys live only on the server.

## Build & release (EAS)

```bash
eas build --profile preview --platform all      # internal testers (APK + ad-hoc/TestFlight-ready IPA)
eas build --profile production --platform all   # store builds (auto-incremented build numbers)
eas submit --profile production --platform ios      # → App Store Connect / TestFlight
eas submit --profile production --platform android  # → Play Console (internal track)
```

Before the first store submission:

1. **App Store**: create the app in App Store Connect with bundle id
   `com.cnmessentials.app`; fill `submit.production.ios` in `eas.json`
   (`appleId`, `ascAppId`, `appleTeamId`). EAS manages certificates and the push key
   (`eas credentials`). Enable the *Associated Domains* capability (EAS does this from
   `ios.associatedDomains`).
2. **Play Store**: create the app with package `com.cnmessentials.app`, upload the first
   AAB manually once (Play requirement), create a service account with release access,
   and save its JSON key as `mobile/secrets/play-service-account.json` (git-ignored).
3. **Push**: `eas credentials` → set up the APNs key (iOS) and FCM V1 service account
   (Android). Without `extra.eas.projectId` (added by `eas init`) the app shows
   "Push is not configured for this build yet" instead of registering.
4. Store listing: screenshots, privacy nutrition labels / Data safety form (the app
   collects email, name, phone, addresses, order history, device push token and
   first-party analytics events tied to the session).

## Deep links

- Custom scheme: `cnm://products/<slug>`, `cnm://shop/<category>`,
  `cnm://account/orders/<number>`, `cnm://checkout/return?reference=…` (Paystack return).
- Universal links (iOS) / App Links (Android) on `cnmessentials.com` and
  `www.cnmessentials.com` for `/products/*`, `/shop/*`, `/account/orders/*`
  (configured in `app.json` → `ios.associatedDomains`, `android.intentFilters` with
  `autoVerify`). Website-style paths with trailing slashes and tracking params are
  normalised in `src/app/+native-intent.tsx`; `/shop/new-in/` and `/shop/best-sellers/`
  map to the matching Shop filters. Push notification taps read `data.url` (any of the
  above forms) and route through the same map.

The website must serve these two files **with `Content-Type: application/json`, no
redirects, over HTTPS**, on both `cnmessentials.com` and `www.cnmessentials.com`:

`/.well-known/apple-app-site-association` (no file extension)

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<APPLE_TEAM_ID>.com.cnmessentials.app"],
        "components": [
          { "/": "/products/*", "comment": "Product detail" },
          { "/": "/shop/*", "comment": "Category listing" },
          { "/": "/account/orders/*", "comment": "Order detail" }
        ]
      }
    ]
  }
}
```

`/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cnmessentials.app",
      "sha256_cert_fingerprints": ["<PLAY_APP_SIGNING_SHA256_FINGERPRINT>"]
    }
  }
]
```

Replace `<APPLE_TEAM_ID>` (Apple Developer → Membership) and
`<PLAY_APP_SIGNING_SHA256_FINGERPRINT>` (Play Console → Setup → App integrity → App
signing key certificate; add the EAS upload key fingerprint from `eas credentials` too
if you want links to verify on internal/preview builds).

## How it behaves

- **Catalogue**: CNM's real range (20 products from cnmessentials.com: Victoria's Secret,
  Bath & Body Works and Febreze room sprays, Wallflowers and odour eliminators).
  `GET /catalogue.json` is merged with `GET /api/catalogue/live`, cached in AsyncStorage,
  and falls back to the bundled copy in `src/data/` when offline. Skeletons show only on
  a first launch with no cache. Cards and the product page show brand and product type
  ("Victoria's Secret · Room Spray"). Packshots load from the website
  (`images[].src`, resolved against `EXPO_PUBLIC_API_BASE_URL`).
- **Money** is Naira and may carry kobo: `₦17,850`, `₦14,888.75`. Local estimates round
  to the kobo; the server quote is authoritative.
- **Stock**: `stock.quantity: null` means CNM doesn't publish stock. Those items can be
  ordered (up to `maxQtyPerLine`) and show "Availability to be confirmed". A known
  quantity of 0 or `available: false` means out of stock (with a back-in-stock form).
- **Categories**: Home "Shop by category" uses each category's `banner` (campaign image
  from the website). Categories with no products are hidden unless `showWhenEmpty`, in
  which case they show "Coming soon online — visit our stores" (Hair Care and Body Care
  today; Beverages stays hidden).
- **Shop filters**: category, brand, price bands (worked out from real prices), available
  to order; New / Best sellers toggles only appear when products carry those flags.
- **Home** follows the website: charcoal hero with the original logo and the site's own
  copy, category banners, room sprays & odour eliminators rail, Wallflowers rail, shop
  by brand, Lease-to-Own Programme teaser with key products, the four promises, Lagos
  and Abuja stores with real addresses, and the "Stay in the Loop" newsletter
  (`POST /api/newsletter`).
- **Honesty rules**: product fields that are `null` (description, notes, how to use,
  size, care, FAQs) render "Details awaiting CNM approval" (Ingredients is hidden
  entirely unless supplied). The "Demo price" tag appears only while `price.demo` is true
  (it's false for all live products). A product without images gets a "CNM · Photography
  awaiting CNM approval" tile. No copy is invented.
- **Bag & checkout**: totals always come from `POST /api/checkout/quote` (a labelled
  estimate is shown only while it loads / if it fails). Checkout: Contact → Delivery →
  Payment → Review → Confirmation. Paystack opens in an auth session
  (`openAuthSessionAsync`, return URL `cnm://checkout/return`) and is then verified with
  `/api/payments/verify`; on staging, `payment.mode === "simulated"` shows a
  Simulate success / failure panel. Failures keep the bag and offer retry.
- **Auth**: bearer token in `expo-secure-store`, every request sends
  `X-CNM-Client: mobile`. A 401 anywhere signs the user out locally. Optional biometric
  lock hides the account on app start until Face ID / fingerprint succeeds.
- **Wishlist**: AsyncStorage for guests; optimistic `PUT /api/account/wishlist` when
  signed in (reverted on failure); merged with `?merge=1` on sign-in; cleared on sign-out.
- **Push**: permission is requested only when the user switches on a push preference.
- **Butterfly loader**: appears only if a request is still pending after 250 ms; with
  Reduce Motion on it is a static mark that fades in.
- **Analytics**: `track(name, params)` → `POST /api/events`, fire-and-forget, GA4 names
  (`view_item`, `view_item_list`, `select_item`, `add_to_cart`, `remove_from_cart`,
  `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`,
  `search`, `add_to_wishlist`, `share`, `login`, `sign_up`, …).

## Pending CNM approval

| Item | Where | Status |
| --- | --- | --- |
| Logo master files | `assets/brand/cnm-logo.png` (full, 702×801), `assets/brand/cnm-mark.png` (petal mark, 300×300) | The original CNM artwork, copied from the website (cropped from cnm-group.net), used by `<Logo variant="full" \| "mark" />`. Never redrawn. Swap in higher-resolution masters from CNM at the same paths when available. |
| App icon & splash | `assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png` | Built from `cnm-mark.png`: the mark's dark background is keyed out and the original petal pixels placed on flat charcoal `#23221e`, because the source is only 300 px (upscaled to 680 px in the 1024 icon). Regenerate from a vector master before store release. |
| Bundle id / package `com.cnmessentials.app` | `app.json` | **NEEDS CNM APPROVAL** — cannot be changed after the first store release. |
| App name "CNM Essentials", store listing, developer accounts (Apple team, Play console) | `app.json`, `eas.json` | Needs CNM |
| Product descriptions, notes, ingredients, sizes, care, FAQs | `../content/products.json` | Needs CNM (names, brands, prices and images come from the live site) |
| Stock levels | `../content/products.json` (`stock.quantity: null`) | Not published — orders show "Availability to be confirmed" |
| Delivery fees, VAT treatment, returns policy, payment provider (site lists Visa / Mastercard / PayPal; app flow is built for Paystack) | `../content/commerce.json` | Demo values — needs CNM |
| Store opening hours, WhatsApp / Instagram links, Hair Care & Body Care ranges | `../content/stores.json`, `site.json`, `categories.json` | Needs CNM |
| Apple Team ID + Play signing fingerprint for `.well-known` files | website | Needs CNM accounts |

After CNM updates `../content/*.json`, run `npm run sync-content` so the offline
fallback matches (the live app reads `/catalogue.json` anyway).

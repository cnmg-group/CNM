# CNM Essentials — iOS & Android app

Expo (SDK 57, React Native 0.86, TypeScript, Expo Router) client for the same
Netlify API as the website (`../docs/API.md`).

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
| `EXPO_PUBLIC_API_BASE_URL` | `https://cnm-essentials-staging.netlify.app` | Origin of the website + API. `/catalogue.json`, `/api/*` and web pages (FaaS, stores, policies) are loaded from here. |

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

- **Catalogue**: `GET /catalogue.json` merged with `GET /api/catalogue/live`; cached in
  AsyncStorage; falls back to the bundled copy in `src/data/` when offline. Skeletons
  show only on a first launch with no cache.
- **Honesty rules**: product fields that are `null` render "Details awaiting CNM
  approval" (Ingredients is hidden entirely unless supplied). Prices show a "Demo price"
  tag while `price.demo` is true. Empty `images` render a cream "CNM · Photography
  awaiting CNM approval" tile. Store addresses, returns policy and FAQs follow the same
  rule. No copy is invented.
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
| **Original CNM logo** | `assets/brand/cnm-logo.png` → `src/components/logo.tsx` | **BLOCKED** — CNM must supply the file; it is never redrawn. A typographic "CNM ESSENTIALS" wordmark (flagged "logo placeholder" in dev builds) is shown until then. |
| App icon & splash | `assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png` | Plain brand-green / transparent placeholders. Replace with artwork made from the official logo. |
| Bundle id / package `com.cnmessentials.app` | `app.json` | **NEEDS CNM APPROVAL** — cannot be changed after the first store release. |
| App name "CNM Essentials", store listing, developer accounts (Apple team, Play console) | `app.json`, `eas.json` | Needs CNM |
| Product descriptions, notes, ingredients, sizes, care, FAQs, photography | `../content/products.json` | Needs CNM |
| Prices, stock, delivery fees, VAT treatment, returns policy, payment provider | `../content/commerce.json` | Demo values — needs CNM |
| Hero / FaaS copy, store addresses & hours | `../content/site.json`, `services.json`, `stores.json` | Needs CNM |
| Apple Team ID + Play signing fingerprint for `.well-known` files | website | Needs CNM accounts |

After CNM updates `../content/*.json`, run `npm run sync-content` so the offline
fallback matches (the live app reads `/catalogue.json` anyway).

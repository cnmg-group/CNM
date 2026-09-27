Build **CNM Essentials**, a luxury e-commerce website for a Nigerian home-fragrance and lifestyle retailer (part of CNM Group). Use React + Vite + TypeScript + Tailwind + shadcn/ui + React Router. It must feel like Apple's product storytelling combined with Farfetch's luxury shopping UX. It must not look like a generic Shopify template. Mobile-first and fully responsive.

## Brand
- **Logo:** use the original image. Never redraw it or replace it with text.
  - Full logo (dark square): `https://cnmgg.netlify.app/assets/brand/cnm-logo.svg`
  - Petal mark (favicon): `https://cnmgg.netlify.app/assets/brand/cnm-mark.svg`
- **Colours:** charcoal `#23221e` (primary/dark sections), deep `#121110`, sage `#d3dbce`, yellow `#fbcc39` (primary buttons on dark, badges, labels on dark), gold text on light `#7a5c00`, off-white `#f6f5f0`, hairlines `#e3e5de`, ink `#111`, muted `#6d6b66`.
- **Type:** "Instrument Serif" (Google Fonts) for headlines, with italic accents. "Hanken Grotesk" for everything else. Small labels are uppercase, 11px, letter-spacing 0.16em.
- **Style:** generous whitespace, square corners (no pills), hairline borders, calm fade and slide reveals on scroll (respect prefers-reduced-motion), subtle image zoom on hover.
- **Mottos:** "Creating serenity, pioneering comfort." · "Pure. Natural. Purposeful."
- **Staging bar** across the very top: "Staging preview — stock, delivery fees and policies await CNM approval. No real payments are taken."

## Header and footer
- **Header (sticky):** left nav with Shop (mega menu: Shop all, the 4 categories, 3 brands, and the Room & Home Fragrance banner image), For business, Our story, Stores. Logo centred. Right: search, account, wishlist and bag icons with a yellow count badge. On mobile, a hamburger opens a full-screen menu. On the home page the header is transparent over the dark hero and turns solid white on scroll.
- **Footer (charcoal):**
  - Logo, "Creating serenity, pioneering comfort."
  - Newsletter: "Subscribe to get special offers, free giveaways, and new arrivals."
  - Columns: Shop · Customer service (Privacy policy, Terms & conditions, Return policy, FAQ, Track an order) · CNM (About us, Stores, For business, Journal, CNM Group) · Contact us:
    - Shop S14, Crown Crystal Mall, Plot 36 Providence Street, Marwa, Lekki, Lagos State
    - Shop TF-B18, Mall of Dubai, Plot 158 Gimbiya Street, Garki Area 11, FCT
    - +234 807 340 3568 · cnmessentials@cnm-group.net
  - "We accept: Visa · Mastercard · PayPal". © CNM Essentials, part of CNM Group.

## Data
Create `src/data/products.ts`. The currency is NGN; format as `₦17,850` or `₦14,888.75` (up to 2 decimals). All brands are sold by CNM. The image for each product is `https://cnmgg.netlify.app/assets/products/{id}.webp` (portrait 3:4, white background: show with object-contain on white).

| id | name | brand | type | category | price |
|---|---|---|---|---|---|
| midnight-vanilla-room-spray | Midnight Vanilla | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| love-stoned-room-spray | Love Stoned | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| petalrich-room-spray | Petalrich | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| that-paris-hotel-room-spray | That Paris Hotel | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| rose-bohemian-room-spray | Rose Bohemian | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| crushed-room-spray | Crushed | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| all-dressed-up-room-spray | All Dressed Up | Victoria's Secret | Room Spray | room-home-fragrance | 17850 |
| nurses-day-off-wallflower-refill | Nurses Day Off | Bath & Body Works | Wallflower Refill | diffusers-refills | 14888.75 |
| pumpkin-bonfire-room-spray | Pumpkin Bonfire | Bath & Body Works | Room Spray | room-home-fragrance | 16125 |
| wallflower-socket-gray-wallflower-plug-in | Wallflower Socket Gray | Bath & Body Works | Wallflower Plug-In | diffusers-refills | 31121.25 |
| warm-ocean-breeze-wallflower-plug-in-refill | Warm Ocean Breeze | Bath & Body Works | Wallflower Plug-In Refill | diffusers-refills | 14888.8 |
| watermelon-lemonade-wallflower-plug-in-refill | Watermelon Lemonade | Bath & Body Works | Wallflower Plug-In Refill | diffusers-refills | 14888.75 |
| white-jasmine-odour-eliminator | White Jasmine | Febreze | Odour Eliminator | room-home-fragrance | 9621.25 |
| white-tea-and-sage-room-spray | White Tea & Sage | Bath & Body Works | Room Spray | room-home-fragrance | 16125 |
| sugarplum-delight-odour-eliminator | Sugarplum Delight | Febreze | Odour Eliminator | room-home-fragrance | 9621.25 |
| sun-kissed-santa-wallflower-plug-in-refill | Sun Kissed Santa | Bath & Body Works | Wallflower Plug-In Refill | diffusers-refills | 14888.8 |
| sun-kissed-vanilla-odour-eliminator | Sun Kissed Vanilla | Bath & Body Works | Odour Eliminator | room-home-fragrance | 9621.25 |
| sweet-pea-wallflower-plug-in-refill | Sweet Pea | Bath & Body Works | Wallflower Plug-In Refill | diffusers-refills | 14888.8 |
| the-perfect-christmas-wallflower-plug-in-refill | The Perfect Christmas | Bath & Body Works | Wallflower Plug-In Refill | diffusers-refills | 14888.75 |
| the-perfect-christmas-room-spray | The Perfect Christmas | Bath & Body Works | Room Spray | room-home-fragrance | 16125 |

**Categories** (banner images at `https://cnmgg.netlify.app/assets/campaign/{slug}.webp`, square): `room-home-fragrance` "Room & Home Fragrance", `diffusers-refills` "Diffusers & Refills", `body-care` "Body Care", `hair-care` "Hair Care". Body Care and Hair Care have no products yet; their pages show "Coming soon online — visit our stores".

**Never invent product facts.** Descriptions, scent notes, ingredients, sizes and stock are not supplied yet. Where they would appear, show a subtle dashed "Details coming soon" box. Stock is unknown, so show "Availability to be confirmed" and allow ordering.

## Pages
1. **Home**
   - **Hero:** dark charcoal hero with a soft yellow glow. Eyebrow "WELCOME TO CNM ESSENTIALS". Huge serif headline "Refresh Your Space." with "Indulge Your Senses." on a new line in italics. Lead: "Bring home signature scents that create comfort, class, and lasting impressions". Yellow "Shop now" button and an outline "Our story" button. On the right, the room-home-fragrance banner image.
   - **"Shop by category":** 4 square banner tiles.
   - **Carousel** "Room sprays & odour eliminators", with arrows.
   - **Split section:**
     - Left: the diffusers-refills banner.
     - Right: "The room, *remembered.*" and "Wallflowers plug-ins and refills to keep every room scented."
   - **"Shop by brand":** Victoria's Secret, Bath & Body Works, Febreze, each linking to `/shop?brand=`.
   - **Dark "For business" section:** "Lease-to-Own Programme — Commercial diffuser solutions for businesses, in Lagos and Abuja". Key products: Industrial Diffuser series · Wellbeing Essential Oils · Body butters & hair oils · Candles, mists & humidifiers. Buttons: Enquire and How it works.
   - **"Featured"** grid of 8 products.
   - **About split:**
     - Image: `https://cnmgg.netlify.app/assets/stores/cnm-essentials-store-interior.webp`.
     - Heading: "Where Luxury Meets Atmosphere."
     - Text: "A premium lifestyle brand offering luxury fragrances, home décor, and body care products crafted for the intentional woman and the discerning home. CNM Essentials is the fragrance and lifestyle destination for those who believe that how you live at home reflects who you are in the world."
     - Stats: "4 Curated collections" and "100% Premium sourced".
   - **4 promises** with yellow icons: Swift Shipping (On each order), Secure Payment (100% protected), Premium Quality (Handcrafted with care), Swift Support (Always here to help).
   - **Stores:** Lagos and Abuja cards with the addresses above.
   - **Newsletter:** "Stay in the Loop — Subscribe for exclusive offers, new arrivals, and fragrance tips delivered to your inbox."
2. **Shop (`/shop`, `/shop/:category`)**
   - Title "Shop now". Intro: "Shop luxury diffusers, candles, and home scents designed to leave every room unforgettable."
   - Category chips.
   - **Filters** (left sidebar on desktop, bottom sheet on mobile): Category, Brand, Product type, Price min/max. Show counts.
   - Sort: Featured, Price low–high, Price high–low, Name. Filters update instantly and are stored in the URL.
   - **Product card:** image, wishlist heart, "Add to bag" on hover, type label, brand in bold caps, name, price.
3. **Product page (`/products/:id`)**
   - Large image with zoom on desktop and swipe on mobile. Type, brand (links to the brand filter), serif name, price, availability.
   - Quantity stepper, "Add to bag", wishlist heart, "Buy now".
   - Promises strip. Accordion: Description, Scent notes, How to use, Size, Delivery, Returns, Store availability (Lagos/Abuja, "Call to check" linking to tel:), FAQs.
   - "Complete the experience" (same product type), then "Recently viewed". Sticky add-to-bag bar on mobile.
4. **Search:** full-width overlay with predictive, typo-tolerant search across names, brands, types and categories. Recent searches (localStorage) and popular searches: Room spray, Wallflowers refill, Victoria's Secret, Bath & Body Works, Vanilla, Odour eliminator. The no-results state recommends products.
5. **Wishlist:** kept in localStorage. Move to bag, remove, share link.
6. **Bag:** slide-out drawer plus a `/bag` page.
   - Line items with quantity, remove and move to wishlist.
   - Promo code `STAGING10` gives 10% off.
   - Delivery estimate selector: Lagos ₦3,500, Abuja (FCT) ₦4,500, Nationwide ₦8,000, Collect in store free. Lagos and Abuja delivery are free over ₦150,000. Label these fees as placeholders.
   - VAT 7.5% included (shown as a line). Totals round to the kobo.
7. **Checkout (`/checkout`):** steps Contact → Delivery (method plus Nigerian address with a state select, or store pickup) → Payment (card, bank transfer or USSD) → Review. Then a staging payment simulator with "Simulate successful payment" / "Simulate failed payment". Success goes to `/checkout/confirmation`: order number `CNM-YYMMDD-XXXXX`, a progress tracker (Placed → Paid → Processing → Dispatched → Delivered) and the order summary. Save orders in localStorage for now.
8. **Account:** sign in, register, forgot password (UI only for now), and order history from localStorage.
9. **Our Story:** hero "Where Luxury Meets Atmosphere.", the brand description, core activities (Luxury fragrance curation · Home décor & ambiance · Body care & wellness · Commercial diffuser leasing), key value proposition ("Purpose-crafted luxury for modern living — combining natural ingredients, artisanal quality, and a deep sense of intentionality that transforms everyday rituals into meaningful experiences."), mission, vision, and the six values (Excellence, Integrity, Innovation, Social Impact, People-Centricity, Purpose). Founder section: "Details coming soon".
10. **Stores (`/stores`, `/stores/lagos`, `/stores/abuja`):** address, phone, "Get directions" link to Google Maps, a map embed, services (In-store shopping · Collect in store · Lease-to-Own commercial diffusers), and "Opening hours coming soon".
11. **For business (`/fragrance-as-a-service`):** Lease-to-Own Programme hero, the sectors served (Events, Weddings, Corporate events, Hospitality, Retail spaces, Offices, Brand activations, Scent-machine solutions), a 4-step process (Enquire, Consult, Scent, Maintain), and an enquiry form (name, company, email, phone, project type, event date, location, message, consent).
12. **CNM Group (`/cnm-group`)**
   - **Hero:** navy `#1d2b4a` with the logo `https://cnmgg.netlify.app/assets/brand/cnm-group-logo.png`, "Creating Sustainable Businesses That Transcend Industries", and stats 16 Years · 4 Business entities · 2 Countries · ISO 9001:2015. Motto: "Driven by Excellence. Defined by Trust."
   - **Divisions:** three columns.
     - **Retail:** CNM Essentials (links to `/`, "Shop now") and CNM Spectra.
     - **Energy:** CNMWorX Limited.
     - **Impact:** CNM Foundation.
     - Logos: `/assets/brand/cnm-spectra-logo.jpg`, `/assets/brand/cnmworx-logo.jpg` and `/assets/brand/cnm-foundation-logo.jpg`, all on `https://cnmgg.netlify.app`.
   - **Contact:** info@cnm-group.net, +234 901 544 5554, and a message form.
13. **Legal and help:** Privacy, Terms, Delivery & returns, FAQs, Contact, 404.

## Quality
- Semantic HTML, alt text, visible focus rings, keyboard-accessible menus, drawers and dialogs (focus trap, Esc to close), AA contrast.
- Lazy-load images. Use skeletons, not spinners, for lists.
- **Loader:** a small "butterfly" loader. Two sage wing shapes drift together and merge into a droplet. Show it only when an action takes longer than 250 ms, and never add artificial delays.
- Per-page titles and meta descriptions.

---

## Follow-up prompt: fixes after review (paste into Lovable as a new message)

```
Please fix these four issues across the whole site. Keep the existing design, colours, fonts and real product data. Do not invent products, prices or facts.

1. NEVER PUT TEXT ON TOP OF CAMPAIGN ARTWORK
The CNM campaign images (Room & Home Fragrance, Diffusers & Refills, Body Care, Hair Care) already have words and product packaging printed on them. Right now titles like "CNM Essentials", "Pure. Natural. Purposeful." and "Explore" are laid on top, so the words collide and the image is cropped.
- Show these images whole: object-fit: contain, keep their square 1:1 aspect ratio, and put a soft neutral background behind them. Never crop them with object-fit: cover.
- Put any heading, tagline, number ("01 — ...") and button BELOW or BESIDE the image, never over it. No dark gradient overlays on these images.
- On company cards (CNM Group page), use the company logo or a plain photo without printed text as the image. Show the name, tagline and "Explore" button in a text area under the image.
- Check at 360, 390, 768, 1024 and 1440 px wide: every word printed in the artwork must be fully visible, and nothing may overlap.

2. ALWAYS A WAY BACK TO CNM GROUP
- Add a thin navy bar (#1d2b4a, white text, 36px tall) at the very top of EVERY page of every company (CNM Essentials shop, product pages, bag, checkout, account, Spectra, CNMWorX, Foundation).
- Left side: "← CNM Group", linking to the CNM Group home page.
- Right side: links to CNM Essentials, Spectra, CNMWorX and Foundation, with the current company underlined. On phones, show only the current company.
- The CNM Group logo in the group header always links to the CNM Group home page.
- The mobile menu ends with "← Back to CNM Group".

3. SHOPPING NEVER REQUIRES AN ACCOUNT
- Browsing, search, product pages, the wishlist (saved on the device), the bag and the whole checkout must all work as a guest. Nothing redirects to a login page.
- Only offer an account when the shopper is about to pay, and make it a choice. At the top of checkout show "Checking out as a guest. No account needed." with two small text links, "Sign in" and "Create account". Both are optional; closing them leaves checkout exactly as it was.
- If they sign in during checkout, prefill their name, email, phone and default address, and show "Signed in as <email>".
- On the order confirmation page, offer "Create an account (optional)" with their email prefilled.

4. SIGN IN AND SIGN UP (Supabase Auth)
- Build a sign-in / create-account dialog: a centred modal on desktop and a bottom sheet on phones. It has two tabs, "Sign in" and "Create account".
- Default method is an email one-time code (Supabase signInWithOtp with a 6-digit code). Enter email → "Email me a code" → enter the code → signed in. The code field auto-submits at 6 digits. There's a "Resend code" button with a 60-second countdown, and "Use a password instead" as an alternative.
- Create account asks for first name, last name and email, plus an optional marketing tick-box, then uses the same code step. Password sign-up needs at least 10 characters.
- Open the dialog from: the header account icon (when signed out), the mobile menu ("Sign in" / "Create account" buttons), the checkout links, the wishlist note and the confirmation page. After success, stay on the same page, show a small toast "Signed in as ...", and merge the guest wishlist into the account.
- When signed in, the account icon goes to /account (orders, addresses, profile, wishlist, sign out).
- Show clear errors: wrong code (with attempts left), expired code, too many attempts, and "please wait before requesting another code".
```

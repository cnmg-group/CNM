# SEO, analytics and the 10-year search plan

No rankings are promised. This plan builds the strongest legitimate foundation for organic visibility.

## Technical foundation (implemented)

| Requirement | Implementation |
| --- | --- |
| Indexable, server-rendered pages | Pre-rendered HTML for every public page |
| Clean URLs | `/shop/<category>/`, `/collections/<slug>/`, `/products/<slug>/`, `/stores/<city>/`, `/journal/<slug>/` |
| Canonicals, OG and Twitter cards | `renderPage()`; per-page overrides in Admin → SEO |
| Sitemap and robots | `/sitemap.xml` (indexable pages only); `robots.txt` blocks everything on staging and blocks account, checkout, bag, search, API and admin in production |
| Structured data | Organization, WebSite + SearchAction, BreadcrumbList, ItemList, Product, Article, Service, Store/LocalBusiness |
| Guardrails | Product `offers` and the Merchant feed only include **approved** prices; LocalBusiness only appears for **verified** stores; draft articles are noindexed; empty categories are not generated |
| Images | Explicit dimensions, lazy-loading below the fold, descriptive alt text (importer carries CNM alt text) |
| Redirects | Admin → SEO & redirects (Netlify `_redirects`) |
| Merchant Center | `/feeds/google-merchant.xml` |

## Product SEO rules
Each product needs a unique title and description (never templated boilerplate), an SEO title of 70 characters or fewer and a meta description of 160 or fewer (Admin → Products), original imagery with alt text, correct availability and price, and a GTIN where one exists.

## Category SEO rules
Build landing pages only for genuine commercial intent: Home Fragrance, Diffuser Oils, Refill Oils, Smart Scent Machines, Body Care, Car Fragrance and Stoneglow. Each has a unique intro, which CNM must supply. Do not create thin keyword pages.

## Local SEO
- Store pages `/stores/lagos/` and `/stores/abuja/` must show NAP (name, address, phone), hours, map, directions, services and original photography.
- Keep NAP identical across the site, both Google Business Profiles, Apple Business Connect, Bing Places and legitimate Nigerian directories.
- Reviews: ask genuine customers after delivery (post-delivery email, in-store QR card linking to the Google review form). Never incentivise, gate or fabricate reviews.

## Analytics and conversion tracking
GA4 (loaded only after consent) plus a first-party, cookie-less collector (`/api/events`, shown in Admin → Analytics).

| Event | Trigger |
| --- | --- |
| `view_item_list` | Product cards 50% visible (per list) |
| `select_item` | Product card click |
| `view_item` | PDP |
| `add_to_wishlist` | Heart |
| `add_to_cart` / `remove_from_cart` | Bag actions |
| `view_cart` | Bag page |
| `begin_checkout` | Checkout button |
| `add_shipping_info` / `add_payment_info` | Checkout steps |
| `purchase` | Confirmation (deduplicated per order) |
| `payment_failed` | Declined payment |
| `search` / `filter_products` | Search and filters (zero-result terms are reported) |
| `generate_lead` | Fragrance as a Service enquiry |
| `sign_up` / `login` | Newsletter and account |
| `store_directions` | Store "Get directions" |

Funnel: view_item → add_to_cart → begin_checkout → add_payment_info → purchase (Admin → Analytics).

## 10-year search architecture

| Horizon | Focus |
| --- | --- |
| **Year 1** | Launch the technical foundation; import the real catalogue with unique copy; verify Search Console; set up Merchant Center; optimise both Google Business Profiles; monthly Core Web Vitals review; publish 2–4 useful articles a month (scent by room, diffuser care, refills, gifting). |
| **Year 2** | Topical authority: fragrance families, diffuser oils, smart scent machines, body rituals and commercial scenting (hospitality, offices, events), with case studies once clients approve. Internal linking from guides to products and categories. |
| **Years 3–4** | Expand category depth and content nationally, driven by real demand (Admin zero-result searches, Search Console queries, sales data). Add city or service pages only where CNM actually operates. |
| **Year 5** | International architecture (hreflang, localised currencies) only for markets CNM actually ships to. |
| **Years 6–7** | Proprietary assets: a scent-finder tool, room-by-room scent guides, video education, a commercial-scenting ROI guide and industry resources that earn links. |
| **Years 8–10** | Protect brand authority. Refresh top performers, prune or merge weak pages (with 301 redirects), and grow search infrastructure only alongside genuine business or geographic expansion. |

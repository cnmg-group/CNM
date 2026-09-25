# Content awaiting CNM approval

Nothing below has been invented. Every unverified fact is either empty (`null`) or visibly flagged on the staging site with a dashed **Needs CNM approval** box or a **Demo** tag.

| Area | File / place | What's needed |
| --- | --- | --- |
| Logo | `public/assets/brand/cnm-logo.svg` | Original logo file |
| Products | `content/products.json` (or run the importer) | Real catalogue: names, descriptions, scent notes, ingredients (only if supplied), how to use, sizes, care, variants, prices, stock, photography, video |
| Product flags | `isNew`, `isBestSeller` | Which products are genuinely new or best sellers |
| Categories | `content/categories.json` | Confirm the category list and intro copy; empty categories are hidden automatically |
| Homepage copy | `content/site.json`, Admin → Content | Tagline, headline, lead, brand statement, smart-scent capabilities |
| Our Story | `content/story.json` | Company story in CNM's own words, founder name/title/portrait/quote, philosophies, dated milestones |
| Stores | Admin → Stores | Exact name, address, phone, hours, coordinates and photos; must match the Google Business Profile. Tick **Verified** to publish LocalBusiness schema and the map |
| Fragrance as a Service | `content/services.json` | Which sectors are offered, process wording, FAQ answers, real case studies and gallery |
| Commerce rules | `content/commerce.json` | Delivery methods, fees, regions and free-delivery thresholds; VAT treatment; returns policy; payment provider |
| Legal | `/privacy/`, `/terms/` | Privacy notice (NDPA 2023) and terms of sale from counsel |
| Contact and social | `content/site.json` | Customer care email, phone, WhatsApp and official social URLs |
| CNM Group | `content/site.json` → `group.divisions` | Energy and Impact descriptions and URLs |
| Journal | `content/articles/*.md` | Three draft general-education articles (`status: DRAFT_NEEDS_CNM_APPROVAL`, noindexed) for editorial review |
| Mobile | `mobile/app.json`, `eas.json` | Bundle ID, Apple Team ID, Play signing fingerprint, app icon and splash made from the original logo |

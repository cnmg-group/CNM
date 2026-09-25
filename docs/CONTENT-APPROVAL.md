# Content awaiting CNM approval

Nothing below has been invented. Every unverified fact is either empty (`null`) or visibly flagged on the staging site with a dashed **Needs CNM approval** box or a **Demo** tag.

| Area | File / place | What's needed |
| --- | --- | --- |
| Logo | `public/assets/brand/cnm-logo.png` | In use (from cnm-group.net). Supply the master SVG for sharper rendering |
| Products | `content/products.json` | 20 products from cnmessentials.com are in use. Still needed: the remaining catalogue pages, descriptions, scent notes, ingredients (only if supplied), how to use, sizes, care, stock, and brand confirmation for Sun Kissed Vanilla |
| Product flags | `isNew`, `isBestSeller` | Which products are genuinely new or best sellers |
| Categories | `content/categories.json` | Confirm the category list and intro copy; empty categories are hidden automatically |
| Homepage copy | `content/site.json`, Admin → Content | In use (from cnmessentials.com). Review the two editorial lines added for the diffusers section |
| Our Story | `content/story.json` | Company story in CNM's own words, founder name/title/portrait/quote, philosophies, dated milestones |
| Stores | Admin → Stores | Addresses, phone and email are in use (from cnmessentials.com). Still needed: opening hours, coordinates, per-store photos, and which store the interior photo shows |
| Fragrance as a Service | `content/services.json` | Which sectors are offered, process wording, FAQ answers, real case studies and gallery |
| Commerce rules | `content/commerce.json` | Delivery methods, fees, regions and free-delivery thresholds; VAT treatment; returns policy; payment provider |
| Legal | `/privacy/`, `/terms/` | Privacy notice (NDPA 2023) and terms of sale from counsel |
| Contact and social | `content/site.json` | Email and phone are in use. Still needed: Instagram and WhatsApp URLs |
| CNM Group | `content/site.json` → `group` | In use (from cnm-group.net). Still needed: direct URLs for CNM Spectra, CNMWorX and CNM Foundation |
| Journal | `content/articles/*.md` | Three draft general-education articles (`status: DRAFT_NEEDS_CNM_APPROVAL`, noindexed) for editorial review |
| Mobile | `mobile/app.json`, `eas.json` | Bundle ID, Apple Team ID, Play signing fingerprint, app icon and splash made from the original logo |

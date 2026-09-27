import { productCardHTML } from '../shared/card.mjs';
import { escapeHtml, formatDate } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { approval } from './layout.mjs';

const PROMISE_ICONS = {
  truck: icon('truck'),
  lock: icon('lock'),
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4M17 5h4"/></svg>',
  headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/></svg>',
};

export const promisesHTML = (site) => `<div class="promises">${site.promises.value.map(([ic, t, d]) => `<div><div class="ic">${PROMISE_ICONS[ic] || ''}</div><strong>${escapeHtml(t)}</strong><span class="muted" style="font-size:.875rem">${escapeHtml(d)}</span></div>`).join('')}</div>`;

export function homePage(ctx) {
  const { site, products, articles, stores, categories, brands } = ctx;
  const byCat = (slug) => products.filter((p) => p.category === slug);
  const room = byCat('room-home-fragrance');
  const diff = byCat('diffusers-refills');
  const bannerCats = categories.filter((c) => c.banner);
  const featured = ctx.homepage?.featured?.length ? products.slice(0, 8) : [...room.slice(0, 4), ...diff.slice(0, 4)];
  const [h1a, h1b] = site.heroHeadline.value.split(/(?<=\.)\s+/);

  return `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media" aria-hidden="true"><div class="hero__atmos"></div>${ctx.heroVideo ? `<video src="${escapeHtml(ctx.heroVideo)}" autoplay muted loop playsinline preload="metadata"></video>` : ''}</div>
  <div class="container hero__inner hero__inner--split">
    <div>
      <span class="label hero__eyebrow">${escapeHtml(site.tagline.value)}</span>
      <h1 id="hero-title" class="display">${escapeHtml(h1a)}${h1b ? `<br><em class="italic">${escapeHtml(h1b)}</em>` : ''}</h1>
      <p class="lead">${escapeHtml(site.heroLead.value)}</p>
      <div class="hero__cta">
        <a class="btn btn--light" href="/shop/" data-promo="hero-shop">Shop now</a>
        <a class="btn btn--ghost-light" href="/our-story/">Our story</a>
      </div>
    </div>
    <a class="hero__feature" href="/shop/room-home-fragrance/" aria-label="Shop room and home fragrance"><img src="/assets/campaign/room-home-fragrance.webp" alt="Room and home fragrance — CNM Essentials campaign" width="1094" height="1092" fetchpriority="high"></a>
  </div>
</section>

<section class="section section--tight" aria-labelledby="cat-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Browse</span><h2 id="cat-title" class="h2">Shop by category</h2></div><a class="link" href="/shop/">Shop all ${icon('arrow')}</a></div>
    <div class="banner-grid">${bannerCats.map((c) => `<a class="banner" href="/shop/${c.slug}/" data-promo="cat-${c.slug}"><img src="${c.banner}" alt="${escapeHtml(c.name)} — CNM Essentials campaign" loading="lazy" width="1094" height="1092"><span class="banner__cap">${escapeHtml(c.name)} ${icon('arrow')}</span></a>`).join('')}</div>
  </div>
</section>

<section class="section section--cream section--tight" aria-labelledby="finder-title">
  <div class="container finder-cta">
    <div><span class="label muted">Not sure where to start?</span><h2 id="finder-title" class="h2">Find your scent in four questions</h2><p class="lead" style="max-width:36rem">Tell us the scents you love, the room and the mood. We’ll suggest pieces from the range.</p></div>
    <a class="btn btn--green" href="/scent-finder/" data-track="scent_finder_cta">Try the scent finder</a>
  </div>
</section>

<section class="section section--tight" aria-labelledby="room-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Room &amp; home fragrance</span><h2 id="room-title" class="h2">Room sprays &amp; odour eliminators</h2></div>
      <div style="display:flex;gap:16px;align-items:center"><div class="rail-controls" data-rail-controls="room"><button type="button" aria-label="Previous" data-rail-prev>${icon('arrowLeft')}</button><button type="button" aria-label="Next" data-rail-next>${icon('arrow')}</button></div><a class="link" href="/shop/room-home-fragrance/">Shop ${icon('arrow')}</a></div></div>
    <div class="rail" data-rail="room" data-impressions="home_room">${room.map((p, i) => productCardHTML(p, { position: i + 1, list: 'home_room' })).join('')}</div>
  </div>
</section>

<section class="split section--cream" aria-labelledby="diff-title">
  <div class="split__media"><img src="/assets/campaign/diffusers-refills.webp" alt="Diffusers and refills — CNM Essentials campaign" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
  <div class="split__copy reveal">
    <span class="label muted">Diffusers &amp; refills</span>
    <h2 id="diff-title" class="h1">The room, <em class="italic">remembered.</em></h2>
    <p class="lead">Wallflowers plug-ins and refills to keep every room scented.</p>
    <div><a class="link" href="/shop/diffusers-refills/">Shop diffusers &amp; refills ${icon('arrow')}</a></div>
    <p class="muted" style="font-size:.8125rem">${diff.length} products</p>
  </div>
</section>

<section class="section section--tight" aria-labelledby="brand-title">
  <div class="container center">
    <span class="label muted">Curated brands</span>
    <h2 id="brand-title" class="h2" style="margin:12px 0 32px">Shop by brand</h2>
    <div class="brand-row">${brands.map((b) => `<a href="/shop/?brand=${encodeURIComponent(b)}">${escapeHtml(b)}</a>`).join('')}</div>
  </div>
</section>

<section class="section section--green" aria-labelledby="biz-title">
  <div class="container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:clamp(32px,6vw,96px);align-items:center">
    <div class="stack reveal">
      <span class="label">For business</span>
      <h2 id="biz-title" class="h1">${escapeHtml(ctx.services.programme.value.name)}</h2>
      <p class="lead">${escapeHtml(ctx.services.programme.value.text)}, in Lagos and Abuja.</p>
      <div class="hero__cta"><a class="btn btn--light" href="/fragrance-as-a-service/#enquire">Enquire</a><a class="btn btn--ghost-light" href="/fragrance-as-a-service/">How it works</a></div>
    </div>
    <div><span class="label">Key products</span><ul style="margin-top:12px">${site.keyProducts.value.map((k) => `<li style="display:flex;gap:12px;align-items:center;border-bottom:1px solid rgba(255,255,255,.14);padding:14px 0;font-size:1.125rem">${icon('check')} ${escapeHtml(k)}</li>`).join('')}</ul></div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="feat-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Curated</span><h2 id="feat-title" class="h2">Featured</h2></div><a class="link" href="/shop/">Shop all ${icon('arrow')}</a></div>
    <div class="grid-products" data-impressions="home_featured">${featured.map((p, i) => productCardHTML(p, { position: i + 1, list: 'home_featured' })).join('')}</div>
  </div>
</section>

<section class="split" aria-labelledby="story-title">
  <div class="split__media"><img src="${ctx.story.image.src}" alt="${escapeHtml(ctx.story.image.alt)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
  <div class="split__copy reveal">
    <span class="label muted">About CNM Essentials</span>
    <h2 id="story-title" class="h1">${escapeHtml(ctx.story.headline.value)}</h2>
    <p class="lead">${escapeHtml(site.description.value)}</p>
    <div class="stat-row">${ctx.story.stats.value.map(([n, l]) => `<div><strong style="color:var(--ink)">${escapeHtml(n)}</strong><span class="label muted">${escapeHtml(l)}</span></div>`).join('')}</div>
    <div><a class="link" href="/our-story/">Discover our story ${icon('arrow')}</a></div>
  </div>
</section>

<section class="section section--cream section--tight" aria-label="Our promise">
  <div class="container">${promisesHTML(site)}</div>
</section>

<section class="section" aria-labelledby="stores-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Visit us</span><h2 id="stores-title" class="h2">Lagos &amp; Abuja</h2></div><a class="link" href="/stores/">All stores ${icon('arrow')}</a></div>
    <div class="store-cards">${stores.map((s) => `<a class="store-card" href="/stores/${s.slug}/" style="background:var(--ink);color:#fff">${s.images?.[0] ? `<img src="${s.images[0].src}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5">` : ''}<div style="position:relative" class="stack"><span class="label" style="color:var(--gold)">CNM Essentials</span><p class="store-card__city">${escapeHtml(s.city)}</p><p style="max-width:28rem">${escapeHtml(s.address)}</p><span class="link">Store details ${icon('arrow')}</span></div></a>`).join('')}</div>
  </div>
</section>

<section class="section section--cream" aria-labelledby="journal-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Journal</span><h2 id="journal-title" class="h2">Notes on scent</h2></div><a class="link" href="/journal/">Read the journal ${icon('arrow')}</a></div>
    <div class="journal-grid">${articles.slice(0, 3).map((a, i) => articleCard(a, i)).join('')}</div>
  </div>
</section>

<section class="section" aria-labelledby="nl-title">
  <div class="container newsletter">
    <div><span class="label muted">Community</span><h2 id="nl-title" class="h1" style="margin-top:12px">${escapeHtml(site.newsletter.value.title)}</h2></div>
    <div class="stack">
      <p class="lead">${escapeHtml(site.newsletter.value.text)}</p>
      <form class="inline-form" data-newsletter="home" novalidate>
        <label for="nl-home" class="sr-only">Email address</label>
        <input id="nl-home" type="email" name="email" placeholder="Enter your email" autocomplete="email" required>
        <input type="hidden" name="consent" value="true">
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
</section>
<noscript><style>.reveal{opacity:1;transform:none}</style></noscript>`;
}

const ARTICLE_ART = ['/assets/campaign/room-home-fragrance.webp', '/assets/campaign/diffusers-refills.webp', '/assets/stores/cnm-essentials-store-interior.webp'];
export function articleCard(a, i = 0) {
  return `<article class="article-card"><a href="/journal/${a.slug}/">
    <div class="article-card__media"><img src="${a.image || ARTICLE_ART[i % 3]}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
    <span class="label muted">${escapeHtml(a.category)}</span>
    <h3 class="h3">${escapeHtml(a.title)}</h3>
    <p>${escapeHtml(a.excerpt)}</p>
    <span class="muted" style="font-size:.75rem">${formatDate(a.date)}</span>
  </a></article>`;
}

export { approval };

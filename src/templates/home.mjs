import { productCardHTML } from '../shared/card.mjs';
import { escapeHtml, formatDate } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { approval, butterflySVG } from './layout.mjs';

const art = (name) => `<img src="/assets/art/${name}.svg" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
const productArt = (key) => `<img src="/assets/placeholders/${key}-alt.svg" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;

export function homePage(ctx) {
  const { site, products, articles, stores } = ctx;
  const newIn = products.filter((p) => p.isNew);
  const featured = ctx.homepage?.featured?.length ? products.slice(0, 8) : [...products].sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller)).slice(0, 8);
  const byCat = (slug) => products.filter((p) => p.category === slug);

  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media" aria-hidden="true"><div class="hero__atmos"></div>${ctx.heroVideo ? `<video src="${escapeHtml(ctx.heroVideo)}" autoplay muted loop playsinline preload="metadata"></video>` : ''}</div>
  <img class="hero__vessel" src="/assets/art/hero-vessel.svg" alt="" width="400" height="800" fetchpriority="high">
  <div class="container hero__inner">
    <span class="label hero__eyebrow">${escapeHtml(site.tagline.value)}</span>
    <h1 id="hero-title" class="display">${escapeHtml(site.heroHeadline.value)}</h1>
    <p class="lead">${escapeHtml(site.heroLead.value)}</p>
    <div class="hero__cta">
      <a class="btn btn--light" href="/shop/new-in/" data-promo="hero-new-in">Shop new in</a>
      <a class="btn btn--ghost-light" href="/our-story/">Our story</a>
    </div>
  </div>
  <span class="hero__scroll" aria-hidden="true"></span>
</section>

<section class="section statement" aria-label="Introduction">
  <div class="container reveal">
    <span class="label muted">CNM Essentials</span>
    <p style="margin-top:24px">Fragrance for the home, <em>rituals</em> for the body, and technology that keeps every room ready.</p>
    <div style="max-width:560px;margin:32px auto 0">${approval('Brand statement copy.', 'Replace with CNM-approved wording.')}</div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="new-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Just arrived</span><h2 id="new-title" class="h2">New in</h2></div>
      <div style="display:flex;gap:16px;align-items:center"><div class="rail-controls" data-rail-controls="new"><button type="button" aria-label="Previous" data-rail-prev>${icon('arrowLeft')}</button><button type="button" aria-label="Next" data-rail-next>${icon('arrow')}</button></div><a class="link" href="/shop/new-in/">Shop new in ${icon('arrow')}</a></div></div>
    <div class="rail" data-rail="new" data-impressions="home_new_in">${(newIn.length ? newIn : products).map((p, i) => productCardHTML(p, { position: i + 1, list: 'home_new_in' })).join('')}</div>
  </div>
</section>

<section class="split" aria-labelledby="hf-title">
  <div class="split__media">${productArt('reed')}</div>
  <div class="split__copy reveal">
    <span class="label muted">Home fragrance</span>
    <h2 id="hf-title" class="h1">The room,<br><em class="italic">remembered.</em></h2>
    <p class="lead">Reed diffusers and home fragrance to scent the rooms you live in.</p>
    <div><a class="link" href="/shop/home-fragrance/">Explore home fragrance ${icon('arrow')}</a></div>
    <p class="muted" style="font-size:.8125rem">${byCat('home-fragrance').length} products · including the Stoneglow collection</p>
  </div>
</section>

<section class="split split--reverse section--cream" aria-labelledby="oil-title">
  <div class="split__media">${productArt('dropper')}</div>
  <div class="split__copy reveal">
    <span class="label muted">Diffuser &amp; refill oils</span>
    <h2 id="oil-title" class="h1">Scent, <em class="italic">concentrated.</em></h2>
    <p class="lead">Oils made for CNM diffusers and scent machines, with refills for the scents you already love.</p>
    <div style="display:flex;gap:24px;flex-wrap:wrap"><a class="link" href="/shop/diffuser-oils/">Diffuser oils ${icon('arrow')}</a><a class="link" href="/shop/refill-oils/">Refill oils ${icon('arrow')}</a></div>
  </div>
</section>

<section class="section section--green" aria-labelledby="tech-title">
  <div class="container">
    <div class="section-head reveal"><div><span class="label">Smart scent technology</span><h2 id="tech-title" class="h1" style="max-width:14ch;margin-top:12px">Atmosphere, engineered.</h2></div>
      <a class="btn btn--light" href="/shop/smart-scent-machines/">Shop scent machines</a></div>
    <div class="tech reveal">
      <div><span class="num">01</span><div><h3 class="h3">Consistent coverage</h3><p class="muted">Scent machines diffuse fragrance steadily across larger spaces.</p></div></div>
      <div><span class="num">02</span><div><h3 class="h3">Control</h3><p class="muted">Adjust intensity and timing to suit the space.</p></div></div>
      <div><span class="num">03</span><div><h3 class="h3">For home &amp; business</h3><p class="muted">From living rooms to lobbies, with service available for commercial spaces.</p></div></div>
    </div>
    <div style="margin-top:24px;max-width:640px">${approval('Machine capabilities copy.', 'Confirm features, specifications and coverage figures before launch.')}</div>
  </div>
</section>

<section class="section" aria-labelledby="body-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Body care</span><h2 id="body-title" class="h2">Rituals for skin</h2></div><a class="link" href="/shop/body-care/">Shop body care ${icon('arrow')}</a></div>
    <div class="story-tiles">
      <a class="tile" href="/shop/body-care/"><div class="tile__art">${productArt('jar')}</div><div class="tile__copy"><span class="label">Body care</span><p class="h3">Body butter &amp; body wash</p><span class="link">Discover ${icon('arrow')}</span></div></a>
      <a class="tile" href="/shop/car-fragrance/"><div class="tile__art">${productArt('car')}</div><div class="tile__copy"><span class="label">Car fragrance</span><p class="h3">Carry your scent</p><span class="link">Discover ${icon('arrow')}</span></div></a>
      <a class="tile" href="/collections/stoneglow/"><div class="tile__art">${art('tile-stone')}</div><div class="tile__copy"><span class="label">Collection</span><p class="h3">Stoneglow</p><span class="link">Discover ${icon('arrow')}</span></div></a>
    </div>
  </div>
</section>

<section class="section section--cream section--tight" aria-labelledby="feat-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Curated</span><h2 id="feat-title" class="h2">Featured</h2></div><a class="link" href="/shop/">Shop all ${icon('arrow')}</a></div>
    <div class="grid-products" data-impressions="home_featured">${featured.map((p, i) => productCardHTML(p, { position: i + 1, list: 'home_featured' })).join('')}</div>
  </div>
</section>

<section class="split" aria-labelledby="story-title">
  <div class="split__media" style="background:var(--green)">${art('tile-green')}</div>
  <div class="split__copy reveal">
    <span class="label muted">Our story</span>
    <h2 id="story-title" class="h2">${escapeHtml(ctx.story.headline.value)}</h2>
    ${approval('Founder portrait and company story.', 'Original founder imagery and history to be supplied by CNM.')}
    <div><a class="link" href="/our-story/">Discover our story ${icon('arrow')}</a></div>
  </div>
</section>

<section class="section section--green" aria-labelledby="faas-title">
  <div class="container center reveal">
    <span class="label">Fragrance as a Service</span>
    <h2 id="faas-title" class="display" style="margin:20px auto;max-width:12ch">${escapeHtml(ctx.services.headline.value)}</h2>
    <p class="lead">${escapeHtml(ctx.services.lead.value)}</p>
    <div class="hero__cta" style="justify-content:center"><a class="btn btn--light" href="/fragrance-as-a-service/#enquire">Enquire</a><a class="btn btn--ghost-light" href="/fragrance-as-a-service/">How it works</a></div>
  </div>
</section>

<section class="section" aria-labelledby="stores-title">
  <div class="container">
    <div class="section-head"><div><span class="label muted">Visit us</span><h2 id="stores-title" class="h2">Lagos &amp; Abuja</h2></div><a class="link" href="/stores/">All stores ${icon('arrow')}</a></div>
    <div class="store-cards">${stores.map((s, i) => `<a class="store-card" href="/stores/${s.slug}/"><div class="tile__art" style="position:absolute;inset:0">${art(i ? 'tile-stone' : 'tile-cream')}</div><div style="position:relative"><span class="label">CNM Essentials</span><p class="store-card__city">${escapeHtml(s.city)}</p><span class="link">Store details ${icon('arrow')}</span></div></a>`).join('')}</div>
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
    <div><span class="label muted">Community</span><h2 id="nl-title" class="h1" style="margin-top:12px">Be the first to know.</h2></div>
    <div class="stack">
      <p class="lead">New collections, restocks and store events. Sent sparingly, never shared.</p>
      <form class="inline-form" data-newsletter="home" novalidate>
        <label for="nl-home" class="sr-only">Email address</label>
        <input id="nl-home" type="email" name="email" placeholder="Your email address" autocomplete="email" required>
        <input type="hidden" name="consent" value="true">
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
</section>
<noscript><style>.reveal{opacity:1;transform:none}</style></noscript>
<template data-butterfly>${butterflySVG()}</template>`;
  return body;
}

export function articleCard(a, i = 0) {
  return `<article class="article-card"><a href="/journal/${a.slug}/">
    <div class="article-card__media"><img src="/assets/art/${['tile-green', 'tile-cream', 'tile-stone'][i % 3]}.svg" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
    <span class="label muted">${escapeHtml(a.category)}</span>
    <h3 class="h3">${escapeHtml(a.title)}</h3>
    <p>${escapeHtml(a.excerpt)}</p>
    <span class="muted" style="font-size:.75rem">${formatDate(a.date)}</span>
  </a></article>`;
}

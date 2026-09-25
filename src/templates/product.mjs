import { priceHTML, productCardHTML } from '../shared/card.mjs';
import { escapeHtml } from '../shared/format.mjs';
import { icon } from '../shared/icons.mjs';
import { productImages, stockState } from '../shared/product.mjs';
import { approval, breadcrumbs } from './layout.mjs';

const pending = (what) => `<p class="muted" style="font-size:.875rem">${escapeHtml(what)} will appear here once supplied and approved by CNM.</p>`;

function section(title, content, open = false) {
  return `<details${open ? ' open' : ''}><summary>${escapeHtml(title)}</summary><div class="acc-body">${content}</div></details>`;
}

export function productPage(ctx, p) {
  const cat = ctx.categories.find((c) => c.slug === p.category);
  const { html: crumbs, ld: crumbLd } = breadcrumbs(ctx, [
    { name: 'Shop', path: '/shop/' },
    ...(cat ? [{ name: cat.name, path: `/shop/${cat.slug}/` }] : []),
    { name: p.name, path: `/products/${p.slug}/` },
  ]);
  const imgs = productImages(p);
  const stock = stockState(p);
  const related = (p.related || []).map((id) => ctx.products.find((x) => x.id === id)).filter(Boolean);
  const sameCat = ctx.products.filter((x) => x.category === p.category && x.id !== p.id && !related.includes(x));
  const complete = [...related, ...sameCat].slice(0, 4);
  const stores = ctx.stores;
  const delivery = ctx.commerce.deliveryMethods;

  const gallery = `<div class="gallery" data-gallery>
    <div class="gallery__thumbs" role="tablist" aria-label="Product images">${imgs
      .map((im, i) => `<button type="button" role="tab" aria-label="Image ${i + 1}" aria-current="${i === 0}" data-thumb="${i}"><img src="${im.src}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></button>`)
      .join('')}${p.video ? `<button type="button" data-thumb-video aria-label="Play video">${icon('arrow')}</button>` : ''}</div>
    <div class="gallery__main" data-zoom aria-label="Zoomable product image">${imgs
      .map((im, i) => `<div class="slide" data-slide="${i}"${i ? ' data-alt' : ''}><img src="${im.src}" alt="${escapeHtml(im.alt)}" width="800" height="1000" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`)
      .join('')}</div>
    <div class="gallery__dots" aria-hidden="true">${imgs.map((_, i) => `<span${i === 0 ? ' class="is-on"' : ''}></span>`).join('')}</div>
  </div>`;

  const variants = p.variants?.length
    ? `<fieldset style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:10px">Size</legend><div class="variant-list">${p.variants
        .map((v, i) => `<label class="chip"><input class="sr-only" type="radio" name="variant" value="${escapeHtml(v.id)}"${i === 0 ? ' checked' : ''}> ${escapeHtml(v.name)}</label>`)
        .join('')}</div></fieldset>`
    : '';

  const buy = stock.orderable
    ? `<div class="buy-actions">
        <div class="qty" data-qty><button type="button" data-qty-dec aria-label="Decrease quantity">${icon('minus')}</button><input type="number" inputmode="numeric" min="1" max="${Math.min(ctx.commerce.maxQtyPerLine, p.stock?.quantity ?? 99)}" value="1" aria-label="Quantity" data-qty-input><button type="button" data-qty-inc aria-label="Increase quantity">${icon('plus')}</button></div>
        <button class="btn btn--green" type="button" data-add="${p.id}" data-add-qty>Add to bag</button>
        <button class="icon-btn" type="button" data-wish="${p.id}" aria-pressed="false" aria-label="Save to wishlist">${icon('heart')}</button>
      </div>
      <button class="btn btn--ghost btn--block" type="button" data-buy-now="${p.id}">Buy now</button>`
    : `<div class="stack"><p class="alert">This product is currently out of stock.</p>
        <form class="form" data-back-in-stock="${p.id}" novalidate><div class="field"><label for="bis-email">Email me when it's back</label><div class="promo"><input id="bis-email" type="email" name="email" required autocomplete="email" placeholder="Email address"><button class="btn" type="submit">Notify me</button></div></div></form>
        <button class="btn btn--ghost btn--block" type="button" data-wish="${p.id}" aria-pressed="false">${icon('heart')} Save to wishlist</button></div>`;

  const storeAvail = stores
    .map((s) => `<li style="display:flex;justify-content:space-between;gap:12px;padding:6px 0"><a class="textlink" href="/stores/${s.slug}/">${escapeHtml(s.name)}</a><a class="muted" href="tel:${(s.phone || '').replace(/\s/g, '')}">Call to check</a></li>`)
    .join('');

  const accordion = `<div class="accordion">
    ${section('Description', p.description ? `<p>${escapeHtml(p.description)}</p>` : approval('Product description.', 'CNM to supply a unique, useful description for this product.'), true)}
    ${section('Scent notes', p.scentNotes ? `<p>${escapeHtml(p.scentNotes)}</p>` : pending('Scent notes'))}
    ${p.ingredients ? section('Ingredients', `<p>${escapeHtml(p.ingredients)}</p>`) : ''}
    ${section('How to use', p.howToUse ? `<p>${escapeHtml(p.howToUse)}</p>` : pending('Usage directions'))}
    ${section('Size', p.size ? `<p>${escapeHtml(p.size)}</p>` : pending('Size and volume'))}
    ${section('Care', p.care ? `<p>${escapeHtml(p.care)}</p>` : pending('Care and safety information'))}
    ${section('Delivery', `<ul>${delivery.map((d) => `<li style="padding:4px 0">${escapeHtml(d.label)} — ${escapeHtml(d.eta)}</li>`).join('')}</ul><p class="muted" style="margin-top:8px;font-size:.8125rem">Delivery fees and timings are staging values awaiting CNM approval.</p>`)}
    ${section('Returns', ctx.commerce.returns.value ? `<p>${escapeHtml(ctx.commerce.returns.value)}</p>` : approval('Returns policy.'))}
    ${section('Store availability', `<ul>${storeAvail}</ul>`)}
    ${section('FAQs', p.faqs?.length ? p.faqs.map((f) => `<p><strong>${escapeHtml(f.q)}</strong><br>${escapeHtml(f.a)}</p>`).join('') : pending('Product FAQs'))}
  </div>`;

  const body = `<div class="container">
  ${crumbs}
  <div class="pdp" data-product='${escapeHtml(JSON.stringify({ id: p.id, name: p.name, price: p.price.amount, category: cat?.name || p.category }))}'>
    ${gallery}
    <div class="buybox">
      <div><span class="card__type">${escapeHtml(p.productType)}</span><br><a class="buybox__brand" href="/shop/?brand=${encodeURIComponent(p.brand)}">${escapeHtml(p.brand)}</a><h1 style="margin-top:8px">${escapeHtml(p.name)}</h1></div>
      <div class="buybox__price">${priceHTML(p)}</div>
      <p class="buybox__stock stock-${stock.key}" data-stock="${p.id}">${stock.label}</p>
      ${variants}
      ${buy}
      <div class="assurance">
        ${ctx.site.promises.value.slice(0, 2).map(([, t, d]) => `<div>${icon(t.startsWith('Swift S') ? 'truck' : 'lock')} ${escapeHtml(t)} · ${escapeHtml(d)}</div>`).join('')}
        <div>${icon('store')} Collect in store in Lekki, Lagos or Garki, Abuja</div>
      </div>
      ${p.dataNote ? approval(p.dataNote) : ''}
      ${accordion}
      <button class="link" type="button" data-share style="justify-self:start">${icon('share')} Share</button>
    </div>
  </div>

  ${complete.length ? `<section class="section--tight" aria-labelledby="complete-title"><div class="section-head"><h2 id="complete-title" class="h2">Complete the experience</h2></div><div class="grid-products" data-impressions="pdp_complete">${complete.map((x, i) => productCardHTML(x, { position: i + 1, list: 'pdp_complete' })).join('')}</div></section>` : ''}
  <section class="section--tight" aria-labelledby="recent-title" data-recently-viewed hidden><div class="section-head"><h2 id="recent-title" class="h2">Recently viewed</h2></div><div class="grid-products" data-recent-grid></div></section>
</div>
${stock.orderable ? `<div class="sticky-buy" data-sticky-buy><div><div style="font-size:.875rem">${escapeHtml(p.name)}</div><div style="font-size:.8125rem">${priceHTML(p)}</div></div><button class="btn btn--green" type="button" data-add="${p.id}">Add to bag</button></div>` : ''}`;

  const productLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, sku: p.id, brand: { '@type': 'Brand', name: p.brand },
    image: imgs.filter((i) => !i.placeholder).map((i) => `${ctx.siteUrl}${i.src}`),
    url: `${ctx.siteUrl}/products/${p.slug}/`,
    category: cat?.name,
    ...(p.description ? { description: p.description } : {}),
    ...(p.gtin ? { gtin: p.gtin } : {}),
    // Offers are only published once the price is approved (never advertise demo prices to Google).
    ...(p.price.amount != null && !p.price.demo
      ? { offers: { '@type': 'Offer', price: p.price.amount, priceCurrency: 'NGN', url: `${ctx.siteUrl}/products/${p.slug}/`, availability: stock.key === 'out' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: 'CNM Essentials' } } }
      : {}),
  };
  return { body, jsonld: [crumbLd, productLd] };
}

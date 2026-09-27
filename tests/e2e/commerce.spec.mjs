import { expect, test } from '@playwright/test';

const unique = () => `e2e${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

async function fillCheckout(page, email) {
  await page.fill('#c-email', email);
  await page.fill('#c-first', 'Ada');
  await page.fill('#c-last', 'Obi');
  await page.fill('#c-phone', '+2348012345678');
  await page.click('[data-step="contact"] button[type="submit"]');
  await expect(page.locator('[data-step="delivery"]')).toBeVisible();
  await page.fill('#a-line1', '1 Test Road');
  await page.fill('#a-city', 'Ikoyi');
  await page.selectOption('#a-state', 'Lagos');
  await page.click('[data-step="delivery"] button[type="submit"]');
  await page.click('[data-step="payment"] button[type="submit"]');
  await expect(page.locator('[data-review]')).toContainText('Lagos delivery');
  await page.check('[data-terms]');
}

test('home renders editorial story and navigates to shop', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/essentials/');
  await expect(page.locator('h1')).toContainText('Refresh Your Space.');
  // Background-free logo: the light-CNM version over the hero, the charcoal-CNM version once the header turns white
  await expect(page.locator('.site-header .logo .logo__on-dark')).toBeVisible();
  await expect(page.locator('.site-header .logo .logo__on-light')).toHaveAttribute('src', '/assets/brand/cnm-logo-on-light.svg');
  await page.locator('.hero__cta a', { hasText: 'Shop now' }).click();
  await expect(page).toHaveURL(/\/shop\/$/);
  await expect(page.locator('[data-grid] [data-product-card]:visible')).toHaveCount(20);
  expect(errors).toEqual([]);
});

test('predictive search tolerates typos and opens a product', async ({ page }) => {
  await page.goto('/essentials/');
  await page.getByRole('button', { name: 'Search' }).first().click();
  await page.fill('[data-search-input]', 'midnigt vanila');
  const hit = page.locator('[data-search-results] a', { hasText: 'Midnight Vanilla' }).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.locator('h1')).toHaveText('Midnight Vanilla');
});

test('filters update instantly and are reflected in the URL', async ({ page, isMobile }) => {
  await page.goto('/shop/');
  if (isMobile) await page.click('[data-filters-open]');
  await page.locator('label.check', { hasText: 'Bath & Body Works' }).first().click();
  await expect(page.locator('[data-grid] [data-product-card]:visible')).toHaveCount(11);
  await expect(page).toHaveURL(/brand=Bath/);
  if (isMobile) await page.locator('.sheet-foot [data-filters-close]').click();
  await page.selectOption('[data-sort]', 'price-desc');
  await expect(page.locator('[data-grid] [data-product-card]:visible').first()).toContainText('Wallflower Socket Gray');
  await page.reload();
  await expect(page.locator('[data-grid] [data-product-card]:visible')).toHaveCount(11);
});

test('wishlist persists and moves to bag', async ({ page }) => {
  await page.goto('/products/midnight-vanilla-room-spray/');
  await page.locator('.buy-actions [data-wish]').click();
  await expect(page.locator('.buy-actions [data-wish]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/wishlist/');
  await expect(page.locator('[data-wishlist-grid] [data-product-card]')).toHaveCount(1);
  await page.click('[data-move-to-bag]');
  await expect(page.locator('[data-wishlist-empty]')).toBeVisible();
  await expect(page.locator('[data-bag-count]').first()).toHaveText('1');
});

test('bag: quantity, promo, remove; out-of-stock cannot be added', async ({ page, request }) => {
  const h = { 'X-CNM-Request': '1' };
  await request.post('/api/admin/login', { headers: h, data: { email: 'admin@cnm.local', password: 'cnm-local-admin' } });
  await request.put('/api/admin/inventory', { headers: h, data: { products: { 'crushed-room-spray': { stock: 0 } } } });
  await page.goto('/products/crushed-room-spray/');
  await expect(page.locator('.buy-actions')).toHaveCount(0);
  await expect(page.locator('[data-back-in-stock]')).toBeVisible();
  await page.goto('/products/petalrich-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await expect(page.locator('#bag-drawer')).toBeVisible();
  await page.goto('/bag/');
  await page.click('[data-line-inc="petalrich-room-spray"]');
  await expect(page.locator('[data-totals]')).toContainText('₦35,700');
  await page.fill('#promo', 'staging10');
  await page.click('[data-promo-form] button');
  await expect(page.locator('[data-promo-msg]')).toContainText('10% off');
  await page.click('[data-line-remove="petalrich-room-spray"]');
  await expect(page.getByText('Your bag is empty.').first()).toBeVisible();
});

test('guest checkout: payment failure, retry, confirmation and order tracking', async ({ page }) => {
  await page.goto('/products/white-tea-and-sage-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await page.goto('/checkout/');
  await fillCheckout(page, unique());
  await page.click('[data-place-order]');
  await expect(page.locator('[data-sim-pay]')).toBeVisible();
  await page.click('[data-sim="failure"]');
  await expect(page.locator('[data-checkout-error]')).toContainText('declined');
  await page.click('[data-sim="success"]');
  await expect(page).toHaveURL(/confirmation/);
  await expect(page.locator('.order-num')).toContainText(/CNM-\d{6}-/);
  await expect(page.locator('.status-track')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cnm.bag')))).toEqual([]);
  // Receipt / order slip: company logo and details, customer, delivery, lines, totals and payment
  const receipt = page.locator('.receipt');
  await expect(receipt.locator('.receipt__logo')).toBeVisible();
  await expect(receipt.locator('.receipt__type')).toHaveText('Receipt');
  for (const text of ['CNM Essentials', 'A CNM Group company', 'cnmessentials@cnm-group.net', 'Ada Obi', '+2348012345678', '1 Test Road', 'Ikoyi, Lagos', 'White Tea & Sage', 'Card', 'Amount paid', 'Test payment']) {
    await expect(receipt).toContainText(text);
  }
  await expect(receipt).toContainText(/CNM-\d{6}-/);
  await expect(page.locator('[data-print-receipt]').first()).toBeVisible();
  // Printing shows only the slip
  await page.emulateMedia({ media: 'print' });
  await expect(receipt).toBeVisible();
  await expect(page.locator('.confirm-hero')).toBeHidden();
  await expect(page.locator('.cnmnav')).toBeHidden();
  if (process.env.RECEIPT_OUT) {
    await page.pdf({ path: `${process.env.RECEIPT_OUT}/receipt.pdf`, format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await receipt.screenshot({ path: `${process.env.RECEIPT_OUT}/receipt-screen.png` });
  }
});

test('account: register, checkout signed in, see order history, preferences', async ({ page }) => {
  const email = unique();
  await page.goto('/account/register/');
  await page.fill('#r-first', 'Tolu');
  await page.fill('#r-last', 'Ade');
  await page.fill('#r-email', email);
  await page.fill('#r-pass', 'a-strong-password');
  await page.click('[data-register-form] button[type="submit"]');
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(page.locator('[data-account-panel] h1')).toContainText('Welcome, Tolu');
  await page.goto('/products/love-stoned-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await page.goto('/checkout/');
  await expect(page.locator('#c-email')).toHaveValue(email);
  await fillCheckout(page, email);
  await page.click('[data-place-order]');
  await page.click('[data-sim="success"]');
  await expect(page).toHaveURL(/confirmation/);
  await page.goto('/account/orders/');
  await expect(page.locator('table')).toContainText('paid');
  await page.locator('table a').first().click();
  await expect(page.locator('[data-account-panel] h1')).toContainText('Order CNM-');
  await page.goto('/account/preferences/');
  await page.locator('input[name="email.promotions"]').check({ force: true });
  await expect(page.locator('[data-toasts]')).toContainText('Preferences saved');
  await page.goto('/account/');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goto('/account/');
  await expect(page).toHaveURL(/\/account\/login\//);
});

test('fragrance as a service enquiry is captured', async ({ page }) => {
  await page.goto('/fragrance-as-a-service/');
  await page.click('[data-enquiry-form] button[type="submit"]');
  await expect(page.locator('#e-name')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#e-name', 'Chi Events');
  await page.fill('#e-email', 'chi@example.com');
  await page.selectOption('#e-sector', 'weddings');
  await page.fill('#e-msg', 'Scenting for a 300-guest wedding in Lagos.');
  await page.check('input[name="consent"]');
  await page.click('[data-enquiry-form] button[type="submit"]');
  await expect(page.locator('[data-enquiry-ok]')).toBeVisible();
});

test('butterfly loader: hidden when fast, shown only during genuine latency', async ({ page }) => {
  await page.goto('/products/rose-bohemian-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await page.goto('/checkout/');
  await fillCheckout(page, unique());
  await page.route('**/api/checkout', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  await expect(page.locator('[data-loader]')).not.toHaveClass(/is-on/);
  await page.click('[data-place-order]');
  await expect(page.locator('[data-loader]')).toHaveClass(/is-on/);
  await expect(page.locator('[data-sim-pay]')).toBeVisible();
  await expect(page.locator('[data-loader]')).not.toHaveClass(/is-on/);
});

test('admin: sign in, dashboard, move an order to processing', async ({ page, request }) => {
  const h = { 'X-CNM-Request': '1' };
  const r = await (await request.post('/api/checkout', { headers: h, data: { items: [{ id: 'sweet-pea-wallflower-plug-in-refill', qty: 1 }], contact: { email: 'adm@example.com', phone: '+2348000000000', firstName: 'A', lastName: 'D' }, delivery: { method: 'nationwide', address: { line1: '2 Road', city: 'Enugu', state: 'Enugu' } } } })).json();
  await request.post('/api/payments/simulate', { headers: h, data: { number: r.order.number, accessToken: r.order.accessToken, outcome: 'success' } });
  await page.goto('/admin/');
  await page.fill('#ae', 'admin@cnm.local');
  await page.fill('#ap', 'cnm-local-admin');
  await page.click('[data-login] button');
  await expect(page.locator('h1')).toHaveText('Command Center');
  // The paid order shows up in the Command Center and the live feed
  await expect(page.locator('.os-kpi').first()).toBeVisible();
  await expect(page.locator('.os-feed')).toContainText(r.order.number);
  // Operations: find the order, pack it, hand it to a courier, deliver it with proof, print its documents
  await page.goto(`/admin/#orders?q=${r.order.number}`);
  await page.locator(`tr[data-n="${r.order.number}"]`).click();
  await expect(page.locator('.os-title')).toContainText(r.order.number);
  await page.click('[data-ship-to="packed"]');
  await expect(page.locator('[data-ship] .os-ship')).toHaveText('Packed');
  // A dispatch rider booked for this delivery: no waybill, just who is carrying it and what CNM paid them
  await page.selectOption('[data-ship-details] select[name="courier"]', 'rider');
  await expect(page.locator('[data-ship-details] input[name="trackingNumber"]')).toBeHidden();
  await page.fill('[data-ship-details] input[name="riderName"]', 'Tunde');
  await page.fill('[data-ship-details] input[name="riderPhone"]', '08031234567');
  await page.fill('[data-ship-details] input[name="costAmount"]', '2500');
  await page.click('[data-ship-details] button[type="submit"]');
  await expect(page.locator('[data-flash]')).toContainText('Delivery details saved');
  await expect(page.locator('.os-note-line', { hasText: 'Rider:' })).toContainText('Rider: Tunde');
  await page.click('[data-ship-to="handed_over"]');
  await expect(page.locator('.os-title .pill')).toHaveText('dispatched');
  await page.click('[data-ship-to="delivered"]');
  await page.fill('[data-dlg] input[name="recipient"]', 'Front desk');
  await page.click('[data-dlg] button[type="submit"]');
  await expect(page.locator('.os-pod')).toContainText('Front desk');
  await expect(page.locator('.os-title .pill')).toHaveText('delivered');
  await page.fill('[data-note] textarea', 'Customer called to say thanks');
  await page.click('[data-note] button');
  await expect(page.locator('.os-notes')).toContainText('Customer called to say thanks');
  await page.click('a[href^="#invoice/"]');
  await expect(page.locator('.doc__type')).toHaveText('Invoice');
  await expect(page.locator('.doc')).toContainText(`INV-${r.order.number.slice(4)}`);
  await expect(page.locator('.doc')).toContainText('cnmessentials@cnm-group.net');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.os-nav')).toBeHidden();
  await expect(page.locator('.doc')).toBeVisible();
});

test('operations: fulfilment board, new phone order paid in store, refund', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop workflow (the order screens are covered on phones above)');
  await page.goto('/admin/');
  await page.fill('#ae', 'admin@cnm.local');
  await page.fill('#ap', 'cnm-local-admin');
  await page.click('[data-login] button');
  await page.goto('/admin/#fulfilment');
  await expect(page.locator('.os-title')).toHaveText('Fulfilment');
  await expect(page.locator('.os-col').first()).toBeVisible();
  // New order (phone / showroom)
  await page.goto('/admin/#new-order');
  await page.fill('[data-pick]', 'Midnight Vanilla — Victoria\'s Secret');
  await page.locator('[data-pick]').dispatchEvent('change');
  await expect(page.locator('[data-items] tr')).toHaveCount(1);
  await expect(page.locator('[data-quote]')).toContainText('Total');
  await page.fill('[data-new] input[name="firstName"]', 'Ngozi');
  await page.fill('[data-new] input[name="lastName"]', 'Umeh');
  await page.fill('[data-new] input[name="email"]', `ngozi.${Date.now()}@example.com`);
  await page.fill('[data-new] input[name="phone"]', '08031234567');
  await page.selectOption('[data-new] select[name="method"]', 'store-pickup');
  await page.fill('[data-new] input[name="paymentReason"]', 'POS slip 1182');
  await page.selectOption('[data-new] select[name="channel"]', 'pos');
  await page.click('[data-new] button[type="submit"]');
  await expect(page).toHaveURL(/#orders\/CNM-/);
  await expect(page.locator('.os-title .pill')).toHaveText('paid');
  await expect(page.locator('.os-eyebrow')).toContainText('In store');
  await expect(page.locator('.os-order__side')).toContainText('CNM Essentials Lagos');
  // Partial refund (below the approval threshold) is issued straight away
  page.once('dialog', (d) => d.accept());
  await page.fill('[data-refund] input[name="amount"]', '1000');
  await page.selectOption('[data-refund] select[name="reason"]', 'goodwill');
  await page.click('[data-refund] button[type="submit"]');
  await expect(page.locator('[data-flash]')).toContainText('Refunded');
  await expect(page.locator('.os-sum')).toContainText('Refunded');
});

test('CNM Group OS: filters in the URL, company drill-down, create and archive a company, audit log, phone menu', async ({ page, isMobile }) => {
  await page.goto('/admin/');
  await page.fill('#ae', 'admin@cnm.local');
  await page.fill('#ap', 'cnm-local-admin');
  await page.click('[data-login] button');
  await expect(page.locator('.os-title')).toHaveText('Command Center');
  await expect(page.locator('.os-kpi')).toHaveCount(10);
  await expect(page.locator('.os-cos tbody tr')).toHaveCount(4);
  // Period preset and comparison are kept in the URL
  await page.click('[data-preset="7d"]');
  await expect(page).toHaveURL(/#command\?range=7d/);
  await page.selectOption('[data-filters] select[name="compare"]', 'year');
  await expect(page).toHaveURL(/compare=year/);
  await expect(page.locator('.os-sub')).toContainText('vs');
  // Drill into one company from the companies table
  await page.locator('.os-cos tr[data-co="spectra"]').click();
  await expect(page).toHaveURL(/company=spectra/);
  await expect(page.locator('.os-eyebrow')).toContainText('CNM Spectra');
  // Create a company (idempotent) and archive it
  if (isMobile) { await page.click('[data-nav-open]'); await expect(page.locator('.os-nav')).toBeInViewport(); }
  await page.locator('.os-nav a[data-nav="companies"]').click();
  await expect(page.locator('.os-co')).toHaveCount(4);
  const name = `CNM Test ${Date.now().toString(36)}`;
  await page.click('[data-new]');
  await page.fill('[data-co-form] [name="name"]', name);
  await page.selectOption('[data-co-form] [name="kind"]', 'digital');
  await page.fill('[data-co-form] [name="color"]', '#7a3cff');
  await page.check('[data-co-form] input[value="card"]');
  await page.click('[data-co-form] [type="submit"]');
  await expect(page.locator('[data-flash]')).toContainText('Company created');
  const card = page.locator('.os-co', { hasText: name });
  await expect(card).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await card.locator('[data-archive]').click();
  await expect(page.locator('[data-flash]')).toContainText('archived');
  await expect(page.locator('.os-co', { hasText: name })).toHaveCount(0);
  await page.goto('/admin/#companies?show=archived');
  await expect(page.locator('.os-co', { hasText: name })).toBeVisible();
  // The audit log records both actions
  await page.goto('/admin/#audit');
  await expect(page.locator('.os-audit')).toContainText('Company created');
  await expect(page.locator('.os-audit')).toContainText('Company archived');
});

test('SEO: canonical, structured data, noindex on staging, sitemap', async ({ page, request }) => {
  await page.goto('/products/midnight-vanilla-room-spray/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/products\/midnight-vanilla-room-spray\/$/);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = ld.map((s) => JSON.parse(s)['@type']);
  expect(types).toEqual(expect.arrayContaining(['BreadcrumbList', 'Product']));
  const product = ld.map((s) => JSON.parse(s)).find((x) => x['@type'] === 'Product');
  expect(product.offers.price).toBe(17850); // real prices from cnmessentials.com
  expect(product.brand.name).toBe("Victoria's Secret");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const sm = await (await request.get('/sitemap.xml')).text();
  expect(sm).toContain('/stores/lagos/');
  expect(sm).not.toContain('/checkout/');
});

test('mobile navigation menu opens and is keyboard dismissible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/essentials/');
  await page.click('.menu-toggle');
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu')).toBeHidden();
});

test('CNMGroup.com hub: founder photo, all companies, menu, and contact form', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('transcend');
  await expect(page.locator('.ghero__portrait img')).toBeVisible();
  // Sharp on this screen: the file the browser chose has at least as many pixels as the portrait displays.
  const sharp = await page.locator('.ghero__portrait img').evaluate(async (i) => {
    await i.decode();
    const f = new Image(); f.src = i.currentSrc; await f.decode();
    return { file: f.naturalWidth, needed: Math.round(i.getBoundingClientRect().width * devicePixelRatio) };
  });
  expect(sharp.file).toBeGreaterThanOrEqual(Math.min(sharp.needed, 2000));
  expect(sharp.file).toBeGreaterThanOrEqual(1000);
  await expect(page.locator('#companies .gpanel')).toHaveCount(4);
  await expect(page.locator('#companies .gpanel', { hasText: 'CNM Essentials' })).toHaveAttribute('href', '/essentials/');
  for (const [name, href] of [['CNM Spectra', '/spectra/'], ['CNMWorX', '/cnmworx/'], ['CNM Foundation', '/foundation/']]) {
    await expect(page.locator('#companies .gpanel', { hasText: name })).toHaveAttribute('href', href);
  }
  if (isMobile) {
    await page.locator('.group-menu summary').click();
    await expect(page.locator('.gmenu__sub', { hasText: 'Engineering & Energy' })).toBeVisible();
    await page.locator('.gmenu__list a', { hasText: 'CNMWorX' }).click();
  } else {
    await page.locator('.gdrop__btn').click();
    await expect(page.locator('.gdrop__panel')).toBeVisible();
    await page.locator('.gdrop__co', { hasText: 'CNMWorX' }).click();
  }
  await expect(page).toHaveURL(/\/cnmworx\/$/);
  await expect(page.locator('h1')).toContainText('Engineering the future');
  await page.goto('/about/');
  await expect(page.locator('#leadership')).toContainText('Mrs Nkiruka Cynthia Ajah');
  await page.goto('/contact/');
  await page.fill('#f-group-name', 'Ngozi Partner');
  await page.fill('#f-group-email', 'ngozi@example.com');
  await page.selectOption('#f-group-subject', 'Partnership');
  await page.fill('#f-group-msg', 'We would like to discuss a partnership with CNM Group.');
  await page.locator('[data-enquiry-form] input[name="consent"]').check();
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('[data-enquiry-ok]')).toContainText('CNM Group will be in touch');
});

test('every company site has its own pages and the floating CNM navigation', async ({ page, request }) => {
  const SITES = {
    spectra: ['/spectra/', '/spectra/eyewear/', '/spectra/eye-care/', '/spectra/book/', '/spectra/about/', '/spectra/contact/'],
    cnmworx: ['/cnmworx/', '/cnmworx/services/', '/cnmworx/industries/', '/cnmworx/quality/', '/cnmworx/about/', '/cnmworx/request/', '/cnmworx/contact/'],
    foundation: ['/foundation/', '/foundation/programmes/', '/foundation/get-involved/', '/foundation/donate/', '/foundation/about/', '/foundation/contact/'],
  };
  for (const [site, paths] of Object.entries(SITES)) {
    for (const path of paths) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(html, path).toContain(`data-site="${site}"`);
      expect(html, path).toContain('data-cnmnav');
      expect(html, path).not.toContain('Back to CNM Group');
    }
    await page.goto(paths[0]);
    await expect(page.locator('.co-logo img')).toBeVisible();
    await expect(page.locator('.co-pillars__list li')).toHaveCount(4);
    await expect(page.locator('.co-pillars__tagline')).toHaveText({ spectra: 'A clearer tomorrow', cnmworx: 'Solutions for a stronger tomorrow', foundation: 'People today. Brighter tomorrows.' }[site]);
    await page.locator('.cnmnav__home').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('h1')).toContainText('transcend');
  }
});

test('company journeys: Spectra appointment, CNMWorX proposal, Foundation pledge', async ({ page }) => {
  // Spectra: from the range to a booked appointment, with the service prefilled
  await page.goto('/spectra/eyewear/');
  await page.locator('#sunglasses a', { hasText: 'Book to try on' }).click();
  await expect(page).toHaveURL(/\/spectra\/book\/\?service=/);
  await expect(page.locator('#f-book-svc')).toHaveValue('Sunglasses & fashion frames');
  await page.fill('#f-book-name', 'Chidi Okafor');
  await page.fill('#f-book-email', 'chidi@example.com');
  await page.fill('#f-book-phone', '+2348012345678');
  await page.selectOption('#f-book-loc', 'Abuja');
  const d = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await page.fill('#f-book-date', d);
  await page.locator('[data-enquiry-form] input[name="consent"]').check();
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('[data-enquiry-ok]')).toContainText('appointment request');

  // CNMWorX: required fields are enforced, then a proposal request goes through
  await page.goto('/cnmworx/services/');
  await page.locator('#automation a', { hasText: 'Request a proposal' }).click();
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('#f-request-co')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#f-request-name', 'Eng Lead');
  await page.fill('#f-request-email', 'eng@example.com');
  await page.fill('#f-request-co', 'Acme Energy');
  await page.fill('#f-request-phone', '+2348012345678');
  await expect(page.locator('#f-request-svc')).toHaveValue('Automation & control systems');
  await page.fill('#f-request-loc', 'Port Harcourt');
  await page.selectOption('#f-request-time', 'Within 3 months');
  await page.fill('#f-request-msg', 'Instrumentation upgrade for a gas plant control room.');
  await page.locator('[data-enquiry-form] input[name="consent"]').check();
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('[data-enquiry-ok]')).toContainText('project request');

  // Foundation: pledge a custom monthly gift to a programme
  await page.goto('/foundation/programmes/');
  await page.locator('#education a', { hasText: 'Support this programme' }).click();
  await expect(page.locator('#f-donate-prog')).toHaveValue('Education & literacy programmes');
  await page.locator('.amount-chip', { hasText: 'Other' }).click();
  await page.fill('#f-donate-other', '15000');
  await page.selectOption('#f-donate-freq', 'Monthly');
  await page.fill('#f-donate-name', 'Ada Giver');
  await page.fill('#f-donate-email', 'ada@example.com');
  await page.locator('[data-enquiry-form] input[name="consent"]').check();
  const [res] = await Promise.all([page.waitForRequest('**/api/enquiry'), page.locator('[data-enquiry-form] button[type="submit"]').click()]);
  const sent = res.postDataJSON();
  expect(sent).toMatchObject({ division: 'foundation', subject: 'Donation pledge', timeline: '₦15,000 · Monthly', interest: 'Education & literacy programmes' });
  await expect(page.locator('[data-enquiry-ok]')).toContainText('generosity');
});

test('old CNM Group addresses redirect to the new hub and company sites', async ({ request }) => {
  const r = await request.get('/cnm-group/spectra/', { maxRedirects: 0 });
  expect([301, 302, 308]).toContain(r.status());
  expect(r.headers().location).toMatch(/\/spectra\/$/);
});


test('scent finder recommends real products (rules fallback without an AI key)', async ({ page }) => {
  await page.goto('/essentials/');
  await page.locator('a[href="/scent-finder/"]', { hasText: 'Try the scent finder' }).click();
  await expect(page.locator('h1')).toContainText('Find your');
  await page.locator('[data-chips="families"] [data-chip="sweet"]').click();
  await page.selectOption('#f-room', 'bedroom');
  for (const m of ['cosy', 'calm', 'romantic', 'festive']) await page.locator(`[data-chips="moods"] [data-chip="${m}"]`).click();
  await expect(page.locator('[data-chips="moods"] [aria-pressed="true"]')).toHaveCount(3);
  await page.selectOption('#f-budget', 'u20');
  await page.fill('#f-notes', 'I love vanilla');
  await page.click('[data-finder-submit]');
  const cards = page.locator('[data-finder-results] [data-product-card]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(4);
  await expect(page.locator('[data-finder-source]')).toHaveAttribute('data-finder-source', 'rules');
  await expect(page.locator('.finder__reason').first()).not.toBeEmpty();
  await cards.first().locator('[data-add]').dispatchEvent('click');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnm.bag') || '[]').length)).toBe(1);
});

test('checkout: pick bank transfer, review shows it, staging never takes real payment', async ({ page }) => {
  await page.goto('/products/white-tea-and-sage-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await page.goto('/checkout/');
  await page.fill('#c-email', unique());
  await page.fill('#c-first', 'Ada');
  await page.fill('#c-last', 'Obi');
  await page.fill('#c-phone', '+2348012345678');
  await page.click('[data-step="contact"] button[type="submit"]');
  await page.fill('#a-line1', '1 Test Road');
  await page.fill('#a-city', 'Ikoyi');
  await page.selectOption('#a-state', 'Lagos');
  await page.click('[data-step="delivery"] button[type="submit"]');
  await expect(page.locator('[data-pay-mode-note]')).toContainText('No money is taken');
  await page.locator('.radio-card', { hasText: 'Bank transfer' }).click();
  await page.click('[data-step="payment"] button[type="submit"]');
  await expect(page.locator('[data-review]')).toContainText('Bank transfer');
  await expect(page.locator('[data-review]')).toContainText('staging: no real payment');
  await page.check('[data-terms]');
  const [res] = await Promise.all([page.waitForResponse('**/api/checkout'), page.click('[data-place-order]')]);
  const body = await res.json();
  expect(body.payment).toMatchObject({ mode: 'simulated', method: 'bank_transfer', testMode: true });
  await expect(page.locator('[data-sim-pay]')).toBeVisible();
});

test('checkout on mobile: order summary collapses behind a toggle', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/products/white-tea-and-sage-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await page.goto('/checkout/');
  const toggle = page.locator('[data-summary-toggle]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText('₦');
  await expect(page.locator('[data-co-summary]')).toBeHidden();
  await toggle.click();
  await expect(page.locator('[data-co-summary]')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('passwordless sign-in: email code creates an account, then asks for a name', async ({ page }) => {
  await page.goto('/account/login/');
  await expect(page.locator('[data-otp-form]')).toBeVisible();
  await page.fill('#o-email', unique());
  await page.click('[data-otp-submit]');
  const note = page.locator('[data-otp-note]');
  await expect(note).toContainText('your code is');
  const code = (await note.textContent()).match(/(\d{6})/)[1];
  await page.fill('#o-code', code);
  await expect(page).toHaveURL(/\/account\/profile\/\?welcome=1/);
  await expect(page.locator('.alert--ok')).toContainText('Welcome to CNM Essentials');
  await page.fill('#p-first', 'Chioma');
  await page.fill('#p-last', 'Eze');
  await page.click('[data-profile] button[type="submit"]');
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(page.locator('[data-account-panel] h1')).toContainText('Welcome, Chioma');
});

test('every Essentials page has the floating CNM navigation and no back button in the header', async ({ page }) => {
  for (const path of ['/essentials/', '/shop/', '/products/white-tea-and-sage-room-spray/', '/checkout/', '/scent-finder/', '/our-story/']) {
    await page.goto(path);
    await expect(page.locator('.cnmnav__home')).toHaveAttribute('href', '/');
    await expect(page.locator('.cnmnav__home')).toBeVisible();
    await expect(page.locator('header a[href="/"]:not(.logo)')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Back to CNM Group');
  }
  await page.locator('.cnmnav__home').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.ghero__portrait')).toBeVisible();
});

test('campaign artwork is shown whole with captions below, not on top', async ({ page }) => {
  await page.goto('/essentials/');
  const banner = page.locator('.banner').first();
  await banner.scrollIntoViewIfNeeded();
  await expect(banner).not.toHaveClass(/m-reveal(?! is-in)/); // let the scroll reveal finish
  await page.waitForTimeout(1000);
  const [img, cap] = await Promise.all([banner.locator('img').boundingBox(), banner.locator('.banner__cap').boundingBox()]);
  expect(cap.y).toBeGreaterThanOrEqual(img.y + img.height - 2);
  expect(await banner.locator('img').evaluate((n) => getComputedStyle(n).objectFit)).toBe('contain');
});

test('shopping never requires an account; sign up is optional and inline at checkout', async ({ page, isMobile }) => {
  await page.goto('/products/white-tea-and-sage-room-spray/');
  await page.locator('.buy-actions [data-add]').click();
  await page.goto('/checkout/');
  await expect(page).toHaveURL(/\/checkout\/$/);
  await expect(page.locator('[data-co-auth]')).toContainText('Checking out as a guest');
  await page.locator('[data-co-auth] [data-auth-open="signup"]').click();
  const dlg = page.locator('#auth-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('[data-auth-reason]')).toContainText('check out as a guest');
  const email = unique();
  await dlg.locator('#ad-first').fill('Ifeoma');
  await dlg.locator('#ad-last').fill('Eze');
  await dlg.locator('#ad-email').fill(email);
  await dlg.locator('[data-ad-submit]').click();
  const note = dlg.locator('[data-ad-note]');
  await expect(note).toContainText(/\d{6}/);
  await dlg.locator('#ad-code').fill((await note.textContent()).match(/(\d{6})/)[1]);
  await expect(dlg).toBeHidden();
  await expect(page.locator('[data-co-auth]')).toContainText(`Signed in as ${email}`);
  await expect(page.locator('#c-email')).toHaveValue(email);
  await expect(page.locator('#c-first')).toHaveValue('Ifeoma');
  // header account icon now goes to the account instead of the dialog
  if (!isMobile) { await page.goto('/essentials/'); await page.locator('[data-account-link]').click(); await expect(page).toHaveURL(/\/account\/$/); }
});

test('header account icon offers sign in without leaving the page (guest)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'account icon is in the mobile menu');
  await page.goto('/shop/');
  await page.locator('[data-account-link]').click();
  await expect(page).toHaveURL(/\/shop\/$/);
  await expect(page.locator('#auth-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#auth-dialog')).toBeHidden();
});

test('interactions: dropdowns, quick view pop-up, next page, back to top', async ({ page, isMobile }) => {
  // Company-site dropdown (desktop) or nested menu (phone)
  await page.goto('/cnmworx/');
  if (isMobile) {
    await page.locator('.co-menu summary').click();
    await expect(page.locator('.co-menu__sub a', { hasText: 'Instrumentation & power electronics' })).toBeVisible();
    await page.locator('.co-menu__sub a', { hasText: 'Instrumentation & power electronics' }).click();
  } else {
    await page.locator('.co-drop__btn').first().click();
    await expect(page.locator('.co-drop__panel').first()).toBeVisible();
    await page.locator('.co-drop__panel a', { hasText: 'Instrumentation & power electronics' }).click();
  }
  await expect(page).toHaveURL(/\/cnmworx\/services\/#instrumentation$/);

  // "Continue exploring" goes to the next page of the site
  await page.locator('.next-page__link').click();
  await expect(page).toHaveURL(/\/cnmworx\/industries\/$/);

  // Back to top appears after scrolling and returns to the top
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('.to-top')).toHaveClass(/is-on/);
  await page.locator('.to-top').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(10);

  // Quick view pop-up: add to bag without leaving the shop
  await page.goto('/shop/');
  await page.locator('[data-quickview]').first().dispatchEvent('click');
  await expect(page.locator('#quickview')).toBeVisible();
  await expect(page.locator('#qv-title')).not.toBeEmpty();
  await page.locator('[data-qv-inc]').click();
  await page.locator('[data-qv-add]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnm.bag') || '[]')[0]?.qty)).toBe(2);
  await expect(page.locator('#bag-drawer')).toBeVisible();
});

test('newsletter pop-up: shows once, dismisses, and never during checkout', async ({ page }) => {
  await page.goto('/essentials/?nlpop=1');
  await expect(page.locator('#newsletter-pop')).toBeVisible();
  await page.locator('#newsletter-pop .nlp__no').click();
  await expect(page.locator('#newsletter-pop')).toBeHidden();
  await page.goto('/checkout/?nlpop=1');
  await page.waitForTimeout(800);
  await expect(page.locator('#newsletter-pop')).toBeHidden();
});

test('floating CNM navigation: expands to the sister companies, switches, auto-collapses and goes home in one click', async ({ page, isMobile }) => {
  await page.goto('/foundation/');
  const nav = page.locator('[data-cnmnav]');
  const toggle = page.locator('[data-cnmnav-toggle]');
  await expect(nav).not.toHaveClass(/is-open/);
  await expect(page.locator('.cnmnav__item').first()).toBeHidden();
  await expect(page.locator('.cnmnav__item')).toHaveCount(3); // the other three companies
  await expect(page.locator('.cnmnav__item[href="/foundation/"]')).toHaveCount(0);
  // Hover and scrolling never open it; only a click / tap on the switch does
  if (!isMobile) { await page.locator('.cnmnav__home').hover(); await page.waitForTimeout(500); await expect(nav).not.toHaveClass(/is-open/); }
  await page.evaluate(() => scrollTo(0, 600)); await page.waitForTimeout(200); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  await expect(nav).not.toHaveClass(/is-open/);
  await expect(nav).toHaveClass(/is-compact/);
  if (isMobile) await toggle.tap(); else await toggle.click();
  await expect(nav).toHaveClass(/is-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.cnmnav__item[href="/spectra/"]')).toBeVisible();
  // Escape or a tap elsewhere closes it
  await page.keyboard.press('Escape');
  await expect(nav).not.toHaveClass(/is-open/);
  await toggle.click();
  await expect(nav).toHaveClass(/is-open/);
  if (isMobile) {
    // Collapses by itself when left alone
    await expect(nav).not.toHaveClass(/is-open/, { timeout: 7000 });
    await toggle.tap();
  }
  await page.locator('.cnmnav__item[href="/spectra/"]').click();
  await expect(page).toHaveURL(/\/spectra\/$/);
  // Stays with the visitor while scrolling (compact), then one click home
  await page.evaluate(() => scrollTo(0, 400));
  await page.waitForTimeout(100);
  await page.evaluate(() => scrollTo(0, 2000));
  await expect(nav).toHaveClass(/is-compact/);
  await expect(page.locator('.cnmnav__home')).toBeInViewport();
  await page.locator('.cnmnav__home').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.ghero__portrait')).toBeVisible();
  await expect(page.locator('.cnmnav__item')).toHaveCount(4); // on CNMGroup.com it lists all four companies
});

test('light and dark mode: switch, remember, and swap to the light-lettered logo', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/shop/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.locator('.site-header [data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(lightBg);
  await expect(page.locator('.site-header .logo .logo__on-dark')).toBeVisible();
  await expect(page.locator('.site-header [data-theme-toggle]')).toHaveAttribute('aria-label', 'Switch to light mode');
  // The choice follows the visitor across CNMGroup.com and every company site
  for (const path of ['/', '/spectra/', '/cnmworx/', '/foundation/', '/checkout/']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-theme-toggle]').first()).toBeVisible();
  }
  await page.locator('[data-theme-toggle]').first().click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('dark mode follows the device setting until the visitor chooses', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

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
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Refresh Your Space.');
  await expect(page.locator('.logo img').first()).toHaveAttribute('src', '/assets/brand/cnm-logo.svg');
  await page.locator('.hero__cta a', { hasText: 'Shop now' }).click();
  await expect(page).toHaveURL(/\/shop\/$/);
  await expect(page.locator('[data-grid] [data-product-card]:visible')).toHaveCount(20);
  expect(errors).toEqual([]);
});

test('predictive search tolerates typos and opens a product', async ({ page }) => {
  await page.goto('/');
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
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await page.goto('/admin/#orders?status=paid');
  await page.locator('a[href^="#orders/CNM-"]').first().click();
  await page.selectOption('[data-status] select', 'processing');
  await page.click('[data-status] button');
  await expect(page.locator('[data-flash]')).toContainText('customer notified');
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
  await page.goto('/');
  await page.click('.menu-toggle');
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu')).toBeHidden();
});

test('CNM Group: Retail routes to the store; company pages; contact form sends a message', async ({ page, isMobile }) => {
  await page.goto('/cnm-group/');
  await expect(page.locator('#divisions .group-company', { hasText: 'CNM Essentials' })).toHaveAttribute('href', '/');
  await expect(page.locator('#leadership')).toContainText('Mrs Nkiruka Cynthia Ajah');
  await expect(page.locator('.group-store')).toHaveAttribute('href', '/');
  if (isMobile) {
    await page.locator('.group-menu summary').click();
    await page.locator('.group-menu__panel a', { hasText: 'CNMWorX' }).click();
  } else {
    await page.locator('.group-nav a', { hasText: 'CNMWorX' }).click();
  }
  await expect(page).toHaveURL(/\/cnm-group\/cnmworx\/$/);
  await expect(page.locator('h1')).toHaveText('CNMWorX Limited');
  await page.goto('/cnm-group/contact/');
  await page.fill('#f-group-name', 'Ngozi Partner');
  await page.fill('#f-group-email', 'ngozi@example.com');
  await page.selectOption('#f-group-subject', 'Partnership');
  await page.fill('#f-group-msg', 'We would like to discuss a partnership with CNM Group.');
  await page.locator('input[name="consent"]').check();
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('[data-enquiry-ok]')).toContainText('CNM Group will be in touch');
});

test('company forms: Spectra consultation and CNMWorX tender request are captured', async ({ page, request }) => {
  await page.goto('/cnm-group/spectra/');
  await page.locator('.hero__cta a', { hasText: 'Book an optical consultation' }).click();
  await page.fill('#f-spectra-name', 'Chidi Okafor');
  await page.fill('#f-spectra-email', 'chidi@example.com');
  await page.fill('#f-spectra-phone', '+2348012345678');
  await page.selectOption('#f-spectra-loc', 'Abuja');
  await page.selectOption('#f-spectra-int', 'Prescription eyewear');
  await page.fill('#f-spectra-msg', 'I need new prescription frames please.');
  await page.locator('input[name="consent"]').check();
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('[data-enquiry-ok]')).toContainText('CNM Spectra');

  await page.goto('/cnm-group/cnmworx/');
  await page.locator('[data-enquiry-form] button[type="submit"]').click();
  await expect(page.locator('#f-cnmworx-co')).toHaveAttribute('aria-invalid', 'true');
  const r = await request.post('/api/enquiry', { headers: { 'X-CNM-Request': '1' }, data: { name: 'Eng Lead', email: 'eng@example.com', company: 'Acme Energy', sector: 'group', division: 'cnmworx', interest: 'EPC project delivery', timeline: 'Within 3 months', location: 'Port Harcourt', message: 'Instrumentation upgrade for a gas plant.', consent: true } });
  expect(r.status()).toBe(201);
  const bad = await request.post('/api/enquiry', { headers: { 'X-CNM-Request': '1' }, data: { name: 'X', email: 'x@example.com', sector: 'group', division: 'nope', message: 'Some message here.', consent: true } });
  expect(bad.status()).toBe(422);
});

test('scent finder recommends real products (rules fallback without an AI key)', async ({ page }) => {
  await page.goto('/');
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

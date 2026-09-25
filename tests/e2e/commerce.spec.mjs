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
  await expect(page.locator('h1')).toContainText('Scent your');
  await page.locator('.hero__cta a', { hasText: 'Shop new in' }).click();
  await expect(page).toHaveURL(/\/shop\/new-in\/$/);
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('predictive search tolerates typos and opens a product', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search' }).first().click();
  await page.fill('[data-search-input]', 'stonglow');
  const hit = page.locator('[data-search-results] a', { hasText: 'Stoneglow Reed Diffuser' }).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.locator('h1')).toHaveText('Stoneglow Reed Diffuser');
});

test('filters update instantly and are reflected in the URL', async ({ page, isMobile }) => {
  await page.goto('/shop/');
  if (isMobile) await page.click('[data-filters-open]');
  await page.locator('label.check', { hasText: 'Body Care' }).first().click();
  await expect(page.locator('[data-grid] [data-product-card]:visible')).toHaveCount(2);
  await expect(page).toHaveURL(/category=body-care/);
  if (isMobile) await page.locator('.sheet-foot [data-filters-close]').click();
  await page.selectOption('[data-sort]', 'price-desc');
  await expect(page.locator('[data-grid] [data-product-card]:visible').first()).toContainText('Body Butter');
  await page.reload();
  await expect(page.locator('[data-grid] [data-product-card]:visible')).toHaveCount(2);
});

test('wishlist persists and moves to bag', async ({ page }) => {
  await page.goto('/products/refill-oil/');
  await page.locator('.buy-actions [data-wish]').click();
  await expect(page.locator('.buy-actions [data-wish]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/wishlist/');
  await expect(page.locator('[data-wishlist-grid] [data-product-card]')).toHaveCount(1);
  await page.click('[data-move-to-bag]');
  await expect(page.locator('[data-wishlist-empty]')).toBeVisible();
  await expect(page.locator('[data-bag-count]').first()).toHaveText('1');
});

test('bag: quantity, promo, remove; out-of-stock cannot be added', async ({ page }) => {
  await page.goto('/products/car-diffuser/');
  await expect(page.locator('.buy-actions')).toHaveCount(0);
  await expect(page.locator('[data-back-in-stock]')).toBeVisible();
  await page.goto('/products/body-wash/');
  await page.locator('.buy-actions [data-add]').click();
  await expect(page.locator('#bag-drawer')).toBeVisible();
  await page.goto('/bag/');
  await page.click('[data-line-inc="body-wash"]');
  await expect(page.locator('[data-totals]')).toContainText('₦29,000');
  await page.fill('#promo', 'staging10');
  await page.click('[data-promo-form] button');
  await expect(page.locator('[data-promo-msg]')).toContainText('10% off');
  await page.click('[data-line-remove="body-wash"]');
  await expect(page.getByText('Your bag is empty.').first()).toBeVisible();
});

test('guest checkout: payment failure, retry, confirmation and order tracking', async ({ page }) => {
  await page.goto('/products/signature-diffuser-oil/');
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
  await page.goto('/products/refill-oil/');
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
  await page.goto('/products/refill-oil/');
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
  const r = await (await request.post('/api/checkout', { headers: h, data: { items: [{ id: 'refill-oil', qty: 1 }], contact: { email: 'adm@example.com', phone: '+2348000000000', firstName: 'A', lastName: 'D' }, delivery: { method: 'nationwide', address: { line1: '2 Road', city: 'Enugu', state: 'Enugu' } } } })).json();
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
  await page.goto('/products/stoneglow-reed-diffuser/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/products\/stoneglow-reed-diffuser\/$/);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = ld.map((s) => JSON.parse(s)['@type']);
  expect(types).toEqual(expect.arrayContaining(['BreadcrumbList', 'Product']));
  const product = ld.map((s) => JSON.parse(s)).find((x) => x['@type'] === 'Product');
  expect(product.offers).toBeUndefined(); // demo prices are never advertised
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

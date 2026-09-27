// Captures review screenshots (desktop 1440 px, phone 390 px) of key pages from a running dev server.
// Usage: node scripts/preview-shots.mjs <outDir> [key,key,...]
//   BASE=http://localhost:8888 CHROME_PATH=/path/to/chrome node scripts/preview-shots.mjs ./shots group,spectra
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = process.argv[2] || 'preview-shots';
const only = process.argv[3]?.split(',');
const base = process.env.BASE || 'http://localhost:8888';
const PAGES = [
  ['group', '/'], ['about', '/about/'], ['contact', '/contact/'],
  ['home', '/essentials/'], ['shop', '/shop/'], ['product', '/products/midnight-vanilla-room-spray/'], ['scent-finder', '/scent-finder/', 'finder'],
  ['checkout', '/checkout/', 'checkout'], ['signin', '/shop/', 'auth'],
  ['spectra', '/spectra/'], ['spectra-book', '/spectra/book/'], ['cnmworx', '/cnmworx/'], ['cnmworx-request', '/cnmworx/request/'],
  ['foundation', '/foundation/'], ['foundation-donate', '/foundation/donate/'],
].filter(([k]) => !only || only.includes(k));
const MAX_H = 8000;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
for (const [dev, vp, dsf] of [['desktop', { width: 1440, height: 900 }, 1], ['mobile', { width: 390, height: 844 }, 2]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf });
  await ctx.addInitScript(() => { try { localStorage.setItem('cnm.consent', 'denied'); } catch {} });
  const pg = await ctx.newPage();
  for (const [key, path, action] of PAGES) {
    await pg.setViewportSize(vp);
    if (action === 'checkout') { await pg.goto(base + '/products/midnight-vanilla-room-spray/'); await pg.locator('.buy-actions [data-add]').click(); }
    await pg.goto(base + path, { waitUntil: 'networkidle' });
    if (action === 'finder') {
      await pg.locator('[data-chip="sweet"]').click(); await pg.selectOption('#f-room', 'bedroom'); await pg.locator('[data-chips="moods"] [data-chip="cosy"]').click();
      await pg.click('[data-finder-submit]'); await pg.locator('[data-finder-results] [data-product-card]').first().waitFor(); await pg.evaluate(() => scrollTo(0, 0));
    }
    if (action === 'auth') {
      if (dev === 'desktop') await pg.locator('[data-account-link]').click();
      else { await pg.click('.menu-toggle'); await pg.waitForTimeout(400); await pg.locator('#mobile-menu [data-auth-open="signup"]').click(); }
      await pg.waitForTimeout(600);
      await pg.screenshot({ path: `${out}/${key}-${dev}.png` });
      continue;
    }
    // Load lazy images, then grow the viewport to the page height (fixed/overlay headers render once, at the top).
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
    const h = Math.min(MAX_H, await pg.evaluate(() => document.documentElement.scrollHeight));
    await pg.setViewportSize({ width: vp.width, height: h });
    await pg.waitForLoadState('networkidle');
    await pg.waitForTimeout(1400); // let scroll reveals finish
    await pg.screenshot({ path: `${out}/${key}-${dev}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(`Saved ${PAGES.length * 2} screenshots to ${out}`);

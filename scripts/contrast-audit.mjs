// Light / dark mode audit: every key page, both themes, desktop and phone.
// Flags (1) text whose contrast against the colour actually behind it is below WCAG AA
// (4.5:1 body, 3:1 large), and (2) text sitting on top of a photograph.
//   BASE=http://localhost:8888 CHROME_PATH=… node scripts/contrast-audit.mjs [--json out.json]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const base = process.env.BASE || 'http://localhost:8888';
const PAGES = [
  '/', '/about/', '/contact/',
  '/essentials/', '/shop/', '/products/midnight-vanilla-room-spray/', '/bag/', '/checkout/', '/wishlist/', '/search/?q=vanilla', '/scent-finder/', '/our-story/', '/stores/', '/stores/lagos/', '/stores/abuja/',
  '/fragrance-as-a-service/', '/journal/', '/essentials/contact/', '/account/login/', '/account/register/', '/privacy/',
  '/spectra/', '/spectra/eyewear/', '/spectra/eye-care/', '/spectra/book/', '/spectra/about/', '/spectra/contact/',
  '/cnmworx/', '/cnmworx/services/', '/cnmworx/industries/', '/cnmworx/quality/', '/cnmworx/about/', '/cnmworx/request/', '/cnmworx/contact/',
  '/foundation/', '/foundation/programmes/', '/foundation/get-involved/', '/foundation/donate/', '/foundation/about/', '/foundation/contact/',
  '/this-page-does-not-exist/',
];
// Admin screens (CNM Group OS) — local development only; signs in with the local owner account.
const ADMIN = process.env.ADMIN === '1' ? ['/admin/#command', '/admin/#companies', '/admin/#audit', '/admin/#orders', '/admin/#fulfilment', '/admin/#new-order', '/admin/#ops-settings', '/admin/#inventory', '/admin/#discounts', '/admin/#content', '/admin/#enquiries', '/admin/#analytics', '/admin/#users'] : [];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const findings = [];
for (const theme of ['light', 'dark']) {
  for (const [dev, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('cnm.theme', t); localStorage.setItem('cnm.consent', 'denied'); localStorage.setItem('cnm.nlpop', String(Date.now())); } catch {} }, theme);
    if (ADMIN.length) {
      // Local sign-in: password → code (returned locally as devCode) → PIN
      const h = { 'X-CNM-Request': '1' };
      const a = await (await ctx.request.post(`${base}/api/admin/login`, { headers: h, data: { email: 'admin@cnm.local', password: 'cnm-local-admin' } })).json();
      await ctx.request.post(`${base}/api/admin/login/otp`, { headers: h, data: { code: a.devCode } });
      await ctx.request.post(`${base}/api/admin/login/pin`, { headers: h, data: { pin: '246810' } });
    }
    const page = await ctx.newPage();
    for (const path of [...PAGES, ...ADMIN]) {
      await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 20)); } scrollTo(0, 0); });
      await page.waitForTimeout(path.startsWith('/admin/') ? 1200 : 300);
      const res = await page.evaluate(() => {
        const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
        // What is actually painted behind a point: walk the hit-test stack under the element, compositing
        // background colours until an opaque one; a photo reached first means "text on a photo".
        const behind = (el, x, y) => {
          const stack = document.elementsFromPoint(x, y).filter((n) => !el.contains(n) || n === el);
          const layers = [];
          for (const n of stack) {
            if ((n.tagName === 'IMG' || n.tagName === 'VIDEO') && n !== el) {
              const w = n.getBoundingClientRect().width;
              if (w > 120 && !n.closest('.logo, .co-logo, .group-logo, [class*="logo"], .cnmnav')) return { photo: true };
              continue;
            }
            const cs = getComputedStyle(n);
            if (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return { photo: true };
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) { layers.push(c); if (c.a >= 0.97) break; }
            // Gradients: judge against their lightest opaque stop (worst case for light text, and close enough for dark)
            if (/gradient/.test(cs.backgroundImage) && /^(auto|cover|100% 100%|auto auto)$/.test(cs.backgroundSize.split(',')[0].trim())) { // full-size gradients only (not underline strips)
              const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter((x) => x && x.a >= 0.97);
              if (stops.length) { layers.push(stops.reduce((m, x) => (lum(x) > lum(m) ? x : m))); break; }
            }
          }
          let acc = { r: 255, g: 255, b: 255, a: 1 };
          for (const l of layers.reverse()) acc = over(l, acc);
          return acc;
        };
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          const el = t.parentElement;
          if (!el || seen.has(el) || !t.textContent.trim()) continue;
          seen.add(el);
          if (el.closest('[hidden], [aria-hidden="true"], .sr-only, .skip-link, script, style, noscript, dialog:not([open]), details:not([open]) > :not(summary), .cnmnav__panel, .mega, .drawer, .modal, .gmenu, .co-menu__panel, .search-overlay, .tc-tip, .chart__tip')) continue;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
          let op = 1; for (let n = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
          if (op < 0.1) continue;
          const docY = r.top + scrollY;
          scrollTo(0, Math.max(0, docY - innerHeight / 2));
          const r2 = el.getBoundingClientRect();
          if (r2.bottom < 0 || r2.top > innerHeight || r2.right < 0 || r2.left > innerWidth) continue; // clipped inside its own scroll area (e.g. a sticky sidebar)
          const px = Math.min(innerWidth - 1, Math.max(0, r2.left + Math.min(r2.width / 2, 40)));
          const py = Math.min(innerHeight - 1, Math.max(0, r2.top + r2.height / 2));
          const fg = parse(cs.color);
          const bg = behind(el, px, py);
          const text = t.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
          const where = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
          if (bg.photo && !el.closest('.cnmnav, .to-top, [data-cnmnav], .staging-bar, .site-header, .co-header, .group-header')) { out.push({ kind: 'text-on-photo', text, where }); continue; }
          if (!fg) continue;
          const f = over({ ...fg, a: fg.a * op }, bg);
          const L1 = lum(f); const L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
          const large = size >= 24 || (bold && size >= 18.66);
          const need = large ? 3 : 4.5;
          if (ratio < need) out.push({ kind: 'contrast', ratio: Math.round(ratio * 100) / 100, need, text, where, fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
        }
        scrollTo(0, 0);
        return out;
      });
      for (const f of res) findings.push({ theme, dev, path, ...f });
    }
    await ctx.close();
  }
}
await browser.close();
const bad = findings.filter((f) => f.kind === 'text-on-photo' || f.ratio < 3);
const warn = findings.filter((f) => f.kind === 'contrast' && f.ratio >= 3);
console.log(`Checked ${PAGES.length + ADMIN.length} pages × light/dark × desktop/phone.`);
console.log(`Serious: ${bad.length} (unreadable < 3:1 or text on a photo) · Below AA: ${warn.length}`);
const group = (list) => { const m = {}; for (const f of list) { const k = `${f.kind} | ${f.where} | ${f.text}`; (m[k] ||= { ...f, where: f.where, hits: [] }).hits.push(`${f.theme}/${f.dev} ${f.path}`); } return Object.values(m); };
for (const g of group(bad).slice(0, 80)) console.log(`✗ ${g.kind === 'contrast' ? `${g.ratio}:1 (${g.fg} on ${g.bg})` : 'TEXT ON PHOTO'} ${g.where} “${g.text}” — ${g.hits.length}× e.g. ${g.hits.slice(0, 3).join(', ')}`);
for (const g of group(warn).slice(0, 80)) console.log(`! ${g.ratio}:1 need ${g.need} (${g.fg} on ${g.bg}) ${g.where} “${g.text}” — ${g.hits.length}× e.g. ${g.hits.slice(0, 2).join(', ')}`);
const jsonAt = process.argv.indexOf('--json');
if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(findings, null, 1));
process.exitCode = bad.length ? 1 : 0;

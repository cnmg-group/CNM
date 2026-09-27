// Site-wide motion & interaction layer for CNMGroup.com and every company site.
// Scroll reveals, parallax, smart header, progress bar, back-to-top, count-up stats, prefetch and page transitions.
// Everything is progressive: without JS, or with "reduce motion", pages are complete and static.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* ---------- scroll reveals (auto-applied, staggered within each group) ---------- */
const REVEAL = [
  '.co-sechead', '.co-card', '.co-range__item', '.co-steps li', '.co-facts', '.co-band__row', '.co-trust li', '.co-pagehead .co-title', '.co-pagehead .co-lead',
  '.gpanel', '.gquote__inner', '#who-we-are .stack', '.group-split__img', '.gdivision', '.gstats > div', '.gcream .stack', '.gtitle', '.gdark__lead',
  '.site-form', '.info-list', '.section-head', '.card', '.banner', '.store-card', '.article-card', '.split__copy', '.promises > *', '.values > *', '.next-page',
].join(',');

function initReveals() {
  if (reduce || !('IntersectionObserver' in window)) return;
  const fold = innerHeight * 0.92;
  const els = [...document.querySelectorAll(REVEAL)].filter((el) => !el.closest('[hidden], .gmenu, .co-menu__panel, .drawer, .search-overlay, .mega, .modal, .co-drop__panel, .gdrop__panel') && el.getBoundingClientRect().top > fold);
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => {
    const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.matches(REVEAL)) : [];
    el.style.setProperty('--i', Math.min(6, Math.max(0, siblings.indexOf(el))));
    el.classList.add('m-reveal');
    io.observe(el);
  });
}

/* ---------- count-up numbers (e.g. "16 Years of experience") ---------- */
function initCountUp() {
  const nums = [...document.querySelectorAll('.gstats dd, [data-count-up]')].filter((n) => /^\d{1,5}\+?$/.test(n.textContent.trim()));
  if (reduce || !nums.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    const el = en.target;
    const text = el.textContent.trim();
    const end = parseInt(text, 10);
    const suffix = text.replace(/^\d+/, '');
    const t0 = performance.now();
    const dur = 1200;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = `${Math.round(end * (1 - (1 - p) ** 3))}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
}

/* ---------- scroll-linked: progress bar, smart header, parallax, back-to-top ---------- */
function initScroll() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);

  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'to-top';
  top.setAttribute('aria-label', 'Back to top');
  top.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  document.body.append(top);

  const header = document.querySelector('.co-header, .group-header, .site-header:not(.checkout-header)');
  const parallax = reduce ? [] : [...document.querySelectorAll('.gpanel__media > img, .split__media > img, [data-parallax]')];
  let lastY = scrollY;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = scrollY;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    top.classList.toggle('is-on', y > innerHeight * 1.2);

    // Hide the header while reading down the page, bring it back as soon as the visitor scrolls up.
    if (header) {
      const busy = root.style.overflow === 'hidden' || document.querySelector('[data-mega].is-open, .gdrop.is-open, .co-drop.is-open, details[open].group-menu, details[open].co-menu');
      const dy = y - lastY;
      if (busy || y < 160) header.classList.remove('is-hidden');
      else if (dy > 6) header.classList.add('is-hidden');
      else if (dy < -6) header.classList.remove('is-hidden');
      header.classList.toggle('is-scrolled', y > 8);
    }
    lastY = y;

    // The transparent shop-home header is fixed; keep it below the staging / announcement bars until they scroll away.
    if (header?.classList.contains('site-header--overlay')) {
      const bars = [...document.querySelectorAll('.staging-bar, .announce-bar')];
      header.style.top = `${bars.reduce((m, b) => Math.max(m, b.getBoundingClientRect().bottom), 0)}px`;
    }

    for (const img of parallax) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const offset = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1 … 1 across the viewport
      img.style.setProperty('--py', `${(offset * -24).toFixed(1)}px`);
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}

/* ---------- instant-feeling navigation: prefetch on intent, smooth page transitions ---------- */
const sameSiteLink = (a) => a && a.href && a.origin === location.origin && !a.hasAttribute('download') && a.target !== '_blank'
  && !a.getAttribute('href').startsWith('#') && !/^\/(api|admin)\//.test(a.pathname) && !(a.pathname === location.pathname && a.hash);

function initPrefetch() {
  const done = new Set();
  const prefetch = (a) => {
    if (!sameSiteLink(a) || done.has(a.pathname)) return;
    done.add(a.pathname);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = a.pathname;
    document.head.append(l);
  };
  const onIntent = (e) => prefetch(e.target.closest?.('a'));
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
}

function initTransitions() {
  // Browsers with cross-document View Transitions animate via CSS (@view-transition). Others get a short fade.
  if (reduce || 'CSSViewTransitionRule' in window) return;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!sameSiteLink(a) || a.closest('[data-no-transition]')) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = a.href; }, 180);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('is-leaving'); });
}

/* ---------- lazy images fade in when loaded ---------- */
function initImageFade() {
  if (reduce) return;
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
    if (img.complete) return;
    img.classList.add('m-img');
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
  });
}

/* ---------- dropdown menus (desktop): hover on mouse devices, click/keyboard everywhere ---------- */
function initDropdowns() {
  const drops = [...document.querySelectorAll('[data-drop]')];
  const hoverable = matchMedia('(hover: hover)').matches;
  const closeAll = (except) => drops.forEach((d) => { if (d !== except) set(d, false); });
  function set(d, open) {
    d.classList.toggle('is-open', open);
    d.querySelector('[data-drop-toggle]').setAttribute('aria-expanded', String(open));
  }
  drops.forEach((d) => {
    const btn = d.querySelector('[data-drop-toggle]');
    let t;
    let hoverOpenedAt = 0;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = d.classList.contains('is-open');
      // A click right after hover-open (mouse devices) means "keep it open", not "toggle closed".
      const open = isOpen && Date.now() - hoverOpenedAt < 700 ? true : !isOpen;
      closeAll(d);
      set(d, open);
      if (open && e.detail === 0) d.querySelector('[data-drop-panel] a')?.focus({ preventScroll: true }); // keyboard activation
    });
    if (hoverable) {
      d.addEventListener('mouseenter', () => { clearTimeout(t); if (!d.classList.contains('is-open')) hoverOpenedAt = Date.now(); closeAll(d); set(d, true); });
      d.addEventListener('mouseleave', () => { t = setTimeout(() => set(d, false), 140); });
    }
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape' && d.classList.contains('is-open')) { set(d, false); btn.focus(); } });
    d.addEventListener('focusout', (e) => { if (!d.contains(e.relatedTarget)) set(d, false); });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-drop]')) closeAll(); });
}

/* ---------- floating CNM navigation: home to CNM Group in one click, sister companies on hover / tap ---------- */
function initCnmNav() {
  const nav = document.querySelector('[data-cnmnav]');
  if (!nav) return;
  const dock = nav.querySelector('.cnmnav__dock');
  const home = nav.querySelector('[data-cnmnav-home]');
  const toggle = nav.querySelector('[data-cnmnav-toggle]');
  const items = [...nav.querySelectorAll('.cnmnav__item')];
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const IDLE = 4000;
  let idle;
  let leave;
  let hoverOpenedAt = 0;
  let openedAtY = 0;
  let suppressClick = false;
  let usingKeys = false; // keyboard users keep it open while they move through it
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) usingKeys = true; });
  document.addEventListener('pointerdown', () => { usingKeys = false; }, { capture: true, passive: true });

  const isOpen = () => nav.classList.contains('is-open');
  const armIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if ((fine && nav.matches(':hover')) || (usingKeys && nav.contains(document.activeElement))) armIdle(); // mouse over it, or a keyboard user inside
      else set(false);
    }, IDLE);
  };
  function set(open) {
    if (open === isOpen()) { if (open) armIdle(); return; }
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close the company switcher' : 'Switch to another CNM company');
    items.forEach((a) => { a.tabIndex = open ? 0 : -1; });
    clearTimeout(idle);
    if (open) { openedAtY = scrollY; nav.classList.remove('is-compact'); armIdle(); }
  }

  // First visit in this tab: the control rises into place. Afterwards it simply stays put between pages.
  try { if (!sessionStorage.getItem('cnm.nav')) { nav.classList.add('is-intro'); sessionStorage.setItem('cnm.nav', '1'); } } catch { /* storage blocked */ }
  if (document.body.dataset.page === 'checkout') nav.classList.add('is-compact');

  toggle.addEventListener('click', (e) => {
    // A click right after a hover-open means "keep it open", not "close".
    const open = isOpen() && Date.now() - hoverOpenedAt < 700 ? true : !isOpen();
    set(open);
    if (open && e.detail === 0) items[0]?.focus({ preventScroll: true }); // keyboard
  });

  if (fine) {
    nav.addEventListener('mouseenter', () => { clearTimeout(leave); if (!isOpen()) hoverOpenedAt = Date.now(); set(true); });
    nav.addEventListener('mouseleave', () => { clearTimeout(leave); leave = setTimeout(() => set(false), 420); });
    if (!reduce) {
      dock.addEventListener('pointermove', (e) => {
        const r = dock.getBoundingClientRect();
        dock.style.setProperty('--mx', `${e.clientX - r.left}px`);
        dock.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
  }

  // Touch: a long press on the CNM emblem also opens the switcher (a normal tap still goes home).
  let press;
  home.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(press);
    press = setTimeout(() => { suppressClick = true; set(true); navigator.vibrate?.(8); }, 450);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => home.addEventListener(t, () => clearTimeout(press)));
  home.addEventListener('contextmenu', (e) => { if (suppressClick || !fine) e.preventDefault(); });
  home.addEventListener('click', (e) => { if (suppressClick) { e.preventDefault(); suppressClick = false; } });

  nav.addEventListener('pointermove', () => { if (isOpen()) armIdle(); }, { passive: true });
  nav.addEventListener('keydown', (e) => {
    if (!isOpen() || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i < 0 ? 0 : i + 1) : (i < 0 ? items.length - 1 : i - 1);
    e.preventDefault();
    if (next >= items.length) toggle.focus(); else items[Math.max(0, next)].focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    const inside = nav.contains(document.activeElement);
    set(false);
    if (inside) toggle.focus();
  });
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) set(false); });
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !nav.contains(e.target)) set(false); }, { passive: true });

  // Reading down the page: collapse to the emblem; scrolling back up brings the label back. Scrolling closes the switcher.
  let lastY = scrollY;
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      if (isOpen() && Math.abs(y - openedAtY) > 80) set(false);
      if (document.body.dataset.page !== 'checkout') {
        if (y > 240 && y - lastY > 4) nav.classList.add('is-compact');
        else if (y < 120 || lastY - y > 8) nav.classList.remove('is-compact');
      }
      lastY = y;
    });
  }, { passive: true });
}

/* ---------- light / dark switch ---------- */
function initThemeToggle() {
  const root = document.documentElement;
  const label = () => (root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  const buttons = document.querySelectorAll('[data-theme-toggle]');
  buttons.forEach((b) => b.setAttribute('aria-label', label()));
  buttons.forEach((b) => b.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    if (!reduce) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 500); }
    if (window.cnmSetTheme) window.cnmSetTheme(next); else root.dataset.theme = next;
    buttons.forEach((x) => x.setAttribute('aria-label', label()));
  }));
}

export function initMotion() {
  root.classList.add('has-motion');
  initReveals();
  initCountUp();
  initScroll();
  initPrefetch();
  initTransitions();
  initImageFade();
  initDropdowns();
  initCnmNav();
  initThemeToggle();
}

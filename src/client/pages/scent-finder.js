import { productCardHTML } from '../../shared/card.mjs';
import { escapeHtml } from '../../shared/format.mjs';
import { track } from '../analytics.js';
import { api } from '../api.js';
import { paintWish } from '../render.js';
import * as S from '../store.js';
import { setBusy } from '../ui.js';

const picked = (form, name) => [...form.querySelectorAll(`[data-chips="${name}"] [aria-pressed="true"]`)].map((b) => b.dataset.chip);

export function init() {
  const form = document.querySelector('[data-finder-form]');
  const out = document.querySelector('[data-finder-results]');
  const err = form?.querySelector('[data-finder-error]');
  if (!form) return;

  form.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    const group = chip.closest('[data-chips]');
    const on = chip.getAttribute('aria-pressed') !== 'true';
    const max = Number(group.dataset.max) || Infinity;
    if (on && group.querySelectorAll('[aria-pressed="true"]').length >= max) {
      group.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
    }
    chip.setAttribute('aria-pressed', String(on));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const body = {
      families: picked(form, 'families'),
      moods: picked(form, 'moods'),
      room: form.room.value,
      budget: form.budget.value,
      notes: form.notes.value.trim(),
    };
    const btn = form.querySelector('[data-finder-submit]');
    setBusy(btn, true, 'Finding your matches');
    out.innerHTML = '<div class="finder__loading"><div class="skeleton" style="height:28px;width:50%"></div><div class="grid-products">' + '<div class="skeleton" style="aspect-ratio:4/5"></div>'.repeat(4) + '</div></div>';
    try {
      const [res, { byId }] = await Promise.all([api('/api/recommend', { method: 'POST', body, loader: false }), S.catalogue()]);
      const picks = res.picks.map((x) => ({ ...x, p: byId.get(x.id) })).filter((x) => x.p);
      track('scent_finder', { source: res.source, room: body.room, moods: body.moods.join(','), families: body.families.join(','), results: picks.length });
      if (!picks.length) {
        out.innerHTML = `<div class="empty-state"><p class="h3">No close matches in that budget.</p><p class="muted">Try a wider budget or fewer choices, or <a class="textlink" href="/shop/">browse the full range</a>.</p></div>`;
      } else {
        out.innerHTML = `<div class="finder__results">
          <div class="section-head"><div><span class="label">Your matches</span><h2 class="h2">${escapeHtml(res.summary)}</h2></div>
            <span class="finder__source" data-finder-source="${res.source}">${res.source === 'ai' ? 'Suggested by our AI scent adviser' : 'Matched from our range'}</span></div>
          <div class="grid-products">${picks.map(({ p, reason }, i) => `<div class="finder__pick">${productCardHTML(p, { position: i + 1, list: 'scent_finder' })}<p class="finder__reason">${escapeHtml(reason)}</p></div>`).join('')}</div>
          ${res.tip ? `<p class="finder__tip"><strong>Tip</strong> ${escapeHtml(res.tip)}</p>` : ''}
          <p class="muted finder__small">Suggestions can be imperfect. Check each product page before you buy, or ask in store.</p>
        </div>`;
        paintWish(out);
      }
      out.focus({ preventScroll: true });
      out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } catch (ex) {
      out.innerHTML = '';
      err.hidden = false;
      err.textContent = ex.status === 429 ? 'You’ve asked for a lot of suggestions. Please wait a minute and try again.' : (ex.message || 'We couldn’t get suggestions right now. Please try again.');
    } finally {
      setBusy(btn, false);
    }
  });
}

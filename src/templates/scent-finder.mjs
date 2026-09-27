// Scent finder — shoppers describe what they like; /api/recommend returns matching CNM products.
import { escapeHtml } from '../shared/format.mjs';
import { BUDGETS, FAMILIES, MOODS, ROOMS } from '../shared/scent-match.mjs';
import { breadcrumbs } from './layout.mjs';

const chips = (name, list, { max } = {}) => `<div class="finder-chips" role="group" data-chips="${name}"${max ? ` data-max="${max}"` : ''}>${list
  .map((x) => `<button type="button" class="chip" aria-pressed="false" data-chip="${x.key}">${escapeHtml(x.label)}</button>`)
  .join('')}</div>`;

export function scentFinderPage(ctx) {
  const crumbs = breadcrumbs(ctx, [{ name: 'Scent finder', path: '/scent-finder/' }]);
  const body = `<div class="container">${crumbs.html}</div>
<section class="finder" data-finder>
  <div class="container finder__grid">
    <div class="finder__intro">
      <span class="label">Scent finder</span>
      <h1 class="h1">Find your <em class="italic">scent</em></h1>
      <p class="lead">Tell us what you love, where it’s going and how you want the room to feel. We’ll suggest pieces from the CNM Essentials range.</p>
      <p class="muted finder__small">Suggestions are based on product names, types and prices CNM has published. Visit a store in Lagos or Abuja to smell before you buy.</p>
    </div>
    <form class="form finder__form" data-finder-form novalidate>
      <fieldset class="finder__step"><legend><span class="finder__num">1</span> Scents you enjoy <span class="muted">(pick any)</span></legend>${chips('families', FAMILIES)}</fieldset>
      <fieldset class="finder__step"><legend><span class="finder__num">2</span> Which room?</legend>
        <div class="field"><label for="f-room" class="sr-only">Room</label><select id="f-room" name="room">${ROOMS.map((r) => `<option value="${r.key}">${escapeHtml(r.label)}</option>`).join('')}</select></div>
      </fieldset>
      <fieldset class="finder__step"><legend><span class="finder__num">3</span> The mood <span class="muted">(up to 3)</span></legend>${chips('moods', MOODS, { max: 3 })}</fieldset>
      <fieldset class="finder__step"><legend><span class="finder__num">4</span> Budget per item</legend>
        <div class="field"><label for="f-budget" class="sr-only">Budget</label><select id="f-budget" name="budget">${BUDGETS.map((b) => `<option value="${b.key}">${escapeHtml(b.label)}</option>`).join('')}</select></div>
      </fieldset>
      <div class="field"><label for="f-notes">Anything else? <span class="muted" style="font-weight:400">(optional)</span></label><textarea id="f-notes" name="notes" maxlength="280" rows="3" placeholder="e.g. I love vanilla, but nothing too strong for a small bedroom" style="min-height:96px"></textarea><span class="hint">Don’t include personal details.</span></div>
      <div class="alert alert--err" role="alert" data-finder-error hidden></div>
      <button class="btn btn--green btn--block" type="submit" data-finder-submit>Show my matches</button>
    </form>
  </div>
  <div class="container" data-finder-results aria-live="polite" tabindex="-1"></div>
</section>`;
  return { body, jsonld: [crumbs.ld] };
}

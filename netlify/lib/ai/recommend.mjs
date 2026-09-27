// AI scent recommendations via Claude, called through an AI gateway.
//
// Netlify AI Gateway: when enabled for the site, Netlify injects ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL into
// functions, and the SDK picks both up automatically — no key management needed. Any other Anthropic-compatible
// gateway works by setting those two variables. Without them we fall back to the rules-based matcher.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { describePreferences, eligible, familiesOf, ruleMatch } from '../../../src/shared/scent-match.mjs';

export const MODEL = process.env.CNM_AI_MODEL || 'claude-opus-5';
export const aiConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const Recommendation = z.object({
  summary: z.string(),
  picks: z.array(z.object({ id: z.string(), reason: z.string() })),
  tip: z.string(),
});

// Stable system prompt (cacheable). Catalogue facts go in the user turn so the prefix stays fixed.
const SYSTEM = `You are the scent adviser for CNM Essentials, a luxury home-fragrance retailer in Lagos and Abuja, Nigeria.
A shopper tells you which scents they like, the room they want to scent, the mood they want, and their budget.
Recommend 2 to 4 products from the catalogue provided in the shopper's message.

Ground every statement in the catalogue. CNM has not published scent notes, ingredients, strength or longevity for these products, so:
- Only recommend ids that appear in the catalogue, and only products listed as eligible (in budget and available).
- Base each reason on the product's name, type, brand and price, and on the shopper's room and mood. A scent word in the name (for example "Vanilla", "Rose", "Ocean Breeze") may be described as that kind of scent; do not add notes, ingredients, effects or claims beyond that.
- Match the product type to the room: room sprays for quick refreshes, Wallflowers plug-in refills for continuous scent in a room, odour eliminators for bathrooms and kitchens. If a refill is picked, mention it needs a Wallflowers plug-in unless they already own one.
- Keep each reason to one or two short sentences in warm, understated British English. No emoji.
- summary: one sentence reflecting their request back to them. tip: one practical, general placement or usage tip that makes no product claims.
- If nothing fits well, recommend the closest options and say so plainly in the summary.`;

let client;
const getClient = () => (client ||= new Anthropic({ timeout: 25_000, maxRetries: 1 }));

function catalogueFor(products, prefs) {
  const ok = new Set(eligible(products, prefs).map((p) => p.id));
  return products.map((p) => ({
    id: p.id, name: p.name, brand: p.brand, type: p.productType, category: p.category,
    price_ngn: p.price.amount, eligible: ok.has(p.id), name_suggests: familiesOf(p),
  }));
}

async function callModel(userContent) {
  const base = { model: MODEL, max_tokens: 2000, system: SYSTEM, output_config: { effort: 'low', format: zodOutputFormat(Recommendation) }, messages: [{ role: 'user', content: userContent }] };
  try {
    // Server-side fallback: if the model declines, the API re-runs on Anthropic's recommended fallback model.
    return await getClient().beta.messages.parse({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (err) {
    // Some gateways don't pass beta features through; retry once as a plain request.
    if (err instanceof Anthropic.BadRequestError) return getClient().messages.parse(base);
    throw err;
  }
}

/**
 * @returns {{ source: 'ai'|'rules', model?: string, summary: string, tip: string, picks: {id: string, reason: string}[] }}
 */
export async function recommend(products, input) {
  const rules = ruleMatch(products, input);
  const prefs = rules.prefs;
  const described = describePreferences(prefs);
  const fallback = (why) => ({
    source: 'rules', fallback: why,
    summary: `Here are our closest matches for a ${described.moods.join(', ').toLowerCase() || 'relaxed'} ${described.room.toLowerCase()}.`,
    tip: 'Start with one product per room and build up. A scent you live with every day should never feel overpowering.',
    picks: rules.picks,
  });
  if (!aiConfigured()) return fallback('ai_not_configured');

  const userContent = `Shopper preferences:\n${JSON.stringify(described, null, 2)}\n\nCatalogue (prices in Naira):\n${JSON.stringify(catalogueFor(products, prefs))}`;
  let res;
  try {
    res = await callModel(userContent);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn('[ai] rate limited, using rules');
    else if (err instanceof Anthropic.AuthenticationError) console.error('[ai] authentication failed — check the AI gateway / ANTHROPIC_API_KEY');
    else if (err instanceof Anthropic.APIError) console.error(`[ai] API error ${err.status}: ${err.message}`);
    else console.error('[ai] request failed', err);
    return fallback('ai_error');
  }
  if (res.stop_reason === 'refusal' || !res.parsed_output) return fallback(res.stop_reason === 'refusal' ? 'ai_refusal' : 'ai_unparsed');

  // Never trust the model blindly: keep only real, eligible products, de-duplicated, max 4.
  const allowed = new Set(eligible(products, prefs).map((p) => p.id));
  const seen = new Set();
  const picks = res.parsed_output.picks
    .filter((x) => allowed.has(x.id) && !seen.has(x.id) && seen.add(x.id))
    .slice(0, 4)
    .map((x) => ({ id: x.id, reason: x.reason.trim().slice(0, 400) }));
  if (!picks.length) return fallback('ai_no_valid_picks');
  return { source: 'ai', model: res.model, summary: res.parsed_output.summary.slice(0, 300), tip: res.parsed_output.tip.slice(0, 300), picks };
}

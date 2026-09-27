// Scent finder vocabulary + a transparent rules-based matcher.
// Used as the fallback when the AI model is unavailable, and to validate/complete AI picks.
// It only reads facts CNM has published (product names, types, brands, prices) — it never invents notes.

export const FAMILIES = [
  { key: 'floral', label: 'Floral', words: ['rose', 'petal', 'jasmine', 'pea', 'bohemian', 'lilac'] },
  { key: 'fresh', label: 'Fresh & clean', words: ['ocean', 'breeze', 'tea', 'sage', 'white'] },
  { key: 'fruity', label: 'Fruity', words: ['watermelon', 'lemonade', 'sugarplum', 'orange'] },
  { key: 'sweet', label: 'Sweet & gourmand', words: ['vanilla', 'sugarplum', 'pumpkin', 'sun kissed'] },
  { key: 'warm', label: 'Warm & cosy', words: ['bonfire', 'pumpkin', 'vanilla', 'midnight'] },
  { key: 'festive', label: 'Festive', words: ['christmas', 'santa', 'sugarplum', 'pumpkin'] },
];

export const ROOMS = [
  { key: 'living', label: 'Living room', types: ['Room Spray', 'Wallflower Plug-In Refill', 'Wallflower Refill', 'Wallflower Plug-In'] },
  { key: 'bedroom', label: 'Bedroom', types: ['Room Spray', 'Wallflower Plug-In Refill', 'Wallflower Refill'] },
  { key: 'bathroom', label: 'Bathroom', types: ['Odour Eliminator', 'Room Spray'] },
  { key: 'kitchen', label: 'Kitchen', types: ['Odour Eliminator', 'Wallflower Plug-In Refill', 'Room Spray'] },
  { key: 'entrance', label: 'Entrance & hallway', types: ['Wallflower Plug-In Refill', 'Wallflower Refill', 'Wallflower Plug-In', 'Room Spray'] },
  { key: 'office', label: 'Office', types: ['Wallflower Plug-In Refill', 'Room Spray'] },
  { key: 'whole', label: 'Whole home', types: ['Wallflower Plug-In Refill', 'Wallflower Refill', 'Wallflower Plug-In', 'Room Spray'] },
];

export const MOODS = [
  { key: 'calm', label: 'Calm & restful', families: ['floral', 'fresh'] },
  { key: 'energising', label: 'Energising', families: ['fresh', 'fruity'] },
  { key: 'cosy', label: 'Cosy', families: ['warm', 'sweet'] },
  { key: 'romantic', label: 'Romantic', families: ['floral', 'sweet'] },
  { key: 'welcoming', label: 'Welcoming', families: ['fresh', 'sweet', 'floral'] },
  { key: 'clean', label: 'Fresh & clean', families: ['fresh'] },
  { key: 'festive', label: 'Festive', families: ['festive', 'warm'] },
];

export const BUDGETS = [
  { key: 'any', label: 'Any budget', max: Infinity },
  { key: 'u15', label: 'Under ₦15,000', max: 15000 },
  { key: 'u20', label: 'Under ₦20,000', max: 20000 },
  { key: 'u35', label: 'Under ₦35,000', max: 35000 },
];

const byKey = (list, k) => list.find((x) => x.key === k);

export function familiesOf(p) {
  const n = p.name.toLowerCase();
  return FAMILIES.filter((f) => f.words.some((w) => n.includes(w))).map((f) => f.key);
}

/** Normalise/validate shopper input against the fixed vocabularies. */
export function cleanPreferences(input = {}) {
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  return {
    families: arr(input.families).filter((k) => byKey(FAMILIES, k)).slice(0, 6),
    room: byKey(ROOMS, input.room) ? input.room : 'living',
    moods: arr(input.moods).filter((k) => byKey(MOODS, k)).slice(0, 3),
    budget: byKey(BUDGETS, input.budget) ? input.budget : 'any',
    notes: String(input.notes || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 280),
  };
}

export function describePreferences(prefs) {
  return {
    families: prefs.families.map((k) => byKey(FAMILIES, k).label),
    room: byKey(ROOMS, prefs.room).label,
    moods: prefs.moods.map((k) => byKey(MOODS, k).label),
    budget: byKey(BUDGETS, prefs.budget).label,
    notes: prefs.notes,
  };
}

/** Candidates the shopper could actually buy for this room and budget. */
export function eligible(products, prefs) {
  const max = byKey(BUDGETS, prefs.budget).max;
  return products.filter((p) => p.available !== false && p.stock?.quantity !== 0 && (p.price?.amount ?? Infinity) <= max);
}

/** Rules-based ranking with a human-readable reason for each pick. */
export function ruleMatch(products, input, limit = 4) {
  const prefs = cleanPreferences(input);
  const room = byKey(ROOMS, prefs.room);
  const wanted = new Set([...prefs.families, ...prefs.moods.flatMap((m) => byKey(MOODS, m).families)]);
  const noteWords = prefs.notes.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const scored = eligible(products, prefs).map((p) => {
    const fams = familiesOf(p);
    const famHits = fams.filter((f) => wanted.has(f));
    const typeRank = room.types.indexOf(p.productType);
    const noteHit = noteWords.some((w) => p.name.toLowerCase().includes(w) || p.brand.toLowerCase().includes(w));
    const score = famHits.length * 3 + (typeRank === -1 ? -2 : 2 - typeRank * 0.4) + (noteHit ? 4 : 0);
    const bits = [];
    if (famHits.length) bits.push(`its name points to a ${famHits.map((f) => byKey(FAMILIES, f).label.toLowerCase()).join(' and ')} scent`);
    if (typeRank !== -1) bits.push(`a ${p.productType.toLowerCase()} suits a ${room.label.toLowerCase()}`);
    if (noteHit) bits.push('it matches what you described');
    if (/refill/i.test(p.productType)) bits.push('it needs a Wallflowers plug-in');
    return { p, score, reason: bits.length ? `${bits.join('; ').replace(/^./, (c) => c.toUpperCase())}.` : `A ${p.productType.toLowerCase()} from ${p.brand}.` };
  });
  scored.sort((a, b) => b.score - a.score || a.p.price.amount - b.p.price.amount);
  return { prefs, picks: scored.slice(0, limit).map(({ p, reason }) => ({ id: p.id, reason })) };
}

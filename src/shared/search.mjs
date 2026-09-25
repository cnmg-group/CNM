// Predictive search with typo tolerance. Used by the website and mirrored in the mobile app.

export const normalise = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ');
export const tokenise = (s) => normalise(s).split(/\s+/).filter(Boolean);

/** Optimal string alignment (Damerau–Levenshtein) distance, capped for speed. */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

const tolerance = (len) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

function tokenScore(q, tokens) {
  let best = 0;
  for (const t of tokens) {
    if (t === q) return 3;
    if (t.startsWith(q)) best = Math.max(best, 2.2);
    else if (q.length >= 3 && t.includes(q)) best = Math.max(best, 1.4);
    else {
      const tol = tolerance(q.length);
      if (tol && editDistance(q, t.slice(0, Math.max(q.length, t.length)), tol) <= tol) best = Math.max(best, 1.2);
      else if (tol && t.length > q.length && editDistance(q, t.slice(0, q.length), tol) <= tol) best = Math.max(best, 1);
    }
  }
  return best;
}

const TYPE_BOOST = { product: 1.2, category: 1.15, collection: 1.1, service: 1, store: 1, article: .9 };

/** Prepare documents once: { type, title, url, text, keywords[] } */
export function buildIndex(docs) {
  return docs.map((d) => ({ ...d, _title: tokenise(d.title), _body: tokenise(`${d.text || ''} ${(d.keywords || []).join(' ')}`) }));
}

export function search(index, query, { limit = 20 } = {}) {
  const q = tokenise(query);
  if (!q.length) return [];
  const out = [];
  for (const doc of index) {
    let score = 0;
    let matched = 0;
    for (const term of q) {
      const s = Math.max(tokenScore(term, doc._title) * 2, tokenScore(term, doc._body));
      if (s > 0) matched++;
      score += s;
    }
    if (matched === q.length) out.push({ doc, score: score * (TYPE_BOOST[doc.type] || 1) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.doc);
}

/** Wrap matched query prefixes in <mark>; input must already be HTML-escaped. */
export function highlight(escapedTitle, query) {
  const terms = tokenise(query).filter((t) => t.length > 1);
  if (!terms.length) return escapedTitle;
  const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return escapedTitle.replace(re, '<mark>$1</mark>');
}

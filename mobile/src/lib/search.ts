import type { Catalogue, Category, Collection, Product } from './types';

/** Optimal-string-alignment Damerau–Levenshtein distance (adjacent transpositions count as 1). */
export function damerauLevenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  if (Math.abs(al - bl) > max) return max + 1;
  const d: number[][] = Array.from({ length: al + 1 }, (_, i) => {
    const row = new Array<number>(bl + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[al][bl];
}

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const n = normalise(text);
  return n ? n.split(' ') : [];
}

/** Typo budget grows with word length: 1–3 chars exact, 4–5 one edit, 6+ two edits. */
export function allowedEdits(token: string): number {
  if (token.length <= 3) return 0;
  if (token.length <= 5) return 1;
  return 2;
}

export type TokenMatch = 'exact' | 'prefix' | 'fuzzy' | null;

/**
 * Compare a query token against a document token.
 * `predictive` allows the query token to be an unfinished prefix, with typo
 * tolerance applied to the same-length prefix of the document token.
 */
export function matchToken(query: string, doc: string, predictive = true): TokenMatch {
  if (query === doc) return 'exact';
  if (predictive && doc.startsWith(query)) return 'prefix';
  const budget = allowedEdits(query);
  if (budget === 0) return null;
  if (damerauLevenshtein(query, doc, budget) <= budget) return 'fuzzy';
  if (predictive && doc.length > query.length) {
    const head = doc.slice(0, query.length);
    if (damerauLevenshtein(query, head, budget) <= budget) return 'fuzzy';
  }
  return null;
}

const WEIGHT: Record<Exclude<TokenMatch, null>, number> = { exact: 3, prefix: 2, fuzzy: 1 };

export interface SearchDoc<T> {
  item: T;
  /** Primary tokens (the title) weigh double. */
  titleTokens: string[];
  tokens: string[];
}

export interface ScoredResult<T> {
  item: T;
  score: number;
}

/**
 * Every query token must match some document token (AND semantics), so
 * adding words narrows results as users expect.
 */
export function scoreDoc<T>(queryTokens: string[], doc: SearchDoc<T>): number {
  if (!queryTokens.length) return 0;
  let total = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const t of doc.titleTokens) {
      const m = matchToken(q, t);
      if (m) best = Math.max(best, WEIGHT[m] * 2);
    }
    for (const t of doc.tokens) {
      const m = matchToken(q, t);
      if (m) best = Math.max(best, WEIGHT[m]);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function search<T>(query: string, docs: SearchDoc<T>[], limit = 50): ScoredResult<T>[] {
  const q = tokenize(query);
  if (!q.length) return [];
  return docs
    .map((doc, i) => ({ item: doc.item, score: scoreDoc(q, doc), i }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map(({ item, score }) => ({ item, score }));
}

export function productDocs(catalogue: Catalogue): SearchDoc<Product>[] {
  return catalogue.products.map((p) => {
    const category = catalogue.categories.find((c) => c.slug === p.category);
    const collections = p.collections
      .map((slug) => catalogue.collections.find((c) => c.slug === slug)?.name ?? slug)
      .join(' ');
    return {
      item: p,
      titleTokens: tokenize(p.name),
      tokens: tokenize(
        [p.productType, category?.name, collections, p.scentFamily, p.brand].filter(Boolean).join(' '),
      ),
    };
  });
}

export type Suggestion =
  | { kind: 'category'; item: Category }
  | { kind: 'collection'; item: Collection }
  | { kind: 'brand'; item: { name: string } }
  | { kind: 'product'; item: Product };

export function suggestionDocs(catalogue: Catalogue): SearchDoc<Suggestion>[] {
  const brandNames = Array.from(new Set(catalogue.products.map((p) => p.brand).filter(Boolean)));
  const nonEmpty = new Set(catalogue.products.map((p) => p.category));
  return [
    ...brandNames.map((name) => ({
      item: { kind: 'brand', item: { name } } as Suggestion,
      titleTokens: tokenize(name),
      tokens: [],
    })),
    ...catalogue.categories.filter((c) => c.showWhenEmpty || nonEmpty.has(c.slug)).map((c) => ({
      item: { kind: 'category', item: c } as Suggestion,
      titleTokens: tokenize(c.name),
      tokens: [],
    })),
    ...catalogue.collections.map((c) => ({
      item: { kind: 'collection', item: c } as Suggestion,
      titleTokens: tokenize(c.name),
      tokens: [],
    })),
    ...productDocs(catalogue).map((d) => ({ ...d, item: { kind: 'product', item: d.item } as Suggestion })),
  ];
}

/** "Did you mean" — the closest vocabulary word for each unmatched query token. */
export function didYouMean(query: string, catalogue: Catalogue): string | null {
  const vocab = new Set<string>();
  for (const d of productDocs(catalogue)) [...d.titleTokens, ...d.tokens].forEach((t) => vocab.add(t));
  catalogue.categories.forEach((c) => tokenize(c.name).forEach((t) => vocab.add(t)));
  const q = tokenize(query);
  if (!q.length) return null;
  let changed = false;
  const fixed = q.map((token) => {
    if (vocab.has(token)) return token;
    let best: { word: string; d: number } | null = null;
    for (const word of vocab) {
      const d = damerauLevenshtein(token, word, 3);
      if (d <= 3 && (!best || d < best.d)) best = { word, d };
    }
    if (best && best.word !== token) {
      changed = true;
      return best.word;
    }
    return token;
  });
  return changed ? fixed.join(' ') : null;
}

export const MAX_RECENT_SEARCHES = 8;

export function pushRecent(list: string[], query: string, max = MAX_RECENT_SEARCHES): string[] {
  const q = query.trim();
  if (!q) return list;
  const key = normalise(q);
  return [q, ...list.filter((x) => normalise(x) !== key)].slice(0, max);
}

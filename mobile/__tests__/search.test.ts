import { bundledCatalogue } from '@/lib/catalogue';
import { damerauLevenshtein, didYouMean, matchToken, productDocs, pushRecent, search, suggestionDocs, tokenize } from '@/lib/search';

const docs = productDocs(bundledCatalogue);
const names = (q: string) => search(q, docs).map((r) => r.item.name);

describe('damerauLevenshtein', () => {
  it('computes classic edits', () => {
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
    expect(damerauLevenshtein('', 'abc')).toBe(3);
    expect(damerauLevenshtein('same', 'same')).toBe(0);
  });

  it('counts an adjacent transposition as one edit', () => {
    expect(damerauLevenshtein('diffsuer', 'diffuser')).toBe(1);
    expect(damerauLevenshtein('ab', 'ba')).toBe(1);
  });

  it('bails out early past the max', () => {
    expect(damerauLevenshtein('abcdef', 'uvwxyz', 1)).toBeGreaterThan(1);
  });
});

describe('matchToken', () => {
  it('matches exact, prefix and fuzzy', () => {
    expect(matchToken('oil', 'oil')).toBe('exact');
    expect(matchToken('diff', 'diffuser')).toBe('prefix');
    expect(matchToken('difuser', 'diffuser')).toBe('fuzzy');
  });

  it('is strict for very short tokens', () => {
    expect(matchToken('oul', 'oil')).toBeNull();
  });
});

describe('search', () => {
  it('finds products by name', () => {
    expect(names('body butter')[0]).toBe('Body Butter');
  });

  it('tolerates typos', () => {
    expect(names('stonglow')).toContain('Stoneglow Reed Diffuser');
    expect(names('difuser oil')).toContain('Signature Diffuser Oil');
    expect(names('smrat scent')).toContain('Smart Scent Machine');
  });

  it('is predictive on partial words', () => {
    expect(names('refi')).toContain('Refill Oil');
  });

  it('matches category names', () => {
    expect(names('car fragrance')).toContain('Car Diffuser');
  });

  it('uses AND semantics across tokens', () => {
    expect(names('body wash')).toEqual(['Body Wash']);
  });

  it('returns nothing for nonsense', () => {
    expect(names('zzzzqqq')).toEqual([]);
    expect(names('   ')).toEqual([]);
  });

  it('ranks title matches above attribute matches', () => {
    expect(names('diffuser')[0]).toMatch(/Diffuser/);
  });

  it('suggests categories and collections', () => {
    const kinds = search('stoneglow', suggestionDocs(bundledCatalogue)).map((r) => r.item.kind);
    expect(kinds).toContain('collection');
    expect(kinds).toContain('product');
  });
});

describe('didYouMean', () => {
  it('corrects misspelt words to catalogue vocabulary', () => {
    expect(didYouMean('candel buttr', bundledCatalogue)).toContain('butter');
  });

  it('returns null when nothing needs correcting', () => {
    expect(didYouMean('body', bundledCatalogue)).toBeNull();
  });
});

describe('recent searches', () => {
  it('dedupes case-insensitively, most recent first, bounded', () => {
    let list: string[] = [];
    list = pushRecent(list, 'Oil');
    list = pushRecent(list, 'body');
    list = pushRecent(list, 'oil');
    expect(list).toEqual(['oil', 'body']);
    for (let i = 0; i < 20; i++) list = pushRecent(list, `q${i}`);
    expect(list).toHaveLength(8);
  });

  it('tokenize strips punctuation and accents', () => {
    expect(tokenize('Crème—Body, Oil!')).toEqual(['creme', 'body', 'oil']);
  });
});

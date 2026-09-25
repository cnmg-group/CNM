import { bundledCatalogue } from '@/lib/catalogue';
import { damerauLevenshtein, didYouMean, matchToken, productDocs, pushRecent, search, suggestionDocs, tokenize } from '@/lib/search';

const docs = productDocs(bundledCatalogue);
const ids = (q: string) => search(q, docs).map((r) => r.item.id);

describe('damerauLevenshtein', () => {
  it('computes classic edits', () => {
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
    expect(damerauLevenshtein('', 'abc')).toBe(3);
    expect(damerauLevenshtein('same', 'same')).toBe(0);
  });

  it('counts an adjacent transposition as one edit', () => {
    expect(damerauLevenshtein('vanilal', 'vanilla')).toBe(1);
    expect(damerauLevenshtein('ab', 'ba')).toBe(1);
  });

  it('bails out early past the max', () => {
    expect(damerauLevenshtein('abcdef', 'uvwxyz', 1)).toBeGreaterThan(1);
  });
});

describe('matchToken', () => {
  it('matches exact, prefix and fuzzy', () => {
    expect(matchToken('spray', 'spray')).toBe('exact');
    expect(matchToken('wallf', 'wallflower')).toBe('prefix');
    expect(matchToken('walflower', 'wallflower')).toBe('fuzzy');
  });

  it('is strict for very short tokens', () => {
    expect(matchToken('sae', 'sage')).toBe(null);
  });
});

describe('search', () => {
  it('finds products by name', () => {
    expect(ids('midnight vanilla')[0]).toBe('midnight-vanilla-room-spray');
  });

  it('tolerates typos', () => {
    expect(ids('midnite vanila')).toContain('midnight-vanilla-room-spray');
    expect(ids('watermelon lemonaid')).toContain('watermelon-lemonade-wallflower-plug-in-refill');
    expect(ids('odor eliminator')).toContain('white-jasmine-odour-eliminator');
  });

  it('is predictive on partial words', () => {
    expect(ids('sugarpl')).toContain('sugarplum-delight-odour-eliminator');
  });

  it('matches brand and product type', () => {
    const febreze = ids('febreze');
    expect(febreze).toContain('white-jasmine-odour-eliminator');
    expect(febreze).not.toContain('midnight-vanilla-room-spray');
    expect(ids('victorias secret room spray')).toContain('love-stoned-room-spray');
  });

  it('matches category names', () => {
    expect(ids('diffusers refills')).toContain('sweet-pea-wallflower-plug-in-refill');
  });

  it('uses AND semantics across tokens', () => {
    expect(ids('perfect christmas room spray')).toEqual(['the-perfect-christmas-room-spray']);
  });

  it('returns nothing for nonsense', () => {
    expect(ids('zzzzqqq')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it('ranks title matches above attribute matches', () => {
    expect(ids('vanilla')[0]).toMatch(/vanilla/);
  });

  it('suggests brands, categories and products; hides empty non-showWhenEmpty categories', () => {
    const suggestions = search('b', suggestionDocs(bundledCatalogue)).map((r) => r.item);
    expect(suggestions.some((s) => s.kind === 'brand' && s.item.name === 'Bath & Body Works')).toBe(true);
    const all = suggestionDocs(bundledCatalogue).map((d) => d.item);
    expect(all.some((s) => s.kind === 'category' && s.item.slug === 'beverages')).toBe(false);
    expect(all.some((s) => s.kind === 'category' && s.item.slug === 'hair-care')).toBe(true);
  });
});

describe('didYouMean', () => {
  it('corrects misspelt words to catalogue vocabulary', () => {
    expect(didYouMean('jasmin sprai', bundledCatalogue)).toBe('jasmine spray');
  });

  it('returns null when nothing needs correcting', () => {
    expect(didYouMean('vanilla', bundledCatalogue)).toBeNull();
  });
});

describe('recent searches', () => {
  it('dedupes case-insensitively, most recent first, bounded', () => {
    let list: string[] = [];
    list = pushRecent(list, 'Vanilla');
    list = pushRecent(list, 'wallflower');
    list = pushRecent(list, 'vanilla');
    expect(list).toEqual(['vanilla', 'wallflower']);
    for (let i = 0; i < 20; i++) list = pushRecent(list, `q${i}`);
    expect(list).toHaveLength(8);
  });

  it('tokenize strips punctuation and accents', () => {
    expect(tokenize("Crème—Body, Nurse's Day-Off!")).toEqual(['creme', 'body', 'nurse', 's', 'day', 'off']);
  });
});

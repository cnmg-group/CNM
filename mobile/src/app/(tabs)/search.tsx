import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ProductCard, ProductGrid } from '@/components/product-card';
import { Body, Chip, H2, IconButton, Label, Small, TextLink } from '@/components/ui';
import { track } from '@/lib/analytics';
import { brands, categoryName, productSubtitle, visibleCategories } from '@/lib/catalogue';
import { didYouMean, productDocs, pushRecent, search, suggestionDocs, type Suggestion } from '@/lib/search';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';
import { useCatalogue } from '@/state/catalogue';
import { colors, fonts, hairline, minTouch, space, type } from '@/theme';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchScreen() {
  const { catalogue } = useCatalogue();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const query = useDebounced(text, 120);

  useEffect(() => {
    readJSON<string[]>(KEYS.recentSearches, []).then((r) => Array.isArray(r) && setRecent(r));
  }, []);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }, []),
  );

  const sDocs = useMemo(() => suggestionDocs(catalogue), [catalogue]);
  const pDocs = useMemo(() => productDocs(catalogue), [catalogue]);
  const suggestions = useMemo(() => (query.trim() ? search(query, sDocs, 8).map((r) => r.item) : []), [query, sDocs]);
  const results = useMemo(() => (submitted ? search(submitted, pDocs).map((r) => r.item) : []), [submitted, pDocs]);
  const correction = useMemo(() => (submitted && results.length === 0 ? didYouMean(submitted, catalogue) : null), [submitted, results.length, catalogue]);
  const recommendations = useMemo(() => {
    const best = catalogue.products.filter((p) => p.isBestSeller);
    const fresh = catalogue.products.filter((p) => p.isNew && !p.isBestSeller);
    return [...best, ...fresh].slice(0, 6);
  }, [catalogue.products]);

  // Derived from the catalogue itself (no invented popularity data): product types, brands, categories.
  const popular = useMemo(() => {
    const types = catalogue.products.map((p) => p.productType).filter((t): t is string => !!t);
    const cats = visibleCategories(catalogue)
      .filter((c) => catalogue.products.some((p) => p.category === c.slug))
      .map((c) => c.name);
    return Array.from(new Set([...types, ...brands(catalogue), ...cats])).slice(0, 10);
  }, [catalogue]);

  const runSearch = (q: string) => {
    const term = q.trim();
    if (!term) return;
    setText(term);
    setSubmitted(term);
    inputRef.current?.blur();
    const next = pushRecent(recent, term);
    setRecent(next);
    writeJSON(KEYS.recentSearches, next);
    const count = search(term, pDocs).length;
    track('search', { search_term: term, results: count });
  };

  const openSuggestion = (s: Suggestion) => {
    const next = pushRecent(recent, text);
    setRecent(next);
    writeJSON(KEYS.recentSearches, next);
    track('search', { search_term: text.trim(), selected: s.kind });
    if (s.kind === 'product') router.push(`/products/${s.item.slug}`);
    else if (s.kind === 'category') router.push(`/shop/${s.item.slug}`);
    else if (s.kind === 'brand') router.push({ pathname: '/shop', params: { brand: s.item.name } });
    else router.push(`/collections/${s.item.slug}`);
  };

  const clearRecent = () => {
    setRecent([]);
    writeJSON(KEYS.recentSearches, []);
  };

  const typing = text.trim().length > 0 && submitted !== text.trim();

  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (submitted) setSubmitted(null);
          }}
          onSubmitEditing={() => runSearch(text)}
          placeholder="Search fragrance, body care, machines…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search products"
          style={styles.input}
        />
        {text ? (
          <IconButton
            icon="x"
            label="Clear search"
            size={18}
            onPress={() => {
              setText('');
              setSubmitted(null);
              inputRef.current?.focus();
            }}
          />
        ) : null}
      </View>

      {submitted ? (
        results.length ? (
          <ProductGrid
            products={results}
            list="search_results"
            header={
              <Small style={styles.resultCount} accessibilityLiveRegion="polite">
                {results.length} {results.length === 1 ? 'result' : 'results'} for “{submitted}”
              </Small>
            }
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
            <View style={styles.pad}>
              <H2 style={{ marginTop: space.lg }}>No results for “{submitted}”</H2>
              {correction ? (
                <Pressable onPress={() => runSearch(correction)} accessibilityRole="button" accessibilityLabel={`Search for ${correction} instead`} style={styles.didYouMean}>
                  <Body>
                    Did you mean <Text style={{ fontFamily: fonts.sansSemiBold, textDecorationLine: 'underline' }}>{correction}</Text>?
                  </Body>
                </Pressable>
              ) : (
                <Body style={{ color: colors.inkSoft, marginTop: space.xs }}>Check the spelling or try a broader term.</Body>
              )}
              <Label style={styles.group}>You may like</Label>
            </View>
            <View style={styles.recGrid}>
              {recommendations.map((p) => (
                <View key={p.id} style={{ width: '48.5%' }}>
                  <ProductCard product={p} list="search_zero_results" />
                </View>
              ))}
            </View>
          </ScrollView>
        )
      ) : typing ? (
        <FlatList
          data={suggestions}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(s) => `${s.kind}:${s.kind === 'product' ? s.item.id : s.kind === 'brand' ? s.item.name : s.item.slug}`}
          ListHeaderComponent={
            <Pressable onPress={() => runSearch(text)} style={styles.suggestion} accessibilityRole="button" accessibilityLabel={`Search for ${text}`}>
              <Feather name="search" size={16} color={colors.ink} />
              <Text style={[type.body, { marginLeft: space.sm, flex: 1 }]}>Search for “{text.trim()}”</Text>
            </Pressable>
          }
          ListEmptyComponent={query === text ? <Small style={styles.pad}>No suggestions — press search to see recommendations.</Small> : null}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openSuggestion(item)}
              style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.offWhite }]}
              accessibilityRole="link"
              accessibilityLabel={item.kind === 'product' ? `${item.item.name}, ${productSubtitle(item.item)}` : `${item.item.name}, ${item.kind}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{item.item.name}</Text>
                <Label style={{ color: colors.muted, fontSize: 10 }}>
                  {item.kind === 'product'
                    ? productSubtitle(item.item) || categoryName(catalogue, item.item.category)
                    : item.kind === 'category'
                      ? 'Category'
                      : item.kind === 'brand'
                        ? 'Brand'
                        : 'Collection'}
                </Label>
              </View>
              <Feather name="arrow-up-left" size={16} color={colors.muted} />
            </Pressable>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: space.xxl }]} keyboardShouldPersistTaps="handled">
          {recent.length ? (
            <>
              <View style={styles.groupHeader}>
                <Label style={{ flex: 1 }}>Recent searches</Label>
                <TextLink title="Clear" onPress={clearRecent} />
              </View>
              {recent.map((r) => (
                <Pressable key={r} onPress={() => runSearch(r)} style={[styles.suggestion, { paddingHorizontal: 0 }]} accessibilityRole="button" accessibilityLabel={`Search ${r}`}>
                  <Feather name="clock" size={16} color={colors.muted} />
                  <Text style={[type.body, { marginLeft: space.sm }]}>{r}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          <Label style={styles.group}>Popular searches</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {popular.map((p) => (
              <Chip key={p} label={p} onPress={() => runSearch(p)} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.md,
    marginVertical: space.sm,
    paddingLeft: space.sm,
    borderBottomWidth: hairline,
    borderColor: colors.ink,
    minHeight: 52,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 17, color: colors.ink, paddingHorizontal: space.sm, minHeight: minTouch },
  pad: { paddingHorizontal: space.md },
  resultCount: { paddingHorizontal: space.md, marginVertical: space.md },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: space.md,
    borderBottomWidth: hairline,
    borderColor: colors.hairline,
  },
  group: { marginTop: space.xl, marginBottom: space.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  didYouMean: { minHeight: minTouch, justifyContent: 'center' },
  recGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: space.md },
});

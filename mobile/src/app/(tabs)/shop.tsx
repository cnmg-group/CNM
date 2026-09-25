import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FilterSheet, SortSheet } from '@/components/filter-sheet';
import { ProductGrid, SkeletonGrid } from '@/components/product-card';
import { Body, Button, Chip, EmptyState, H1, Label, Small } from '@/components/ui';
import { track } from '@/lib/analytics';
import { sortedCategories } from '@/lib/catalogue';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, SORT_OPTIONS, type Filters, type SortKey } from '@/lib/filters';
import { useCatalogue } from '@/state/catalogue';
import { colors, hairline, minTouch, space } from '@/theme';

/** Translate a route segment (/shop/:category) into filters. Mirrors the website's /shop/new-in/ and /shop/best-sellers/. */
function filtersFromParam(category?: string, collection?: string): Filters {
  if (category === 'new-in') return { ...EMPTY_FILTERS, newOnly: true };
  if (category === 'best-sellers') return { ...EMPTY_FILTERS, bestSellersOnly: true };
  return {
    ...EMPTY_FILTERS,
    categories: category ? [category] : [],
    collections: collection ? [collection] : [],
  };
}

export default function ShopScreen() {
  const params = useLocalSearchParams<{ category?: string; collection?: string }>();
  const { catalogue, loading, refreshing, refresh, error, source } = useCatalogue();
  const [filters, setFilters] = useState<Filters>(() => filtersFromParam(params.category, params.collection));
  const [sort, setSort] = useState<SortKey>('featured');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (params.category || params.collection) setFilters(filtersFromParam(params.category, params.collection));
  }, [params.category, params.collection]);

  const categories = useMemo(() => sortedCategories(catalogue), [catalogue]);
  const results = useMemo(() => applyFilters(catalogue.products, filters, sort), [catalogue.products, filters, sort]);
  const count = activeFilterCount(filters);

  const selectedCategory = filters.categories.length === 1 ? catalogue.categories.find((c) => c.slug === filters.categories[0]) : undefined;
  const title = selectedCategory?.name ?? (filters.newOnly && count === 1 ? 'New in' : filters.bestSellersOnly && count === 1 ? 'Best sellers' : 'Shop all');

  useEffect(() => {
    if (!loading) track('view_item_list', { item_list_name: title, items: results.slice(0, 20).map((p) => ({ item_id: p.id, item_name: p.name })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, loading]);

  const setCategory = (slug: string | null) => {
    setFilters((f) => ({ ...f, categories: slug ? [slug] : [] }));
    router.setParams({ category: undefined, collection: undefined });
  };

  const header = (
    <View>
      <View style={styles.titleBlock}>
        <H1>{title}</H1>
        {selectedCategory?.intro ? <Body style={{ color: colors.inkSoft, marginTop: space.xs }}>{selectedCategory.intro}</Body> : null}
        {source === 'bundled' && error ? <Small style={{ marginTop: space.xs }}>Showing saved catalogue — you appear to be offline.</Small> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={filters.categories.length === 0} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c.slug} label={c.name} selected={filters.categories.length === 1 && filters.categories[0] === c.slug} onPress={() => setCategory(c.slug)} />
        ))}
      </ScrollView>
      <View style={styles.toolbar}>
        <Pressable onPress={() => setFilterOpen(true)} style={styles.tool} accessibilityRole="button" accessibilityLabel={count ? `Filter, ${count} active` : 'Filter'}>
          <Label>Filter{count ? ` (${count})` : ''}</Label>
        </Pressable>
        <View style={styles.toolDivider} />
        <Pressable onPress={() => setSortOpen(true)} style={styles.tool} accessibilityRole="button" accessibilityLabel={`Sort by ${SORT_OPTIONS.find((o) => o.key === sort)?.label}`}>
          <Label>Sort: {SORT_OPTIONS.find((o) => o.key === sort)?.label}</Label>
        </Pressable>
      </View>
      <Small style={styles.count} accessibilityLiveRegion="polite">
        {loading ? ' ' : `${results.length} ${results.length === 1 ? 'product' : 'products'}`}
      </Small>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      {loading ? (
        <ScrollView>
          {header}
          <SkeletonGrid />
        </ScrollView>
      ) : (
        <ProductGrid
          products={results}
          list={title}
          header={header}
          onRefresh={refresh}
          refreshing={refreshing}
          empty={
            <EmptyState
              title="Nothing matches just yet"
              body="Try removing a filter or two."
              action="Clear filters"
              onAction={() => {
                setFilters(EMPTY_FILTERS);
                router.setParams({ category: undefined, collection: undefined });
              }}
            />
          }
        />
      )}
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} catalogue={catalogue} value={filters} sort={sort} onApply={setFilters} />
      <SortSheet visible={sortOpen} onClose={() => setSortOpen(false)} value={sort} onChange={setSort} />
      {count > 0 && !loading ? (
        <View style={styles.clearBar} pointerEvents="box-none">
          <Button title="Clear filters" variant="secondary" compact onPress={() => setFilters(EMPTY_FILTERS)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: { paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.md },
  chips: { paddingHorizontal: space.md, paddingBottom: space.sm },
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.hairline,
    marginBottom: space.sm,
  },
  tool: { flex: 1, minHeight: minTouch + 4, alignItems: 'center', justifyContent: 'center' },
  toolDivider: { width: hairline, backgroundColor: colors.hairline },
  count: { paddingHorizontal: space.md, marginBottom: space.md },
  clearBar: { position: 'absolute', bottom: space.md, alignSelf: 'center' },
});

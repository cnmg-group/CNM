import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { brands, visibleCategories } from '@/lib/catalogue';
import { applyFilters, EMPTY_FILTERS, priceBands, SORT_OPTIONS, type Filters, type SortKey } from '@/lib/filters';
import type { Catalogue } from '@/lib/types';
import { space } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { Button, Chip, Label, ToggleRow } from './ui';

function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterSheet({
  visible,
  onClose,
  catalogue,
  value,
  sort,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  catalogue: Catalogue;
  value: Filters;
  sort: SortKey;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Filters>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const bands = useMemo(() => priceBands(catalogue.products), [catalogue.products]);
  const brandList = useMemo(() => brands(catalogue), [catalogue]);
  const resultCount = useMemo(() => applyFilters(catalogue.products, draft, sort).length, [catalogue.products, draft, sort]);
  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter"
      footer={
        <>
          <Button title="Clear all" variant="secondary" onPress={() => setDraft(EMPTY_FILTERS)} style={{ flex: 1 }} />
          <Button
            title={`Show ${resultCount}`}
            accessibilityLabel={`Show ${resultCount} results`}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Label style={styles.group}>Category</Label>
      <View style={styles.wrap}>
        {visibleCategories(catalogue).map((c) => (
          <Chip key={c.slug} label={c.name} selected={draft.categories.includes(c.slug)} onPress={() => set({ categories: toggleIn(draft.categories, c.slug) })} />
        ))}
      </View>

      {brandList.length > 1 ? (
        <>
          <Label style={styles.group}>Brand</Label>
          <View style={styles.wrap}>
            {brandList.map((b) => (
              <Chip key={b} label={b} selected={draft.brands.includes(b)} onPress={() => set({ brands: toggleIn(draft.brands, b) })} />
            ))}
          </View>
        </>
      ) : null}

      {catalogue.collections.length ? (
        <>
          <Label style={styles.group}>Collection</Label>
          <View style={styles.wrap}>
            {catalogue.collections.map((c) => (
              <Chip key={c.slug} label={c.name} selected={draft.collections.includes(c.slug)} onPress={() => set({ collections: toggleIn(draft.collections, c.slug) })} />
            ))}
          </View>
        </>
      ) : null}

      {bands.length ? (
        <>
          <Label style={styles.group}>Price</Label>
          <View style={styles.wrap}>
            {bands.map((b) => {
              const selected = draft.minPrice === b.min && draft.maxPrice === b.max;
              return (
                <Chip
                  key={b.label}
                  label={b.label}
                  selected={selected}
                  onPress={() => set(selected ? { minPrice: null, maxPrice: null } : { minPrice: b.min, maxPrice: b.max })}
                />
              );
            })}
          </View>
        </>
      ) : null}

      <Label style={styles.group}>Refine</Label>
      <ToggleRow label="Available to order" description="Hides items marked out of stock" value={draft.inStockOnly} onValueChange={(v) => set({ inStockOnly: v })} />
      {catalogue.products.some((p) => p.isNew) ? <ToggleRow label="New in" value={draft.newOnly} onValueChange={(v) => set({ newOnly: v })} /> : null}
      {catalogue.products.some((p) => p.isBestSeller) ? (
        <ToggleRow label="Best sellers" value={draft.bestSellersOnly} onValueChange={(v) => set({ bestSellersOnly: v })} />
      ) : null}
    </BottomSheet>
  );
}

export function SortSheet({ visible, onClose, value, onChange }: { visible: boolean; onClose: () => void; value: SortKey; onChange: (s: SortKey) => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sort by">
      {SORT_OPTIONS.map((o) => (
        <Button
          key={o.key}
          title={o.label}
          variant={o.key === value ? 'primary' : 'ghost'}
          accessibilityState={{ selected: o.key === value }}
          onPress={() => {
            onChange(o.key);
            onClose();
          }}
          style={{ marginBottom: space.xs, alignItems: 'flex-start' }}
        />
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: space.lg, marginBottom: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});

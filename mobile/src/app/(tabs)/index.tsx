import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ProductRail, SkeletonGrid } from '@/components/product-card';
import { Body, Button, Display, H2, Label, SectionHeader, Small } from '@/components/ui';
import { sortedCategories } from '@/lib/catalogue';
import { openWebPage } from '@/lib/web';
import { stores, useCatalogue } from '@/state/catalogue';
import { colors, hairline, minTouch, space } from '@/theme';

import servicesJson from '../../data/services.json';
import siteJson from '../../data/site.json';

export default function HomeScreen() {
  const { catalogue, loading, refreshing, refresh } = useCatalogue();
  const categories = useMemo(() => sortedCategories(catalogue), [catalogue]);
  const newIn = useMemo(() => catalogue.products.filter((p) => p.isNew), [catalogue.products]);
  const bestSellers = useMemo(() => catalogue.products.filter((p) => p.isBestSeller), [catalogue.products]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={refresh} tintColor={colors.charcoal} />}
    >
      {/* Editorial hero — copy from content/site.json (status NEEDS_CNM_APPROVAL). */}
      <View style={styles.hero}>
        <Label style={{ color: colors.charcoal, marginBottom: space.md }}>{siteJson.tagline.value ?? 'CNM Essentials'}</Label>
        <Display>{siteJson.heroHeadline.value}</Display>
        {siteJson.heroLead.value ? <Body style={styles.heroLead}>{siteJson.heroLead.value}</Body> : null}
        <View style={styles.heroCtas}>
          <Button title="Shop all" onPress={() => router.push('/shop')} style={{ flex: 1 }} />
          <Button title="New in" variant="secondary" onPress={() => router.push('/shop/new-in')} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Shop by category" />
        {categories.map((c) => (
          <Pressable
            key={c.slug}
            onPress={() => router.push(`/shop/${c.slug}`)}
            accessibilityRole="link"
            accessibilityLabel={c.name}
            style={({ pressed }) => [styles.catRow, pressed && { backgroundColor: colors.offWhite }]}
          >
            <H2 style={{ flex: 1, fontSize: 24 }}>{c.name}</H2>
            <Feather name="arrow-right" size={18} color={colors.ink} />
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionFlush}>
        <View style={styles.pad}>
          <SectionHeader title="New in" action="View all" onAction={() => router.push('/shop/new-in')} />
        </View>
        {loading ? <SkeletonGrid count={2} /> : <ProductRail products={newIn} list="home_new_in" />}
      </View>

      {bestSellers.length ? (
        <View style={styles.sectionFlush}>
          <View style={styles.pad}>
            <SectionHeader title="Best sellers" action="View all" onAction={() => router.push('/shop/best-sellers')} />
          </View>
          <ProductRail products={bestSellers} list="home_best_sellers" />
        </View>
      ) : null}

      {/* Fragrance as a Service teaser — copy from content/services.json. */}
      <View style={styles.faas}>
        <Label style={{ color: colors.offWhite, marginBottom: space.md }}>Fragrance as a Service</Label>
        <Display style={{ color: colors.white, fontSize: 38, lineHeight: 42 }}>{servicesJson.headline.value}</Display>
        {servicesJson.lead.value ? <Body style={{ color: colors.offWhite, marginTop: space.md }}>{servicesJson.lead.value}</Body> : null}
        <Button
          title="Enquire"
          variant="secondary"
          onPress={() => openWebPage('/fragrance-as-a-service/')}
          style={{ marginTop: space.lg, alignSelf: 'flex-start', borderColor: colors.white }}
          accessibilityHint="Opens the enquiry page on the CNM website"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Visit us" action="All stores" onAction={() => openWebPage('/stores/')} />
        {stores.map((s) => (
          <Pressable
            key={s.slug}
            onPress={() => openWebPage(`/stores/${s.slug}/`)}
            accessibilityRole="link"
            accessibilityLabel={`${s.name}. Store details`}
            style={({ pressed }) => [styles.storeRow, pressed && { backgroundColor: colors.offWhite }]}
          >
            <View style={{ flex: 1 }}>
              <H2 style={{ fontSize: 24 }}>{s.city}</H2>
              <Small>{s.address ?? 'Address awaiting CNM confirmation'}</Small>
            </View>
            <Feather name="arrow-up-right" size={18} color={colors.ink} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white },
  hero: { backgroundColor: colors.offWhite, paddingHorizontal: space.md, paddingTop: space.xxl, paddingBottom: space.xl },
  heroLead: { marginTop: space.md, color: colors.inkSoft, fontSize: 17, lineHeight: 25 },
  heroCtas: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  section: { paddingHorizontal: space.md, paddingTop: space.xxl },
  sectionFlush: { paddingTop: space.xxl },
  pad: { paddingHorizontal: space.md },
  catRow: {
    minHeight: minTouch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: hairline,
    borderColor: colors.hairline,
  },
  faas: { backgroundColor: colors.charcoal, marginTop: space.xxl, paddingHorizontal: space.md, paddingVertical: space.xxl },
  storeRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: hairline,
    borderColor: colors.hairline,
    paddingVertical: space.sm,
  },
});

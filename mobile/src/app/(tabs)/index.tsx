import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/logo';
import { ProductRail, SkeletonGrid } from '@/components/product-card';
import { Body, Button, Display, ErrorNote, Field, H2, Label, SectionHeader, Small } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { absoluteUrl, brands, categoryProductCount, visibleCategories } from '@/lib/catalogue';
import { API_BASE_URL } from '@/lib/config';
import { openWebPage } from '@/lib/web';
import { stores, useCatalogue } from '@/state/catalogue';
import { colors, fonts, hairline, minTouch, space } from '@/theme';

import servicesJson from '../../data/services.json';
import siteJson from '../../data/site.json';

// All copy below comes from content/*.json (CNM's live site / cnm-group.net); nothing is invented here.
const site = siteJson;
const programme = servicesJson.programme?.value;
const PROMISE_ICONS: Record<string, ComponentProps<typeof Feather>['name']> = {
  truck: 'truck',
  lock: 'lock',
  sparkle: 'star',
  headset: 'headphones',
};

const bySourceOrder = <T extends { sourceOrder?: number }>(a: T, b: T) => (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0);

function Newsletter() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const nl = site.newsletter?.value;
  if (!nl) return null;

  const submit = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email address.');
    setError(null);
    setState('sending');
    try {
      await api('/api/newsletter', { method: 'POST', body: { email: email.trim(), consent: true, source: 'app_home' } });
      setState('done');
    } catch (e) {
      setError(errorMessage(e));
      setState('idle');
    }
  };

  return (
    <View style={styles.section}>
      <Label style={{ color: colors.muted }}>Community</Label>
      <H2 style={{ marginTop: space.xs, fontSize: 30, lineHeight: 34 }}>{nl.title}</H2>
      <Body style={{ color: colors.inkSoft, marginTop: space.sm, marginBottom: space.md }}>{nl.text}</Body>
      {state === 'done' ? (
        <Body accessibilityLiveRegion="polite">Thank you — you’re on the list.</Body>
      ) : (
        <>
          <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={submit} placeholder="Enter your email" />
          {error ? <ErrorNote message={error} /> : null}
          <Button title="Subscribe" onPress={submit} loading={state === 'sending'} />
          <Small style={{ marginTop: space.xs, color: colors.muted }}>By subscribing you agree to receive emails from CNM Essentials. Unsubscribe any time.</Small>
        </>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { catalogue, loading, refreshing, refresh } = useCatalogue();
  const categories = useMemo(() => visibleCategories(catalogue), [catalogue]);
  const room = useMemo(() => catalogue.products.filter((p) => p.category === 'room-home-fragrance').sort(bySourceOrder), [catalogue.products]);
  const diffusers = useMemo(() => catalogue.products.filter((p) => p.category === 'diffusers-refills').sort(bySourceOrder), [catalogue.products]);
  const brandList = useMemo(() => brands(catalogue), [catalogue]);
  const [first, second] = site.heroHeadline.value.split(/(?<=\.)\s+/);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={refresh} tintColor={colors.charcoal} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Logo variant="full" height={170} style={{ alignSelf: 'center', marginBottom: space.xl }} />
        <Label style={{ color: colors.yellow, marginBottom: space.md }}>{site.tagline.value}</Label>
        <Display style={{ color: colors.white }}>
          {first}
          {second ? <Text style={{ fontFamily: fonts.serifItalic }}>{'\n' + second}</Text> : null}
        </Display>
        {site.heroLead.value ? <Body style={styles.heroLead}>{site.heroLead.value}</Body> : null}
        <View style={styles.heroCtas}>
          <Button title="Shop now" variant="accent" onPress={() => router.push('/shop')} style={{ flex: 1 }} />
          <Button
            title="Visit a store"
            variant="outlineLight"
            onPress={() => openWebPage('/stores/')}
            style={{ flex: 1 }}
            accessibilityHint="Opens store details on the CNM website"
          />
        </View>
        {site.motto?.value ? <Small style={styles.motto}>{site.motto.value}</Small> : null}
      </View>

      {/* Shop by category — campaign banners served by the website */}
      <View style={styles.section}>
        <SectionHeader title="Shop by category" action="Shop all" onAction={() => router.push('/shop')} />
        {categories.map((c) => {
          const empty = categoryProductCount(catalogue, c.slug) === 0;
          return (
            <Pressable
              key={c.slug}
              onPress={() => router.push(`/shop/${c.slug}`)}
              accessibilityRole="link"
              accessibilityLabel={empty ? `${c.name}, coming soon online` : `Shop ${c.name}`}
              style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}
            >
              {c.banner ? (
                <Image source={{ uri: absoluteUrl(API_BASE_URL, c.banner) }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : null}
              <View style={styles.bannerShade} />
              <View style={styles.bannerCap}>
                <H2 style={{ color: colors.white, flex: 1 }}>{c.name}</H2>
                {empty ? <Label style={{ color: colors.yellow }}>Coming soon</Label> : <Feather name="arrow-right" size={20} color={colors.white} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Room sprays & odour eliminators */}
      <View style={styles.sectionFlush}>
        <View style={styles.pad}>
          <Label style={{ color: colors.muted, marginBottom: space.xs }}>Room & home fragrance</Label>
          <SectionHeader title="Room sprays & odour eliminators" action="Shop" onAction={() => router.push('/shop/room-home-fragrance')} />
        </View>
        {loading ? <SkeletonGrid count={2} /> : <ProductRail products={room} list="home_room" />}
      </View>

      {diffusers.length ? (
        <View style={styles.sectionFlush}>
          <View style={styles.pad}>
            <Label style={{ color: colors.muted, marginBottom: space.xs }}>Diffusers & refills</Label>
            <SectionHeader title="Wallflowers & refills" action="Shop" onAction={() => router.push('/shop/diffusers-refills')} />
          </View>
          <ProductRail products={diffusers} list="home_diffusers" />
        </View>
      ) : null}

      {brandList.length ? (
        <View style={styles.section}>
          <Label style={{ color: colors.muted, marginBottom: space.xs }}>Curated brands</Label>
          <H2 style={{ marginBottom: space.md }}>Shop by brand</H2>
          {brandList.map((b) => (
            <Pressable
              key={b}
              onPress={() => router.push({ pathname: '/shop', params: { brand: b } })}
              accessibilityRole="link"
              accessibilityLabel={`Shop ${b}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.offWhite }]}
            >
              <Text style={styles.brand}>{b}</Text>
              <Feather name="arrow-right" size={18} color={colors.ink} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Lease-to-Own Programme (For business) */}
      {programme ? (
        <View style={styles.dark}>
          <Label style={{ color: colors.yellow, marginBottom: space.md }}>For business</Label>
          <Display style={{ color: colors.white, fontSize: 38, lineHeight: 42 }}>{programme.name}</Display>
          <Body style={{ color: colors.sage, marginTop: space.md }}>{programme.text}, in Lagos and Abuja.</Body>
          {site.keyProducts?.value?.length ? (
            <View style={{ marginTop: space.lg }}>
              <Label style={{ color: colors.sage, marginBottom: space.xs }}>Key products</Label>
              {site.keyProducts.value.map((k) => (
                <View key={k} style={styles.checkRow}>
                  <Feather name="check" size={16} color={colors.yellow} />
                  <Body style={{ color: colors.white, marginLeft: space.sm, flex: 1 }}>{k}</Body>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.heroCtas}>
            <Button title="Enquire" variant="accent" onPress={() => openWebPage('/fragrance-as-a-service/#enquire')} style={{ flex: 1 }} />
            <Button title="How it works" variant="outlineLight" onPress={() => openWebPage('/fragrance-as-a-service/')} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      {/* Promises */}
      {site.promises?.value?.length ? (
        <View style={styles.promises} accessibilityLabel="Our promise">
          {site.promises.value.map(([icon, title, text]) => (
            <View key={title} style={styles.promise} accessible accessibilityLabel={`${title}. ${text}`}>
              <Feather name={PROMISE_ICONS[icon] ?? 'check'} size={20} color={colors.charcoal} />
              <Text style={styles.promiseTitle}>{title}</Text>
              <Small>{text}</Small>
            </View>
          ))}
        </View>
      ) : null}

      {/* Stores */}
      <View style={styles.section}>
        <Label style={{ color: colors.muted, marginBottom: space.xs }}>Visit us</Label>
        <SectionHeader title="Lagos & Abuja" action="All stores" onAction={() => openWebPage('/stores/')} />
        {stores.map((s) => (
          <Pressable
            key={s.slug}
            onPress={() => openWebPage(`/stores/${s.slug}/`)}
            accessibilityRole="link"
            accessibilityLabel={`${s.name}. ${s.address ?? ''}. Store details`}
            style={({ pressed }) => [styles.storeCard, pressed && { opacity: 0.9 }]}
          >
            <Label style={{ color: colors.yellow }}>CNM Essentials</Label>
            <H2 style={{ color: colors.white, fontSize: 30, lineHeight: 34, marginTop: space.xs }}>{s.city}</H2>
            <Body style={{ color: colors.sage, marginTop: space.xs }}>{s.address ?? 'Address awaiting CNM confirmation'}</Body>
            {s.phone ? <Small style={{ color: colors.sage, marginTop: space.xxs }}>{s.phone}</Small> : null}
            <Label style={{ color: colors.white, marginTop: space.md, textDecorationLine: 'underline' }}>Store details</Label>
          </Pressable>
        ))}
        {site.contact?.email?.value || site.contact?.phone?.value ? (
          <Small style={{ marginTop: space.sm }}>{[site.contact.phone.value, site.contact.email.value].filter(Boolean).join(' · ')}</Small>
        ) : null}
      </View>

      <Newsletter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white },
  hero: { backgroundColor: colors.charcoal, paddingHorizontal: space.md, paddingTop: space.xl, paddingBottom: space.xxl },
  heroLead: { marginTop: space.md, color: colors.sage, fontSize: 17, lineHeight: 25 },
  heroCtas: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  motto: { color: colors.sage, marginTop: space.lg, fontStyle: 'italic' },
  section: { paddingHorizontal: space.md, paddingTop: space.xxl },
  sectionFlush: { paddingTop: space.xxl },
  pad: { paddingHorizontal: space.md },
  banner: { height: 200, backgroundColor: colors.charcoalSoft, marginBottom: space.sm, overflow: 'hidden', borderRadius: 2, justifyContent: 'flex-end' },
  bannerShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(35,34,30,0.28)' },
  bannerCap: { flexDirection: 'row', alignItems: 'center', padding: space.md, minHeight: minTouch },
  row: { minHeight: minTouch + 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: hairline, borderColor: colors.hairline },
  brand: { flex: 1, fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  dark: { backgroundColor: colors.charcoal, marginTop: space.xxl, paddingHorizontal: space.md, paddingVertical: space.xxl },
  checkRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderColor: 'rgba(255,255,255,0.14)', paddingVertical: space.sm },
  promises: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.offWhite, paddingHorizontal: space.sm, paddingVertical: space.lg },
  promise: { width: '50%', padding: space.sm, gap: 4 },
  promiseTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink, marginTop: space.xs },
  storeCard: { backgroundColor: colors.charcoal, padding: space.lg, marginBottom: space.sm, borderRadius: 2 },
});

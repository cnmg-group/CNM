import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Divider, ErrorNote, H2, Small, ToggleRow } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { api, errorMessage } from '@/lib/api';
import { enablePushNotifications } from '@/lib/notifications';
import type { Channel, PreferenceTopic, Preferences } from '@/lib/types';
import { colors, space } from '@/theme';

const TOPICS: { key: PreferenceTopic; label: string; description: string }[] = [
  { key: 'orders', label: 'Order updates', description: 'Confirmation, dispatch and delivery' },
  { key: 'newArrivals', label: 'New arrivals', description: 'New scents and products' },
  { key: 'backInStock', label: 'Back in stock', description: 'When items you asked about return' },
  { key: 'wishlist', label: 'Wishlist', description: 'Price and stock changes on saved items' },
  { key: 'events', label: 'Events', description: 'In-store events in Lagos and Abuja' },
  { key: 'promotions', label: 'Offers', description: 'Occasional promotions' },
];

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'push', label: 'Push notifications' },
];

/** Defaults per API: order updates on, marketing off. Used if the server omits a key. */
function withDefaults(p: Partial<Preferences> | null | undefined): Preferences {
  const base = (on: boolean) => ({ orders: on, newArrivals: false, backInStock: false, wishlist: false, events: false, promotions: false });
  return {
    email: { ...base(true), ...(p?.email ?? {}) },
    sms: { ...base(true), ...(p?.sms ?? {}) },
    // Push starts off until the user opts in on this device.
    push: { ...base(false), ...(p?.push ?? {}) },
  };
}

function PreferencesForm() {
  const { data, setData, loading, error, reload } = useResource<Preferences & { preferences?: Preferences }>('/api/account/preferences');
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setPrefs(withDefaults(data.preferences ?? data));
  }, [data]);

  const update = async (channel: Channel, topic: PreferenceTopic, value: boolean) => {
    if (!prefs) return;
    // Ask for OS permission only at the moment the user opts in to push.
    if (channel === 'push' && value && !Object.values(prefs.push).some(Boolean)) {
      setBusy(true);
      const reg = await enablePushNotifications();
      setBusy(false);
      if (!reg.ok) {
        setPushNote(reg.message);
        return;
      }
      setPushNote(null);
    }
    const prev = prefs;
    const next: Preferences = { ...prefs, [channel]: { ...prefs[channel], [topic]: value } };
    setPrefs(next);
    setSaveError(null);
    try {
      await api('/api/account/preferences', { method: 'PUT', body: next });
      setData(next);
    } catch (e) {
      setPrefs(prev);
      setSaveError(errorMessage(e));
    }
  };

  if (!prefs) {
    return (
      <Screen>
        <PendingBlock pending={loading} label="Loading preferences" />
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Small style={{ color: colors.inkSoft }}>Choose what we contact you about, and how. We never send marketing unless you switch it on.</Small>
      {saveError ? <ErrorNote message={saveError} /> : null}
      {CHANNELS.map((c) => (
        <View key={c.key} style={{ marginTop: space.xl }}>
          <H2>{c.label}</H2>
          {c.key === 'push' && pushNote ? <ErrorNote message={pushNote} /> : null}
          <Divider style={{ marginTop: space.sm }} />
          {TOPICS.map((t) => (
            <ToggleRow key={t.key} label={t.label} description={t.description} value={prefs[c.key][t.key]} disabled={busy} onValueChange={(v) => update(c.key, t.key, v)} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

export default function PreferencesScreen() {
  return (
    <AuthGate>
      <PreferencesForm />
    </AuthGate>
  );
}

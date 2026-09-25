import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AuthGate } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Button, ErrorNote, Field, ToggleRow } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Address } from '@/lib/types';
import { space } from '@/theme';

const BLANK: Address = { id: '', label: '', firstName: '', lastName: '', phone: '', line1: '', line2: '', city: '', state: '', country: 'NG', isDefault: false };

function newId() {
  return `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function AddressForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [all, setAll] = useState<Address[] | null>(null);
  const [form, setForm] = useState<Address>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ addresses: Address[] }>('/api/account/addresses')
      .then((res) => {
        const list = res.addresses ?? [];
        setAll(list);
        const existing = id ? list.find((a) => a.id === id) : undefined;
        setForm(existing ?? { ...BLANK, isDefault: list.length === 0 });
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  const set = (k: keyof Address) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const e: Record<string, string> = {};
    (['firstName', 'lastName', 'line1', 'city', 'state'] as const).forEach((k) => {
      if (!String(form[k] ?? '').trim()) e[k] = 'Required';
    });
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number.';
    setErrors(e);
    if (Object.keys(e).length || !all) return;
    const entry = { ...form, id: form.id || newId() };
    let next = form.id ? all.map((a) => (a.id === form.id ? entry : a)) : [...all, entry];
    if (entry.isDefault) next = next.map((a) => ({ ...a, isDefault: a.id === entry.id }));
    setBusy(true);
    setError(null);
    try {
      await api('/api/account/addresses', { method: 'PUT', body: { addresses: next } });
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!all && !error) return <PendingBlock pending label="Loading address" />;

  return (
    <Screen>
      <Field label="Label (e.g. Home, Office)" value={form.label} onChangeText={set('label')} />
      <Field label="First name" value={form.firstName} onChangeText={set('firstName')} error={errors.firstName} autoComplete="given-name" />
      <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} error={errors.lastName} autoComplete="family-name" />
      <Field label="Phone" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Address line 1" value={form.line1} onChangeText={set('line1')} error={errors.line1} autoComplete="street-address" />
      <Field label="Address line 2 (optional)" value={form.line2 ?? ''} onChangeText={set('line2')} />
      <Field label="City" value={form.city} onChangeText={set('city')} error={errors.city} />
      <Field label="State" value={form.state} onChangeText={set('state')} error={errors.state} hint="e.g. Lagos, FCT" />
      <ToggleRow label="Default address" value={form.isDefault} onValueChange={set('isDefault')} />
      {error ? <ErrorNote message={error} /> : null}
      <Button title="Save address" onPress={save} loading={busy} disabled={!all} style={{ marginTop: space.md }} />
    </Screen>
  );
}

export default function AddressEditScreen() {
  return (
    <AuthGate>
      <AddressForm />
    </AuthGate>
  );
}

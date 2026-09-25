import { router } from 'expo-router';

import { useBag } from '@/state/bag';

import { IconButton } from './ui';

export function BagButton() {
  const { count } = useBag();
  return <IconButton icon="shopping-bag" label="Bag" badge={count} onPress={() => router.push('/bag')} style={{ marginRight: 4 }} />;
}

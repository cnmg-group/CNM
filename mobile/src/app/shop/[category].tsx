import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link target for cnmessentials.com/shop/:category → the Shop tab, pre-filtered. */
export default function ShopCategoryLink() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return <Redirect href={{ pathname: '/shop', params: { category } }} />;
}

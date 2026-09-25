import { Redirect, useLocalSearchParams } from 'expo-router';

/** cnmessentials.com/collections/:collection → the Shop tab filtered to that collection. */
export default function CollectionLink() {
  const { collection } = useLocalSearchParams<{ collection: string }>();
  return <Redirect href={{ pathname: '/shop', params: { collection } }} />;
}

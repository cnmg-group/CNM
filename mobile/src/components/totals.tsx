import { View } from 'react-native';

import { estimateTotals } from '@/lib/cart';
import { formatNaira } from '@/lib/format';
import type { BagLine, DeliveryMethod, Quote } from '@/lib/types';
import { useCatalogue } from '@/state/catalogue';
import { colors, space } from '@/theme';

import { ButterflyLoader } from './butterfly-loader';
import { Divider, Row, Small } from './ui';

/** Order summary. Uses the server quote; falls back to a clearly-labelled estimate. */
export function Totals({
  quote,
  loading,
  lines,
  delivery,
  deliveryChosen,
}: {
  quote: Quote | null;
  loading: boolean;
  lines: BagLine[];
  delivery?: DeliveryMethod | null;
  deliveryChosen: boolean;
}) {
  const { catalogue, commerce } = useCatalogue();
  const t = quote ?? estimateTotals(lines, catalogue, commerce, delivery);
  const estimated = !quote;
  const includesVat = commerce.pricesIncludeVat.value;
  return (
    <View accessibilityLabel="Order summary">
      <Row label="Subtotal" value={formatNaira(t.subtotal)} />
      {t.discount > 0 ? <Row label="Discount" value={`−${formatNaira(t.discount)}`} /> : null}
      <Row label="Delivery" value={deliveryChosen ? (t.delivery ? formatNaira(t.delivery) : 'Free') : 'Calculated at checkout'} />
      <Row label={includesVat ? `VAT (included)` : 'VAT'} value={formatNaira(t.vat)} />
      <Divider style={{ marginVertical: space.xs }} />
      <Row label={estimated ? 'Estimated total' : 'Total'} value={formatNaira(t.total)} strong />
      <ButterflyLoader pending={loading} label="Updating totals" size={24} style={{ marginTop: space.xs }} />
      {estimated && !loading ? <Small style={{ color: colors.muted }}>Estimate — final totals are confirmed by CNM at checkout.</Small> : null}
      <Small style={{ color: colors.muted, marginTop: space.xxs }}>Prices shown are staging demo values awaiting CNM approval.</Small>
    </View>
  );
}

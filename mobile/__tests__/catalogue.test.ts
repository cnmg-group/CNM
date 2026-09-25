import { absoluteUrl, bundledCatalogue, findProduct, isCatalogue, mergeLive, productImages, productSubtitle, relatedProducts, stockState } from '@/lib/catalogue';
import { routeForUrl } from '@/lib/deeplinks';
import { formatNaira, roundKobo } from '@/lib/format';
import { interpretPaymentResponse, referenceFromUrl } from '@/lib/payments';
import { mergeWishlists, wishlistReducer } from '@/lib/wishlist';

import { real } from './fixtures';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `cnm://${p}` }));

describe('catalogue', () => {
  it('bundled data is a valid catalogue', () => {
    expect(isCatalogue(bundledCatalogue)).toBe(true);
    expect(isCatalogue({ products: 'x' })).toBe(false);
    expect(bundledCatalogue.products).toHaveLength(20);
  });

  it('merges live overrides without mutating', () => {
    const merged = mergeLive(bundledCatalogue, { products: { 'midnight-vanilla-room-spray': { price: 18999.5, stock: 0, available: false } } });
    const p = findProduct(merged, 'midnight-vanilla-room-spray')!;
    expect(p.price.amount).toBe(18999.5);
    expect(stockState(p)).toBe('out_of_stock');
    expect(findProduct(bundledCatalogue, 'midnight-vanilla-room-spray')!.price.amount).toBe(17850);
  });

  it('live stock can set a known quantity on an unconfirmed product', () => {
    const merged = mergeLive(bundledCatalogue, { products: { 'crushed-room-spray': { stock: 4 } } });
    expect(stockState(findProduct(merged, 'crushed-room-spray')!)).toBe('low_stock');
  });

  it('stock states', () => {
    expect(stockState(real('midnight-vanilla-room-spray'))).toBe('unconfirmed');
    const base = real('petalrich-room-spray');
    expect(stockState({ ...base, stock: { quantity: 40 } })).toBe('in_stock');
    expect(stockState({ ...base, stock: { quantity: 2 } })).toBe('low_stock');
    expect(stockState({ ...base, stock: { quantity: 0 } })).toBe('out_of_stock');
    expect(stockState({ ...base, available: false })).toBe('out_of_stock');
  });

  it('uses real images and drops placeholders', () => {
    expect(productImages(real('midnight-vanilla-room-spray'))[0].src).toBe('/assets/products/midnight-vanilla-room-spray.webp');
    const p = { ...real('crushed-room-spray'), images: [{ src: '/a.jpg', alt: 'a', placeholder: true }, '/b.jpg'] };
    expect(productImages(p)).toEqual([{ src: '/b.jpg', alt: 'Crushed' }]);
    expect(absoluteUrl('https://x.netlify.app/', '/assets/p.png')).toBe('https://x.netlify.app/assets/p.png');
    expect(absoluteUrl('https://x.app', 'https://cdn.example/p.png')).toBe('https://cdn.example/p.png');
  });

  it('subtitle combines brand and product type', () => {
    expect(productSubtitle(real('midnight-vanilla-room-spray'))).toBe("Victoria's Secret · Room Spray");
  });

  it('related resolves to real products only', () => {
    const rel = relatedProducts(bundledCatalogue, real('white-jasmine-odour-eliminator')).map((x) => x.id);
    expect(rel).toEqual(['sugarplum-delight-odour-eliminator', 'sun-kissed-vanilla-odour-eliminator']);
    expect(relatedProducts(bundledCatalogue, { ...real('crushed-room-spray'), related: ['ghost'] })).toEqual([]);
  });

  it('never invents product copy: unsupplied facts stay null and prices are not demo', () => {
    for (const p of bundledCatalogue.products) {
      expect(p.ingredients).toBeNull();
      expect(p.price.demo).toBe(false);
    }
  });
});

describe('deep links', () => {
  it.each([
    ['https://cnmessentials.com/products/sweet-pea-wallflower-plug-in-refill/', '/products/sweet-pea-wallflower-plug-in-refill'],
    ['https://www.cnmessentials.com/shop/room-home-fragrance/', '/shop/room-home-fragrance'],
    ['cnm://account/orders/CNM-1001', '/account/orders/CNM-1001'],
    ['/products/midnight-vanilla-room-spray?utm_source=push', '/products/midnight-vanilla-room-spray'],
    ['https://evil.example.com/products/x', null],
    ['https://cnmessentials.com/unknown/page', null],
  ])('%s → %s', (url, route) => {
    expect(routeForUrl(url)).toBe(route);
  });
});

describe('payments', () => {
  it('interprets verify responses', () => {
    expect(interpretPaymentResponse({ order: { status: 'paid' } }).paid).toBe(true);
    expect(interpretPaymentResponse({ paid: true }).paid).toBe(true);
    expect(interpretPaymentResponse({ status: 'payment_failed' }).paid).toBe(false);
    expect(interpretPaymentResponse(null).paid).toBe(false);
  });

  it('extracts the Paystack reference from the return URL', () => {
    expect(referenceFromUrl('cnm://checkout/return?trxref=abc&reference=abc')).toBe('abc');
    expect(referenceFromUrl('cnm://checkout/return')).toBeNull();
  });
});

describe('wishlist', () => {
  it('toggles and merges without duplicates', () => {
    let s = wishlistReducer([], { type: 'toggle', id: 'a' });
    s = wishlistReducer(s, { type: 'add', id: 'b' });
    s = wishlistReducer(s, { type: 'toggle', id: 'a' });
    expect(s).toEqual(['b']);
    expect(mergeWishlists(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('format', () => {
  it('formats Naira with up to 2 decimals', () => {
    expect(formatNaira(17850)).toBe('₦17,850');
    expect(formatNaira(14888.75)).toBe('₦14,888.75');
    expect(formatNaira(14888.8)).toBe('₦14,888.80');
    expect(formatNaira(31121.25)).toBe('₦31,121.25');
    expect(formatNaira(1234567.5)).toBe('₦1,234,567.50');
    expect(formatNaira(-2500.5)).toBe('-₦2,500.50');
    expect(formatNaira(0)).toBe('₦0');
    expect(formatNaira(null)).toBe('—');
  });

  it('roundKobo avoids float drift', () => {
    expect(roundKobo(0.1 + 0.2)).toBe(0.3);
    expect(roundKobo(14888.8 * 3)).toBe(44666.4);
  });
});

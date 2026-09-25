import { bundledCatalogue, findProduct, isCatalogue, mergeLive, productImages, relatedProducts, stockState } from '@/lib/catalogue';
import { routeForUrl } from '@/lib/deeplinks';
import { formatNaira } from '@/lib/format';
import { interpretPaymentResponse, referenceFromUrl } from '@/lib/payments';
import { mergeWishlists, wishlistReducer } from '@/lib/wishlist';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `cnm://${p}` }));

describe('catalogue', () => {
  it('bundled data is a valid catalogue', () => {
    expect(isCatalogue(bundledCatalogue)).toBe(true);
    expect(isCatalogue({ products: 'x' })).toBe(false);
  });

  it('merges live overrides without mutating', () => {
    const merged = mergeLive(bundledCatalogue, { products: { 'body-wash': { price: 9999, stock: 0, available: false } } });
    const p = findProduct(merged, 'body-wash')!;
    expect(p.price.amount).toBe(9999);
    expect(p.price.demo).toBe(true);
    expect(stockState(p)).toBe('out_of_stock');
    expect(findProduct(bundledCatalogue, 'body-wash')!.price.amount).toBe(14500);
  });

  it('stock states', () => {
    expect(stockState(findProduct(bundledCatalogue, 'refill-oil')!)).toBe('in_stock');
    expect(stockState(findProduct(bundledCatalogue, 'home-fragrance')!)).toBe('low_stock');
    expect(stockState(findProduct(bundledCatalogue, 'car-diffuser')!)).toBe('out_of_stock');
  });

  it('drops placeholder images', () => {
    const p = { ...findProduct(bundledCatalogue, 'body-wash')!, images: [{ src: '/a.jpg', alt: 'a', placeholder: true }, '/b.jpg'] };
    expect(productImages(p)).toEqual([{ src: '/b.jpg', alt: 'Body Wash' }]);
  });

  it('related only resolves real products', () => {
    const p = findProduct(bundledCatalogue, 'stoneglow-reed-diffuser')!;
    expect(relatedProducts(bundledCatalogue, p).map((x) => x.id)).toEqual(['home-fragrance', 'signature-diffuser-oil']);
  });

  it('never invents product copy: bundled facts stay null', () => {
    for (const p of bundledCatalogue.products) {
      expect(p.description).toBeNull();
      expect(p.ingredients).toBeNull();
    }
  });
});

describe('deep links', () => {
  it.each([
    ['https://cnmessentials.com/products/body-wash/', '/products/body-wash'],
    ['https://www.cnmessentials.com/shop/body-care', '/shop/body-care'],
    ['cnm://account/orders/CNM-1001', '/account/orders/CNM-1001'],
    ['/products/refill-oil?utm_source=push', '/products/refill-oil'],
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
  it('formats Naira', () => {
    expect(formatNaira(185000)).toBe('₦185,000');
    expect(formatNaira(0)).toBe('₦0');
    expect(formatNaira(null)).toBe('—');
  });
});

/** Data model mirrored from ../content/*.json and docs/API.md. */

export type ContentStatus = 'NEEDS_CNM_APPROVAL' | 'PROVIDED_BY_CNM_PROTOTYPE' | 'PROVIDED_BY_CNM_BRIEF' | 'BLOCKED' | string;

export interface ProductImage {
  src: string;
  alt: string;
  placeholder?: boolean;
}

export interface Faq {
  q: string;
  a: string | null;
}

export interface Price {
  amount: number;
  compareAt: number | null;
  status?: ContentStatus;
  demo?: boolean;
}

export interface Stock {
  quantity: number;
  status?: ContentStatus;
  demo?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  collections: string[];
  productType: string | null;
  description: string | null;
  scentFamily: string | null;
  scentNotes: string | string[] | { top?: string[]; heart?: string[]; base?: string[] } | null;
  ingredients: string | string[] | null;
  howToUse: string | null;
  size: string | null;
  care: string | null;
  faqs: Faq[];
  variants: unknown[];
  price: Price;
  stock: Stock;
  /** Live availability flag from /api/catalogue/live (defaults to true). */
  available?: boolean;
  images: (ProductImage | string)[];
  badges: string[];
  isNew: boolean;
  isBestSeller: boolean;
  related: string[];
  url?: string;
  contentStatus?: ContentStatus;
}

export interface Category {
  slug: string;
  name: string;
  intro: string | null;
  introStatus?: ContentStatus;
  order?: number;
}

export interface Collection {
  slug: string;
  name: string;
  intro: string | null;
  introStatus?: ContentStatus;
}

export interface DeliveryMethod {
  id: string;
  label: string;
  eta?: string | null;
  fee: number;
  freeOver?: number | null;
  regions?: string[];
}

export interface Commerce {
  currency: string;
  pricesIncludeVat: { value: boolean };
  vatRate: { value: number };
  deliveryMethods: DeliveryMethod[];
  maxQtyPerLine: number;
  returns: { value: string | null };
}

export interface Store {
  slug: string;
  city: string;
  name: string;
  region: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  services: string[];
  verified: boolean;
}

export interface Catalogue {
  generatedAt?: string;
  currency: string;
  products: Product[];
  categories: Category[];
  collections: Collection[];
}

export interface LiveOverride {
  price?: number | null;
  compareAt?: number | null;
  stock?: number | null;
  available?: boolean | null;
}

export interface LiveCatalogue {
  products: Record<string, LiveOverride>;
}

export interface BagLine {
  id: string;
  qty: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt?: string;
}

export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export type Channel = 'email' | 'sms' | 'push';
export type PreferenceTopic = 'orders' | 'newArrivals' | 'backInStock' | 'wishlist' | 'events' | 'promotions';
export type Preferences = Record<Channel, Record<PreferenceTopic, boolean>>;

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'payment_failed'
  | 'cancelled'
  | 'refunded';

export interface OrderLine {
  id: string;
  name?: string;
  qty: number;
  unitPrice?: number;
  lineTotal?: number;
}

export interface OrderSummary {
  number: string;
  status: OrderStatus | string;
  total: number;
  createdAt?: string;
  itemCount?: number;
}

export interface Order extends OrderSummary {
  items?: OrderLine[];
  lines?: OrderLine[];
  subtotal?: number;
  discount?: number;
  delivery?: number | { method?: string; address?: Partial<Address>; storeSlug?: string; fee?: number };
  vat?: number;
  contact?: { email?: string; phone?: string; firstName?: string; lastName?: string };
  history?: { status: string; at: string; note?: string }[];
}

export interface Quote {
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  delivery: number;
  vat: number;
  total: number;
  currency: string;
  promo: { code: string | null; valid: boolean; message?: string | null } | null;
  deliveryMethods: DeliveryMethod[];
}

export interface CheckoutResponse {
  order: { number: string; accessToken: string; total: number; status: OrderStatus | string };
  payment: { mode: 'paystack' | 'simulated'; authorizationUrl?: string; reference: string };
}

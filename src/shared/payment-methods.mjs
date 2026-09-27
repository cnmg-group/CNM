// Payment methods shoppers can pick at checkout, mapped to Paystack channels. Shared by the checkout template and API.
export const PAYMENT_METHODS = [
  { id: 'card', label: 'Card', detail: 'Visa, Mastercard or Verve', channels: ['card'] },
  { id: 'bank_transfer', label: 'Bank transfer', detail: 'Pay from your banking app to a one-time account number', channels: ['bank_transfer'] },
  { id: 'ussd', label: 'USSD', detail: 'Dial a short code from any phone, no data needed', channels: ['ussd'] },
];

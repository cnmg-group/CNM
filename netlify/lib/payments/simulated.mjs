// Staging simulator: same interface as Paystack, no money moves. Disabled once a real provider is configured.
export const name = 'simulated';
export const enabled = () => true;
export async function initialize(order) { return { mode: 'simulated', reference: order.payment.reference }; }
export async function verify() { return { status: 'pending' }; }
export function parseWebhook() { return null; }
export async function refund() { return { status: 'processed', id: `sim-${Date.now()}` }; }

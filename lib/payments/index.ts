import { StripeProvider } from './stripe';
import { PaymentProvider } from './provider';

// Export a single, app-wide instance of the provider.
// If we ever swap Stripe for LemonSqueezy, we ONLY change this one export.
export const paymentProvider: PaymentProvider = new StripeProvider();

export * from './provider';

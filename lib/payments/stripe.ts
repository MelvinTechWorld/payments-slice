import Stripe from 'stripe';
import { PaymentProvider, ProviderEvent } from './provider';

// Initialize the Stripe SDK with our backend secret key.
// By doing this here, we ensure no other part of the app accidentally imports 
// the raw SDK, enforcing the abstraction boundary.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-08-26.dahlia' as any, // Pinning to the required version
});

export class StripeProvider implements PaymentProvider {
  /**
   * Maps internal plan IDs to Stripe Price IDs configured in the environment.
   * This keeps Stripe-specific IDs out of the application database and domain logic.
   */
  private getPriceId(planId: string): string {
    if (planId === 'monthly') {
      const id = process.env.STRIPE_PRICE_MONTHLY;
      if (!id) throw new Error('STRIPE_PRICE_MONTHLY is not set');
      return id;
    }
    if (planId === 'yearly') {
      const id = process.env.STRIPE_PRICE_YEARLY;
      if (!id) throw new Error('STRIPE_PRICE_YEARLY is not set');
      return id;
    }
    throw new Error(`Unknown plan ID: ${planId}`);
  }

  /**
   * Reverses the mapping: from a Stripe Price ID back to our internal plan ID.
   */
  private getPlanIdFromPriceId(priceId: string): string {
    if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
    if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly';
    throw new Error(`Unknown Stripe price ID: ${priceId}`);
  }

  async createCheckoutSession(userId: string, email: string, planId: string): Promise<string> {
    const priceId = this.getPriceId(planId);
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: userId,
      // Pass the planId into metadata so we can recover it during the checkout.session.completed webhook
      metadata: { planId },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.APP_URL}/dashboard?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error('Failed to create Stripe checkout session');
    }

    return session.url;
  }

  async createCustomerPortalSession(customerId: string): Promise<string> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/dashboard`,
    });

    return session.url;
  }

  async parseWebhook(body: string, signature: string): Promise<ProviderEvent> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

    let event: Stripe.Event;
    try {
      // Cryptographically verify the webhook came from Stripe
      event = stripe.webhooks.constructEvent(body, signature, secret);
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    // Map Stripe's event types to our 4-stage domain lifecycle
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: 'VERIFICATION',
          providerReference: event.id, // Idempotency key
          customerId: session.customer as string,
          subscriptionId: session.subscription as string,
          planId: session.metadata?.planId,
        };
      }
      
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const lineItem = invoice.lines?.data?.[0];
        const priceId = lineItem?.price?.id || lineItem?.plan?.id;
        
        // Stripe returns period_end as a Unix timestamp (seconds)
        const periodEnd = lineItem ? new Date(lineItem.period.end * 1000) : undefined;
        
        return {
          type: 'FULFILLMENT',
          providerReference: event.id,
          customerId: invoice.customer as string,
          subscriptionId: invoice.subscription as string,
          planId: priceId ? this.getPlanIdFromPriceId(priceId) : undefined,
          amountInMinorUnits: invoice.amount_paid,
          periodEnd,
        };
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        return {
          type: 'FAILURE',
          providerReference: event.id,
          customerId: invoice.customer as string,
          message: 'Payment failed for recurring invoice',
        };
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: 'CANCELLATION',
          providerReference: event.id,
          customerId: sub.customer as string,
        };
      }

      default:
        throw new Error(`Unhandled Stripe webhook event type: ${event.type}`);
    }
  }
}

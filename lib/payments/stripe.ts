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
      // Pass the planId and userId into metadata so we can recover them during webhooks
      metadata: { planId, userId },
      subscription_data: {
        metadata: { planId, userId },
      },
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
          userId: session.client_reference_id as string,
          amountInMinorUnits: session.amount_total || undefined,
        };
      }
      
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        
        // 2026 API structure: subscription is inside parent.subscription_details
        const subscriptionId = invoice.parent?.subscription_details?.subscription || invoice.subscription;
        const metadata = invoice.parent?.subscription_details?.metadata;
        const expectedPlanId = metadata?.planId;

        let lineItem;
        if (expectedPlanId) {
          const expectedPriceId = this.getPriceId(expectedPlanId);
          lineItem = invoice.lines?.data?.find((li: any) => {
            const id = li?.pricing?.price_details?.price || li?.price?.id || li?.plan?.id;
            return id === expectedPriceId;
          });
        } else {
          lineItem = invoice.lines?.data?.find((li: any) => li.amount >= 0);
        }

        if (!lineItem) {
          throw new Error(`Failed to find matching line item in invoice for expected plan: ${expectedPlanId || 'unknown'}`);
        }
        
        // 2026 API structure: price is inside pricing.price_details
        const priceId = lineItem?.pricing?.price_details?.price || lineItem?.price?.id || lineItem?.plan?.id;
        
        // Stripe returns period_end and period_start as Unix timestamps (seconds)
        const periodStart = lineItem?.period?.start ? new Date(lineItem.period.start * 1000) : undefined;
        const periodEnd = lineItem?.period?.end ? new Date(lineItem.period.end * 1000) : undefined;
        
        // User ID extraction
        
        let userId: string | undefined = metadata?.userId;

        // Fallback: Retrieve subscription to get metadata if not present in the invoice event
        if (!userId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId as string);
          userId = sub.metadata?.userId;
        }

        return {
          type: 'FULFILLMENT',
          providerReference: event.id,
          customerId: invoice.customer as string,
          subscriptionId: subscriptionId as string,
          planId: priceId ? this.getPlanIdFromPriceId(priceId) : undefined,
          amountInMinorUnits: invoice.amount_paid,
          periodStart,
          periodEnd,
          userId,
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

  async upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<void> {
    const newPriceId = this.getPriceId(newPlanId);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription.items.data.length) {
      throw new Error('Subscription has no items to upgrade');
    }
    
    // Update the subscription to the new price, and tell Stripe to invoice the proration immediately
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice',
      // Ensure we update the metadata to match the new plan
      metadata: {
        ...subscription.metadata,
        planId: newPlanId,
      },
    });
  }

  async downgradeSubscription(subscriptionId: string, newPlanId: string): Promise<void> {
    const newPriceId = this.getPriceId(newPlanId);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    let scheduleId = subscription.schedule as string | null;
    
    // If no schedule exists, create one from the current subscription
    if (!scheduleId) {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscriptionId,
      });
      scheduleId = schedule.id;
    }

    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const currentPhase = schedule.phases[0];
    
    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: 'release',
      phases: [
        {
          start_date: currentPhase.start_date,
          end_date: currentPhase.end_date,
          items: currentPhase.items.map(item => ({
            price: item.price as string,
            quantity: item.quantity,
          })),
        },
        {
          start_date: currentPhase.end_date,
          items: [
            {
              price: newPriceId,
              quantity: 1,
            },
          ],
          metadata: {
            ...subscription.metadata,
            planId: newPlanId,
          }
        }
      ],
    });
  }
}

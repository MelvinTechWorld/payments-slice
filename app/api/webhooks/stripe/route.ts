import { NextRequest, NextResponse } from 'next/server';
import { paymentProvider } from '@/lib/payments/index';
import { db } from '@/prisma/db';

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = await paymentProvider.parseWebhook(bodyText, signature);
  } catch (error: any) {
    // Decision 1: Return 200 for unmapped events to prevent Stripe retries
    if (error.message && error.message.includes('Unhandled Stripe webhook event type')) {
      return NextResponse.json({ received: true, note: 'Unmapped event ignored' });
    }
    console.error('Webhook parsing error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Determine the internal user ID
  let internalUserId = event.userId;
  if (!internalUserId) {
    const sub = await db.orm.public.Subscription.where({ stripeCustomerId: event.customerId }).first();
    if (sub) {
      internalUserId = sub.userId;
    }
  }

  if (!internalUserId) {
    console.error('Webhook event missing userId mapping', event);
    return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
  }

  // Decision 2: Webhook Retry Handling (Idempotency)
  try {
    await db.orm.public.PaymentEvent.create({
      userId: internalUserId,
      stripeEventId: event.providerReference,
      eventType: event.type,
      amount: event.amountInMinorUnits || 0,
      planId: event.planId || 'unknown',
      message: event.message || null,
    });
  } catch (err: any) {
    // Catch unique constraint violation on stripeEventId (Postgres 23505 via custom wrapper)
    if (err.sqlState === '23505' || err.constraint === 'PaymentEvent_stripeEventId_key') {
      return NextResponse.json({ received: true, note: 'duplicate event ignored' }, { status: 200 });
    }
    throw err;
  }

  // Process specific events
  if (event.type === 'FULFILLMENT' && event.planId && event.periodStart && event.periodEnd) {
    const existingSub = await db.orm.public.Subscription.where({ userId: internalUserId }).first();
    
    if (existingSub) {
      let newPeriodEnd = event.periodEnd;
      
      // Decision 3: Duplicate Payment Behaviour (Fallback for race condition)
      if (existingSub.status === 'active' && 
          existingSub.stripeSubscriptionId !== event.subscriptionId && 
          new Date(existingSub.currentPeriodEnd).getTime() > Date.now()) {
        
        const paidDurationMs = event.periodEnd.getTime() - event.periodStart.getTime();
        newPeriodEnd = new Date(new Date(existingSub.currentPeriodEnd).getTime() + paidDurationMs);
      }

      await db.orm.public.Subscription.where({ id: existingSub.id }).update({
        status: 'active',
        planId: event.planId,
        pendingPlanId: null, // Clear pending plan upon successful billing
        currentPeriodStart: event.periodStart.toISOString(),
        currentPeriodEnd: newPeriodEnd.toISOString(),
        stripeCustomerId: event.customerId,
        stripeSubscriptionId: event.subscriptionId as string,
        cancelAtPeriodEnd: false,
      });
    } else {
      await db.orm.public.Subscription.create({
        userId: internalUserId,
        planId: event.planId,
        status: 'active',
        currentPeriodStart: event.periodStart.toISOString(),
        currentPeriodEnd: event.periodEnd.toISOString(),
        stripeCustomerId: event.customerId,
        stripeSubscriptionId: event.subscriptionId as string,
        cancelAtPeriodEnd: false,
      });
    }
  }

  if (event.type === 'CANCELLATION') {
    const existingSub = await db.orm.public.Subscription.where({ userId: internalUserId }).first();
    if (existingSub) {
      await db.orm.public.Subscription.where({ id: existingSub.id }).update({
        status: 'canceled',
        pendingPlanId: null, // Wipe any scheduled downgrade since the sub is dead
        cancelAtPeriodEnd: true,
      });
    }
  }

  return NextResponse.json({ received: true });
}

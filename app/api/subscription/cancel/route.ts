import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { paymentProvider } from '@/lib/payments/index';
import { logPaymentEvent } from '@/lib/payments/log';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await db.orm.public.Session.where({ id: sessionId }).first();
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sub = await db.orm.public.Subscription.where({ userId: session.userId }).first();
  if (!sub || sub.status !== 'active') {
    return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 });
  }

  if (sub.cancelAtPeriodEnd) {
    return NextResponse.json({ error: 'Subscription is already scheduled to cancel' }, { status: 400 });
  }

  try {
    let reason = undefined;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      reason = body.reason;
    }

    // Call the provider to cancel at period end
    await paymentProvider.cancelSubscription(sub.stripeSubscriptionId, true);

    // Update local DB to reflect the pending cancellation
    await db.orm.public.Subscription.where({ id: sub.id }).update({
      cancelAtPeriodEnd: true,
      pendingPlanId: null, // Clear any pending downgrades since we are canceling entirely
    });

    // Log the CANCELLATION intent event immediately (with the reason)
    await db.orm.public.PaymentEvent.create({
      userId: session.userId,
      eventType: 'CANCELLATION',
      amount: 0,
      planId: sub.planId,
      message: reason || null,
    });

    return NextResponse.json({ success: true, note: 'Subscription scheduled to cancel at period end' });
  } catch (err: any) {
    console.error('Cancel error:', err);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}

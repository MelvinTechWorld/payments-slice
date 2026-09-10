import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { paymentProvider } from '@/lib/payments/index';
import { logPaymentEvent } from '@/lib/payments/log';
import { PLANS } from '@/lib/payments/plans';

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
    return NextResponse.json({ error: 'No active subscription to downgrade' }, { status: 400 });
  }

  // Only yearly to monthly downgrade is supported in this slice
  if (sub.planId === 'monthly') {
    return NextResponse.json({ error: 'Already on monthly plan' }, { status: 400 });
  }

  try {
    // Log the downgrade INITIATION
    await logPaymentEvent({
      userId: session.userId,
      eventType: 'INITIATION',
      amount: PLANS['monthly'].amount,
      planId: 'monthly',
    });

    await paymentProvider.downgradeSubscription(sub.stripeSubscriptionId, 'monthly');

    await db.orm.public.Subscription.where({ id: sub.id }).update({
      pendingPlanId: 'monthly',
    });

    return NextResponse.json({ success: true, note: 'Downgrade scheduled for end of billing cycle' });
  } catch (err: any) {
    console.error('Downgrade error:', err);
    return NextResponse.json({ error: 'Failed to downgrade subscription' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { PLANS } from '@/lib/payments/plans';
import { logPaymentEvent } from '@/lib/payments/log';
import { paymentProvider } from '@/lib/payments/index';

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (10 requests per 10 minutes per IP)
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const rateLimit = await checkRateLimit(ip, 'checkout_initiation', 10, 600);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.reset);
  }

  // 2. Authentication
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await db.orm.public.Session.where({ id: sessionId }).first();
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.orm.public.User.where({ id: session.userId }).first();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Prevent duplicate checkout
  const existingSub = await db.orm.public.Subscription.where({ userId: user.id }).first();
  if (existingSub && existingSub.status === 'active' && new Date(existingSub.currentPeriodEnd).getTime() > Date.now()) {
    return NextResponse.json({ error: 'You already have an active subscription.' }, { status: 400 });
  }

  // 3. Request Validation
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { planId } = body;
  if (!planId || !PLANS[planId]) {
    return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  }

  const plan = PLANS[planId];

  try {
    // 4. Log INITIATION
    await logPaymentEvent({
      userId: user.id,
      eventType: 'INITIATION',
      amount: plan.amount,
      planId,
    });

    // 5. Handoff to provider
    const url = await paymentProvider.createCheckoutSession(user.id, user.email, planId);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate checkout' },
      { status: 500 }
    );
  }
}

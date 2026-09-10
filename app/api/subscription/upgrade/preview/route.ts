import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { calculateProratedCredit, formatMoney } from '@/lib/payments/money';
import { PLANS } from '@/lib/payments/plans';

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: 'No active subscription to upgrade' }, { status: 400 });
  }

  if (sub.planId === 'yearly') {
    return NextResponse.json({ error: 'Already on yearly plan' }, { status: 400 });
  }

  const currentPlan = PLANS[sub.planId];
  const newPlan = PLANS['yearly'];
  
  if (!currentPlan || !newPlan) {
    return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 500 });
  }

  const now = new Date();
  const periodStart = new Date(sub.currentPeriodStart);
  const periodEnd = new Date(sub.currentPeriodEnd);
  
  const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const unusedDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const credit = calculateProratedCredit(currentPlan.amount, totalDays, unusedDays);
  const upgradeCost = Math.max(0, newPlan.amount - credit);

  return NextResponse.json({
    currentPlan: sub.planId,
    newPlan: 'yearly',
    creditAmount: formatMoney(credit),
    creditMinorUnits: credit,
    upgradeCost: formatMoney(upgradeCost),
    upgradeCostMinorUnits: upgradeCost,
  });
}

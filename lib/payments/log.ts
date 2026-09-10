import { db } from '@/prisma/db';
import { PaymentEventType } from './provider';

interface LogPaymentEventParams {
  userId: string;
  stripeEventId?: string;
  eventType: PaymentEventType;
  amount: number;
  planId: string;
}

/**
 * The single append-only log function for payment events.
 * Every write to the PaymentEvent table across the app flows through this function.
 */
export async function logPaymentEvent(data: LogPaymentEventParams) {
  return await db.orm.public.PaymentEvent.create({
    userId: data.userId,
    stripeEventId: data.stripeEventId || null,
    eventType: data.eventType,
    amount: data.amount,
    planId: data.planId,
  });
}

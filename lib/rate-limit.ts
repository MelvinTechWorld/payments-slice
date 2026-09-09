import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';

interface RateLimitResult {
  success: boolean;
  reset: Date;
}

export async function checkRateLimit(ip: string, action: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const key = `${action}:${ip}`;
  const now = Date.now();
  
  const record = await db.orm.public.RateLimit.where({ key }).first();

  if (record && new Date(record.expiresAt).getTime() > now) {
    if (record.points >= limit) {
      return { success: false, reset: new Date(record.expiresAt) };
    }
    
    // Prisma Next update syntax
    await db.orm.public.RateLimit.where({ key }).update({
      points: record.points + 1,
    });

    return { success: true, reset: new Date(record.expiresAt) };
  }
  
  if (record) {
    // Delete expired record
    await db.orm.public.RateLimit.where({ key }).delete();
  }

  // Create new window
  const reset = new Date(now + windowSeconds * 1000);
  try {
    await db.orm.public.RateLimit.create({
      key,
      points: 1,
      expiresAt: reset.toISOString(),
    });
  } catch (error: any) {
    // If concurrent request already created it, treat as success but don't crash
    if (error?.code === 'P2002' || error?.message?.includes('Unique constraint failed')) {
      return { success: true, reset };
    }
    throw error;
  }

  return { success: true, reset };
}

export function rateLimitResponse(reset: Date) {
  const retryAfterSeconds = Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { 
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(),
      }
    }
  );
}

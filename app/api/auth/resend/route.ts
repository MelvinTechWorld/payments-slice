import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const resendSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const rateLimit = await checkRateLimit(ip, 'resend', 5, 900);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit.reset);
    }

    const body = await request.json();
    const result = resendSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email } = result.data;

    const user = await db.orm.public.User.where({ email }).first();
    if (!user) {
      // Don't reveal whether user exists for security, just pretend success
      return NextResponse.json({ message: 'If that email exists, a new code has been sent.' }, { status: 200 });
    }

    const existingCode = await db.orm.public.VerificationCode.where({ userId: user.id }).first();
    
    const now = Date.now();
    
    if (existingCode) {
      // Check 60 second cooldown
      const lastSentTime = new Date(existingCode.lastSentAt).getTime();
      const timeSinceLastSent = now - lastSentTime;
      if (timeSinceLastSent < 60 * 1000) {
        const retryAfterSeconds = Math.max(1, Math.ceil((60 * 1000 - timeSinceLastSent) / 1000));
        return NextResponse.json(
          { error: 'Please wait before requesting another code.' },
          { 
            status: 429,
            headers: {
              'Retry-After': retryAfterSeconds.toString(),
            }
          }
        );
      }
      // Delete existing code
      await db.orm.public.VerificationCode.where({ id: existingCode.id }).delete();
    }

    // Generate new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString(); 
    const nowStr = new Date(now).toISOString();

    await db.orm.public.VerificationCode.create({
      userId: user.id,
      code,
      expiresAt,
      lastSentAt: nowStr,
    });

    console.log(`[Email Mock] RESENT Verification code for ${email} is: ${code}`);

    return NextResponse.json(
      { message: 'If that email exists, a new code has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

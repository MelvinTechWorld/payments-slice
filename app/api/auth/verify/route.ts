import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { verifyEmailSchema } from '@/lib/validations/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = verifyEmailSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, code } = result.data;

    // Find the user by email
    const user = await db.orm.public.User.where({ email }).first();
    if (!user) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Find the verification code for this user
    const verificationCode = await db.orm.public.VerificationCode.where({ userId: user.id }).first();
    if (!verificationCode) {
      return NextResponse.json({ error: 'No verification code found' }, { status: 400 });
    }

    // Check if it matches
    if (verificationCode.code !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Check if it's expired
    if (new Date(verificationCode.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Verification code has expired' }, { status: 400 });
    }

    // Success! Delete the code
    await db.orm.public.VerificationCode.where({ id: verificationCode.id }).delete();

    // Create session (DB-backed)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    
    const session = await db.orm.public.Session.create({
      userId: user.id,
      expiresAt,
    });

    // Set cookie (await cookies() for Next.js 15+)
    const cookieStore = await cookies();
    cookieStore.set('sessionId', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return NextResponse.json(
      { message: 'Email verified successfully. You are now logged in.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

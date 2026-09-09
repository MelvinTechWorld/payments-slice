import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { hashPassword } from '@/lib/auth/password';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { token, password } = result.data;

    // Hash the provided token to compare with DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const resetTokenRecord = await db.orm.public.PasswordResetToken.where({ tokenHash }).first();
    
    if (!resetTokenRecord) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Check expiry
    if (new Date(resetTokenRecord.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(password);

    // Update user password
    await db.orm.public.User.where({ id: resetTokenRecord.userId }).update({
      passwordHash: newPasswordHash,
    });

    // Invalidate all existing sessions and reset tokens for this user
    await db.orm.public.Session.where({ userId: resetTokenRecord.userId }).delete();
    await db.orm.public.PasswordResetToken.where({ userId: resetTokenRecord.userId }).delete();

    // Optionally clear their current cookie if they are using it
    const cookieStore = await cookies();
    cookieStore.delete('sessionId');

    return NextResponse.json(
      { message: 'Password reset successfully. You can now sign in with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;

    if (sessionId) {
      // Delete session from DB
      await db.orm.public.Session.where({ id: sessionId }).delete();
      
      // Delete cookie
      cookieStore.delete('sessionId');
    }

    return NextResponse.redirect(new URL('/signin', request.url));
  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

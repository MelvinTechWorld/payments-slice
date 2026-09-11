import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { redirect } from 'next/navigation';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  if (!sessionId) {
    redirect('/signin');
  }

  const session = await db.orm.public.Session.where({ id: sessionId }).first();
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    redirect('/signin');
  }

  const user = await db.orm.public.User.where({ id: session.userId }).first();
  if (!user) {
    redirect('/signin');
  }

  return (
    <div>
      {params.checkout === 'cancelled' && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px' }}>
          Checkout was cancelled.
        </div>
      )}
      <p>Welcome, {user.name}</p>
      <form action="/api/auth/signout" method="POST">
        <button type="submit" style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Sign Out
        </button>
      </form>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <a href="/plans" style={{ textDecoration: 'underline' }}>Plans</a>
        <a href="/billing" style={{ textDecoration: 'underline' }}>Billing</a>
      </div>
    </div>
  );
}

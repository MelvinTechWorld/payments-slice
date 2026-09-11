import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { redirect } from 'next/navigation';
import AutoRefresh from './AutoRefresh';

export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; checkout?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  if (!sessionId) {
    redirect('/signin');
  }

  const session = await db.orm.public.Session.where({ id: sessionId }).first();
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    redirect('/signin');
  }

  // Find if they have an active subscription
  const sub = await db.orm.public.Subscription.where({ userId: session.userId }).first();
  
  // If no subscription is active yet, the webhook hasn't processed
  const isActive = sub && sub.status === 'active' && new Date(sub.currentPeriodEnd).getTime() > Date.now();

  return (
    <div className="max-w-md mx-auto mt-16 p-8 border rounded-lg shadow-sm text-center">
      <h1 className="text-2xl font-bold mb-4">Checkout Return</h1>
      
      {isActive ? (
        <div className="bg-green-50 text-green-700 p-4 rounded mb-6">
          <p className="font-semibold">Payment Successful!</p>
          <p className="text-sm mt-1">Your subscription is now active.</p>
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded mb-6">
          <AutoRefresh />
          <p className="font-semibold">Processing Payment...</p>
          <p className="text-sm mt-1">We are waiting for confirmation from the payment provider. Please check back in a moment.</p>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-6">
        <a href="/dashboard" className="text-blue-600 hover:underline">Go to Dashboard</a>
        <a href="/billing" className="text-blue-600 hover:underline">Manage Billing</a>
      </div>
    </div>
  );
}

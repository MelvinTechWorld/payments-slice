import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { redirect } from 'next/navigation';
import BillingControls from './BillingControls';

export default async function BillingPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  if (!sessionId) {
    redirect('/signin');
  }

  const session = await db.orm.public.Session.where({ id: sessionId }).first();
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    redirect('/signin');
  }

  const sub = await db.orm.public.Subscription.where({ userId: session.userId }).first();

  if (!sub) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">Billing & Subscription</h1>
        <div className="bg-gray-50 border rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">You do not have an active subscription.</p>
          <a href="/plans" className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            View Plans
          </a>
        </div>
        <div className="mt-8">
          <a href="/dashboard" className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">Back to Dashboard</a>
        </div>
      </div>
    );
  }

  const currentPeriodEnd = new Date(sub.currentPeriodEnd).toLocaleDateString();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Billing & Subscription</h1>
      
      <div className="border rounded-lg p-6 shadow-sm">
        <div className="grid md:grid-cols-3 gap-6 mb-2">
          
          <div>
            <div className="text-sm text-gray-500 mb-1">Current Plan</div>
            <div className="text-lg font-semibold capitalize">
              {sub.planId}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-1">Status</div>
            <div>
              {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              )}
              {sub.cancelAtPeriodEnd && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Canceling
                </span>
              )}
              {sub.status !== 'active' && !sub.cancelAtPeriodEnd && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 capitalize">
                  {sub.status}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-1">
              {sub.cancelAtPeriodEnd ? 'Access Ends' : 'Renews On'}
            </div>
            <div className="text-lg">
              {currentPeriodEnd}
            </div>
          </div>

        </div>

        {sub.pendingPlanId && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded text-sm">
            You are scheduled to switch to the <strong>{sub.pendingPlanId}</strong> plan at the end of your current billing cycle on {currentPeriodEnd}.
          </div>
        )}

        {sub.cancelAtPeriodEnd && (
          <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded text-sm">
            Your subscription has been canceled. You will continue to have access until {currentPeriodEnd}.
          </div>
        )}

        <BillingControls 
          planId={sub.planId} 
          pendingPlanId={sub.pendingPlanId}
          cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
        />
      </div>

      <div className="mt-8">
        <a href="/dashboard" className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">Back to Dashboard</a>
      </div>
    </div>
  );
}

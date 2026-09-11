'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlansPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout');
      }

      // Handoff to Stripe
      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Subscription Plans</h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Plan */}
        <div className="border rounded-lg p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Monthly</h2>
          <div className="text-3xl font-bold mb-6">$9.00 <span className="text-sm font-normal text-gray-500">/mo</span></div>
          
          <div className="mt-auto pt-4 border-t">
            <button
              onClick={() => handleSubscribe('monthly')}
              disabled={loading !== null}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading === 'monthly' ? 'Processing...' : 'Subscribe to Monthly'}
            </button>
          </div>
        </div>

        {/* Yearly Plan */}
        <div className="border rounded-lg p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Yearly</h2>
          <div className="text-3xl font-bold mb-6">$94.00 <span className="text-sm font-normal text-gray-500">/yr</span></div>
          
          <div className="mt-auto pt-4 border-t">
            <button
              onClick={() => handleSubscribe('yearly')}
              disabled={loading !== null}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading === 'yearly' ? 'Processing...' : 'Subscribe to Yearly'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

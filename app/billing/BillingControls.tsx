'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingControls({ 
  planId, 
  pendingPlanId, 
  cancelAtPeriodEnd 
}: { 
  planId: string;
  pendingPlanId: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Polling state for upgrade
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Watch for the plan change from the server
  useEffect(() => {
    if (isUpgrading && planId === 'yearly') {
      setIsUpgrading(false);
      setLoading(null);
      setSuccessMessage('Upgrade successful! You are now on the Yearly plan.');
    }
  }, [planId, isUpgrading]);

  // Poll the server while upgrading
  useEffect(() => {
    if (isUpgrading) {
      const interval = setInterval(() => {
        router.refresh();
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isUpgrading, router]);

  const handleUpgrade = async () => {
    // Only handles monthly -> yearly
    setLoading('upgrade');
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/subscription/upgrade/confirm', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upgrade');
      
      // Start polling for the updated plan
      setIsUpgrading(true);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const handleDowngrade = async () => {
    // Only handles yearly -> monthly
    setLoading('downgrade');
    setError('');
    try {
      const res = await fetch('/api/subscription/downgrade', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule downgrade');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const submitCancel = async () => {
    setLoading('cancel');
    setError('');
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      setShowCancelModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t space-y-4">
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {successMessage && <div className="text-green-600 mb-4 font-medium">{successMessage}</div>}

      <div className="flex flex-wrap gap-4">
        {/* Upgrade / Downgrade Logic */}
        {!cancelAtPeriodEnd && (
          <>
            {planId === 'monthly' && (
              <button 
                onClick={handleUpgrade} 
                disabled={loading !== null}
                className="bg-blue-600 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading === 'upgrade' ? 'Upgrading...' : 'Upgrade to Yearly'}
              </button>
            )}

            {planId === 'yearly' && !pendingPlanId && (
              <button 
                onClick={handleDowngrade} 
                disabled={loading !== null}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading === 'downgrade' ? 'Scheduling...' : 'Downgrade to Monthly'}
              </button>
            )}
          </>
        )}

        {/* Cancel Logic */}
        {!cancelAtPeriodEnd && (
          <button 
            onClick={() => setShowCancelModal(true)} 
            disabled={loading !== null}
            className="text-red-600 hover:underline px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
          >
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold mb-4">Cancel Subscription</h3>
            <p className="text-gray-600 mb-4">
              Your cancellation will take effect at the end of your current billing cycle. You will retain access until then.
            </p>
            <div className="mb-6">
              <label htmlFor="cancel-reason" className="block text-sm font-medium mb-2">Optional: Why are you leaving?</label>
              <textarea 
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Too expensive, missing features, etc."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Nevermind
              </button>
              <button 
                onClick={submitCancel}
                disabled={loading === 'cancel'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading === 'cancel' ? 'Canceling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

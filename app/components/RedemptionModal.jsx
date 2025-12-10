"use client";

import { useState, useEffect } from "react";
import { useToast } from "./ToastProvider";
import supabase from "../lib/supabase";

/**
 * RedemptionModal - Handles item redemption for event owners
 *
 * Flow:
 * 1. Check if user has Stripe Connect account
 * 2. If not → Show onboarding button
 * 3. If yes → Show redemption interface
 * 4. Display platform fee and net payout
 * 5. Create fulfillment request on submit
 */
export default function RedemptionModal({ isOpen, onClose, item, eventId, userId }) {
  const { showToast } = useToast();

  // Connect status
  const [connectStatus, setConnectStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Onboarding
  const [onboarding, setOnboarding] = useState(false);

  // Redemption
  const [redeeming, setRedeeming] = useState(false);
  const [notes, setNotes] = useState("");

  // Check Connect status when modal opens
  useEffect(() => {
    if (!isOpen || !userId) return;
    checkConnectStatus();
  }, [isOpen, userId]);

  const checkConnectStatus = async () => {
    setLoadingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast('Session expired. Please log in again.', 'error');
        return;
      }

      const response = await fetch('/api/connect/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      setConnectStatus(data);
    } catch (error) {
      console.error('Error checking Connect status:', error);
      showToast('Failed to check bank account status', 'error');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleStartOnboarding = async () => {
    setOnboarding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast('Session expired. Please log in again.', 'error');
        return;
      }

      const response = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (data.error) {
        showToast(data.error || 'Failed to start onboarding', 'error');
        setOnboarding(false);
        return;
      }

      if (data.alreadyOnboarded) {
        showToast('Bank account already connected!', 'success');
        checkConnectStatus();
        setOnboarding(false);
        return;
      }

      // Redirect to Stripe onboarding
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error starting onboarding:', error);
      showToast('Failed to start onboarding process', 'error');
      setOnboarding(false);
    }
  };

  const handleRedeem = async () => {
    if (!item || !eventId || !userId) return;

    setRedeeming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast('Session expired. Please log in again.', 'error');
        return;
      }

      // Generate idempotency key
      const timestamp = Date.now();
      const idempotencyKey = `fulfillment-${userId.substring(0, 8)}-${item.id.substring(0, 8)}-${timestamp}`;

      const response = await fetch('/api/fulfillments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          itemId: item.id,
          eventId: eventId,
          fulfillmentMethod: 'bank_transfer',
          notes: notes.trim() || null,
          idempotencyKey: idempotencyKey
        })
      });

      const data = await response.json();

      // Handle specific error cases
      if (response.status === 402) {
        if (data.error === 'stripe_connect_required') {
          showToast('Please connect your bank account first', 'error');
          checkConnectStatus();
        } else if (data.error === 'stripe_account_unverified') {
          showToast(data.message || 'Bank account not verified yet', 'error');
        } else {
          showToast(data.message || 'Payment setup required', 'error');
        }
        setRedeeming(false);
        return;
      }

      if (!response.ok) {
        showToast(data.error || 'Failed to create redemption', 'error');
        setRedeeming(false);
        return;
      }

      // Success!
      showToast('Redemption initiated! Funds will arrive in 2-7 business days.', 'success');
      onClose();

      // Refresh page to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error redeeming:', error);
      showToast('Network error. Please try again.', 'error');
      setRedeeming(false);
    }
  };

  if (!isOpen) return null;

  // Calculate amounts
  const grossAmountCents = item?.current_amount_cents || 0;
  const platformFeeCents = Math.floor(grossAmountCents * 5 / 100); // 5% platform fee
  const netAmountCents = grossAmountCents - platformFeeCents;

  const grossAmount = (grossAmountCents / 100).toFixed(2);
  const platformFee = (platformFeeCents / 100).toFixed(2);
  const netAmount = (netAmountCents / 100).toFixed(2);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Redeem Funds</h3>
          <button
            onClick={onClose}
            className="text-gray-800 hover:text-gray-900 text-3xl leading-none"
            disabled={redeeming || onboarding}
          >
            ×
          </button>
        </div>

        {/* Loading state */}
        {loadingStatus && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking bank account status...</p>
          </div>
        )}

        {/* Not connected - show onboarding */}
        {!loadingStatus && connectStatus && !connectStatus.connected && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-blue-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Connect Your Bank Account</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    To receive funds, you need to connect a bank account via Stripe. This is a secure, one-time setup.
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Quick 2-minute setup</li>
                    <li>Bank-level security by Stripe</li>
                    <li>Funds arrive in 2-7 business days</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartOnboarding}
              disabled={onboarding}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {onboarding ? 'Redirecting to Stripe...' : 'Connect Bank Account'}
            </button>
          </div>
        )}

        {/* Onboarding incomplete - show continue button */}
        {!loadingStatus && connectStatus && connectStatus.connected && !connectStatus.onboardingCompleted && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-yellow-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Complete Bank Account Setup</h4>
                  <p className="text-sm text-gray-700">
                    Your bank account setup is incomplete. Please complete the onboarding process to receive funds.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartOnboarding}
              disabled={onboarding}
              className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {onboarding ? 'Redirecting...' : 'Continue Setup'}
            </button>
          </div>
        )}

        {/* Connected and verified - show redemption form */}
        {!loadingStatus && connectStatus && connectStatus.onboardingCompleted && (
          <div className="space-y-6">
            {/* Item info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-3 text-lg">{item?.title}</h4>

              {/* Amount breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Raised:</span>
                  <span className="font-semibold text-gray-900">${grossAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Platform Fee (5%):</span>
                  <span className="font-medium text-gray-900">-${platformFee}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">You Receive:</span>
                  <span className="font-bold text-green-600 text-lg">${netAmount}</span>
                </div>
              </div>
            </div>

            {/* Bank account confirmation */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-800">Bank account connected</span>
              </div>
            </div>

            {/* Optional notes */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
                placeholder="Add any notes about this redemption..."
                rows="3"
                maxLength={500}
                disabled={redeeming}
              />
              <p className="text-xs text-gray-600 mt-1">{notes.length}/500 characters</p>
            </div>

            {/* Timeline info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Timeline:</span> Funds typically arrive in your bank account within 2-7 business days after submitting this request.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRedeem}
                disabled={redeeming}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
              >
                {redeeming ? 'Processing...' : `Redeem $${netAmount}`}
              </button>
              <button
                onClick={onClose}
                disabled={redeeming}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

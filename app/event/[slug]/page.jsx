"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../lib/supabase";
import { useToast } from "../../components/ToastProvider";

export default function ViewEventPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [event, setEvent] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);
  const [cancelBanner, setCancelBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // Fetch event data
  const fetchEventData = async () => {
    setLoading(true);
    setNotFound(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (session?.user) {
      setUser(session.user);
    } else {
      setUser(null);
      setIsOwner(false);
    }

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select(
        "id, title, slug, description, event_date, user_id, items(id, title, price_cents, current_amount_cents, product_link, image_url)"
      )
      .eq("slug", slug)
      .single();

    if (eventError || !eventData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setEvent(eventData);
    setItems(eventData.items || []);

    if (session?.user && eventData.user_id === session.user.id) {
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }

    setLoading(false);
  };

  // Verify payment session
  const verifyPaymentSession = async (sessionId) => {
    if (!sessionId) return null;

    setVerifyingPayment(true);
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      setVerifyingPayment(false);
      return data;
    } catch (error) {
      console.error('Error verifying payment:', error);
      setVerifyingPayment(false);
      return { valid: false, error: 'Failed to verify payment' };
    }
  };

  // Helper function to get user-friendly error message
  const getErrorMessage = (errorType, defaultMessage) => {
    const errorMessages = {
      'card_declined': 'Your card was declined. Please contact your card issuer or try a different payment method.',
      'insufficient_funds': 'Insufficient funds in your account. Please use a different payment method or contact your bank.',
      'expired_card': 'Your card has expired. Please update your payment information and try again.',
      'incorrect_cvc': 'The CVV code entered is incorrect. Please verify and try again.',
      'incorrect_zip': 'The ZIP code entered is incorrect. Please verify and try again.',
      'generic_decline': 'Your bank has rejected the transaction. Please contact your bank for more details or try a different payment method.',
      'payment_failed': 'Payment failed. Please try again or contact support if the problem persists.'
    };

    return errorMessages[errorType] || defaultMessage || 'Payment failed. Please try again or contact support if the problem persists.';
  };

  // Handle payment success/cancel from URL
  useEffect(() => {
    if (typeof window === 'undefined' || !event || paymentVerified) return;

    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    // Handle canceled payment
    if (canceled === 'true') {
      setCancelBanner(true);
      setPaymentVerified(true);
      // Clean URL
      router.replace(`/event/${slug}`, { scroll: false });
      // Auto-dismiss after 8 seconds
      setTimeout(() => setCancelBanner(false), 8000);
      return;
    }

    // Handle successful payment (or failed payment that Stripe redirected to success URL)
    if (success === 'true') {
      setPaymentVerified(true);
      if (sessionId) {
        // Verify the payment session
        verifyPaymentSession(sessionId).then((result) => {
          if (!result) return;

          if (!result.valid) {
            // Invalid or expired session
            showToast(
              result.error || 'Invalid or expired payment session',
              'error'
            );
            router.replace(`/event/${slug}`, { scroll: false });
            return;
          }

          // Check if payment failed
          if (result.failed) {
            // Payment failed - show error banner
            const errorMessage = getErrorMessage(result.errorType, result.errorMessage);
            setErrorBanner({
              message: errorMessage,
              errorType: result.errorType
            });
            // Clean URL
            router.replace(`/event/${slug}`, { scroll: false });
            // Auto-dismiss after 10 seconds
            setTimeout(() => setErrorBanner(null), 10000);
            return;
          }

          if (result.completed) {
            // Payment completed successfully
            setSuccessBanner({
              message: 'Thank you for your contribution! Your payment has been processed.',
              amount: result.amount ? (result.amount / 100).toFixed(2) : null
            });
            // Refresh event data to show updated progress
            fetchEventData();
            // Clean URL
            router.replace(`/event/${slug}`, { scroll: false });
            // Auto-dismiss after 10 seconds
            setTimeout(() => setSuccessBanner(null), 10000);
          } else {
            // Payment received but webhook not processed yet
            showToast(
              'Payment received! Your contribution is being processed and will appear shortly.',
              'warning',
              8000
            );
            // Refresh data after a delay
            setTimeout(() => fetchEventData(), 3000);
            router.replace(`/event/${slug}`, { scroll: false });
          }
        });
      } else {
        // Success parameter but no session ID - show generic success
        setSuccessBanner({
          message: 'Thank you for your contribution! Your payment has been processed.'
        });
        fetchEventData();
        router.replace(`/event/${slug}`, { scroll: false });
        setTimeout(() => setSuccessBanner(null), 10000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, router, showToast, event, paymentVerified]);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (ignore) return;
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setIsOwner(false);
      }

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select(
          "id, title, slug, description, event_date, user_id, items(id, title, price_cents, current_amount_cents, product_link, image_url)"
        )
        .eq("slug", slug)
        .single();

      if (eventError || !eventData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEvent(eventData);
      setItems(eventData.items || []);

      if (session?.user && eventData.user_id === session.user.id) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }

      setLoading(false);
    }

    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent, session) => {
      if (ignore) return;
      if (session?.user) {
        setUser(session.user);
        const { data: eventData } = await supabase
          .from("events")
          .select("user_id")
          .eq("slug", slug)
          .single();
        if (eventData && eventData.user_id === session.user.id) {
          setIsOwner(true);
        } else {
          setIsOwner(false);
        }
      } else {
        setUser(null);
        setIsOwner(false);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [slug]);

  let totalGoal = 0;
  let totalRaised = 0;
  if (items.length > 0) {
    totalGoal = items.reduce(
      (sum, item) => sum + (item.price_cents || 0),
      0
    );
    totalRaised = items.reduce(
      (sum, item) => sum + (item.current_amount_cents || 0),
      0
    );
  }

  const isFullyFunded =
    items.length > 0 &&
    items.every(
      (item) =>
        (item.current_amount_cents || 0) >= (item.price_cents || 0)
    );

  function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const handleShare = async () => {
    const eventUrl = `${window.location.origin}/event/${slug}`;
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-50 py-10">
      <div className="max-w-5xl mx-auto px-4">
        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 bg-green-100 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">✓</span>
              <div>
                <p className="font-semibold text-lg">{successBanner.message}</p>
                {successBanner.amount && (
                  <p className="text-sm mt-1">Amount: ${successBanner.amount}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-green-700 hover:text-green-900 font-bold text-xl ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Cancel Banner */}
        {cancelBanner && (
          <div className="mb-6 bg-blue-100 border-2 border-blue-400 text-blue-800 px-6 py-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ℹ</span>
              <p className="font-semibold">Payment was canceled. You can try again anytime.</p>
            </div>
            <button
              onClick={() => setCancelBanner(false)}
              className="text-blue-700 hover:text-blue-900 font-bold text-xl ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorBanner && (
          <div className="mb-6 bg-red-100 border-2 border-red-500 text-red-800 px-6 py-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">✕</span>
              <div>
                <p className="font-semibold text-lg">Payment Failed</p>
                <p className="text-sm mt-1">{errorBanner.message}</p>
              </div>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xl ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Payment Verification Loading */}
        {verifyingPayment && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-6 py-3 rounded-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="font-medium">Verifying your payment...</p>
          </div>
        )}

        {user && (
          <div className="mb-6 flex justify-between items-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-50 transition border border-blue-200"
            >
              ← Dashboard
            </Link>
            {isOwner && (
              <Link
                href={`/event/${slug}/edit`}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-700 transition"
              >
                Edit Event
              </Link>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-gray-700 text-lg animate-pulse">Loading event...</div>
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="bg-white rounded-lg shadow p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
              <p className="text-gray-700 mb-2">
                Sorry, we couldn't find this event.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-10 text-center">
              <div className="flex flex-col items-center gap-4 mb-4">
                <h1 className="text-4xl font-bold text-blue-900 mb-2">{event.title}</h1>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-50 transition border border-blue-200"
                  title="Copy link to share"
                >
                  {copied ? (
                    <>
                      <span>✓</span>
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <span>🔗</span>
                      <span>Share Event</span>
                    </>
                  )}
                </button>
              </div>
              {event.event_date && (
                <div className="text-blue-600 text-md font-medium mb-2">
                  {formatDate(event.event_date)}
                </div>
              )}
              <div className="mx-auto max-w-2xl mb-4 text-gray-800 text-lg">
                {event.description ? (
                  <div>{event.description}</div>
                ) : (
                  <span className="italic text-gray-600">No description.</span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-center sm:items-center gap-2 mt-2">
                <div className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold text-lg shadow">
                  Total Raised: ${ (totalRaised / 100).toFixed(2) }
                </div>
                <div className="bg-blue-100 px-5 py-2 rounded-lg font-medium text-blue-900 shadow">
                  Goal: ${ (totalGoal / 100).toFixed(2) }
                </div>
                {isFullyFunded && (
                  <span className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg font-bold ml-2 shadow animate-bounce">
                    🎉 Fully Funded!
                  </span>
                )}
              </div>
              {totalGoal > 0 && (
                <div className="w-full max-w-lg mx-auto mt-6">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${
                        isFullyFunded
                          ? "bg-green-500"
                          : "bg-blue-400"
                      }`}
                      style={{
                        width: `${
                          Math.min(100, Math.round((totalRaised / totalGoal) * 100))
                        }%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 mt-1">
                    <span>$0</span>
                    <span>${(totalGoal / 100).toFixed(2)} Goal</span>
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.length === 0 ? (
                <div className="col-span-full text-center text-gray-700 italic">
                  No items found for this event.
                </div>
              ) : (
                items.map((item) => {
                  const price = item.price_cents || 0;
                  const raised = item.current_amount_cents || 0;
                  const itemFunded = raised >= price && price > 0;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-lg shadow-md flex flex-col min-h-[350px]"
                    >
                      {item.image_url ? (
                        <div className="h-44 w-full bg-gray-100 rounded-t-lg flex items-center justify-center overflow-hidden">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain rounded-t-lg"
                          />
                        </div>
                      ) : (
                        <div className="h-44 flex items-center justify-center bg-gray-100 rounded-t-lg text-gray-500 text-5xl">
                          <span className="material-symbols-outlined">image</span>
                        </div>
                      )}
                      <div className="p-4 flex flex-1 flex-col justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-blue-800 mb-1">
                            {item.title}
                          </h2>
                          <div className="text-lg font-bold text-gray-900 mb-2">
                            ${ (price / 100).toFixed(2) }
                          </div>
                          <div className="w-full mb-2">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  itemFunded
                                    ? "bg-green-500"
                                    : "bg-blue-400"
                                }`}
                                style={{
                                  width: price
                                    ? `${Math.min(100, Math.round((raised / price) * 100))}%`
                                    : "0%",
                                }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-700 mt-0.5">
                              <span>
                                Raised: ${ (raised / 100).toFixed(2) }
                              </span>
                              <span>
                                {itemFunded ? (
                                  <span className="text-green-700 font-semibold">Fully Funded!</span>
                                ) : (
                                  <>Goal: ${ (price / 100).toFixed(2) }</>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <button
                            onClick={() => setSelectedItem(item)}
                            disabled={itemFunded}
                            className={`flex-1 px-4 py-2 rounded-md font-semibold transition ${
                              itemFunded
                                ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {itemFunded ? 'Fully Funded' : 'Contribute'}
                          </button>
                          {item.product_link && (
                            <a
                              href={item.product_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 font-medium rounded-md hover:bg-blue-200 transition text-sm"
                            >
                              View Product
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {selectedItem && (
        <ContributeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

function ContributeModal({ item, onClose }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const remaining = (item.price_cents - item.current_amount_cents) / 100;
  const suggestedAmounts = [25, 50, 100];

  async function handleContribute() {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (!name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          amount: Math.round(parseFloat(amount) * 100),
          contributorName: name.trim(),
          contributorEmail: email.trim()
        })
      });

      const data = await response.json();

      if (data.error) {
        showToast(data.error || 'Failed to create payment session', 'error');
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error('Payment error:', err);
      showToast('Network error. Please check your connection and try again.', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Contribute</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-lg mb-2 text-gray-900">{item.title}</h4>
          <div className="text-sm text-gray-700 space-y-1">
            <p>Price: <span className="font-semibold text-gray-900">${(item.price_cents / 100).toFixed(2)}</span></p>
            <p>Already raised: <span className="font-semibold text-gray-900">${(item.current_amount_cents / 100).toFixed(2)}</span></p>
            <p className="text-green-700 font-semibold">Remaining: ${remaining.toFixed(2)}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-900">Quick Select:</label>
          <div className="grid grid-cols-4 gap-2">
            {suggestedAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                className="py-2 border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition font-semibold text-gray-900"
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setAmount(remaining.toFixed(2))}
              className="py-2 border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-400 transition font-semibold text-gray-900"
            >
              Full
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-900">Amount (USD) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            placeholder="25.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-900">Your Name *</label>
          <input
            type="text"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-900">Email (optional)</label>
          <input
            type="email"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleContribute}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Processing...' : 'Continue to Payment'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import supabase from "../../lib/supabase";

export default function JoinEventPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code;

  const [event, setEvent] = useState(null);
  const [ownerName, setOwnerName] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Check auth state and fetch event preview
  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
        }

        // Fetch event preview
        const response = await fetch(`/api/events/join/${code}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invalid invite link");
          setLoading(false);
          return;
        }

        setEvent(data.event);
        setOwnerName(data.event.owner_name || "Unknown");
      } catch (err) {
        console.error("Error loading event:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    if (code) {
      initialize();
    }

    // Listen for auth changes (for when user returns from login)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (authEvent, session) => {
        if (authEvent === "SIGNED_IN" && session?.user) {
          setUser(session.user);
          // User can now click "Join This Event" button manually
        }
      }
    );

    return () => {
      listener.subscription?.unsubscribe?.();
    };
  }, [code]);

  // Handle join event
  async function handleJoin(currentUser = user) {
    if (!currentUser) {
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(`/join/${code}`);
      router.push(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/join/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.error === "Already a member" || data.error?.includes("already")) {
          setSuccess("You're already a member of this event!");
          setTimeout(() => {
            router.push(`/event/${event.slug}`);
          }, 1500);
          return;
        }
        if (data.error === "You are the owner of this event" || data.error?.includes("owner")) {
          setSuccess("This is your event!");
          setTimeout(() => {
            router.push(`/event/${event.slug}`);
          }, 1500);
          return;
        }
        setError(data.error || "Failed to join event");
        return;
      }

      setSuccess("Successfully joined! Redirecting...");
      setTimeout(() => {
        router.push(`/event/${data.slug || event.slug}`);
      }, 1500);
    } catch (err) {
      console.error("Error joining event:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  // Handle login redirect
  function handleLoginRedirect() {
    const returnUrl = encodeURIComponent(`/join/${code}`);
    router.push(`/login?returnUrl=${returnUrl}`);
  }

  // Format date nicely
  function formatDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-lg font-medium text-gray-900">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid link)
  if (error && !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-900 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // Main invite page
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            You're Invited! 🎉
          </h1>
          <p className="text-gray-900">You've been invited to join an event on Memora</p>
        </div>

        {/* Event Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-purple-100">
          {/* Event Header */}
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-6 text-white">
            <h2 className="text-2xl font-bold mb-1">{event?.title}</h2>
            <p className="text-white/80 text-sm">Hosted by {ownerName}</p>
          </div>

          {/* Event Details */}
          <div className="p-6 space-y-4">
            {/* Date */}
            {event?.event_date && (
              <div className="flex items-center gap-3 text-gray-900">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-900">Event Date</p>
                  <p className="font-semibold">{formatDate(event.event_date)}</p>
                </div>
              </div>
            )}

            {/* Host */}
            <div className="flex items-center gap-3 text-gray-900">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-900">Hosted by</p>
                <p className="font-semibold">{ownerName}</p>
              </div>
            </div>

            {/* Description */}
            {event?.description && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-gray-900 text-sm leading-relaxed">{event.description}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-6 pt-0 space-y-3">
            {user ? (
              /* Logged in - Show Join Button */
              <button
                onClick={() => handleJoin()}
                disabled={joining || success}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {joining ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Joining...
                  </>
                ) : success ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Joined!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Join This Event
                  </>
                )}
              </button>
            ) : (
              /* Not logged in - Show Login Button */
              <>
                <button
                  onClick={handleLoginRedirect}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Login to Join
                </button>
                <p className="text-center text-sm text-gray-900">
                  Don't have an account?{" "}
                  <button
                    onClick={handleLoginRedirect}
                    className="text-purple-600 font-semibold hover:underline"
                  >
                    Sign up for free
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-gray-900 hover:text-purple-600 text-sm font-medium transition"
          >
            Memora - Gift Registry Platform
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "../lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);

  // Fetch user session on mount and redirect if not logged in
  useEffect(() => {
    let ignore = false;

    async function getUserSession() {
      try {
        // Check if this is a redirect from OAuth (mobile compatibility)
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth');
        
        // If auth success param exists, wait a bit for cookies to be set (mobile fix)
        if (authSuccess === 'success') {
          // Clean URL
          window.history.replaceState({}, '', '/dashboard');
          // Small delay to ensure cookies are processed on mobile
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Get the current session first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        
        if (ignore) return;
        
        // If no session, redirect to login
        if (!session?.user) {
          router.replace("/login");
          return;
        }
        
        // Try to refresh the session to ensure it's still valid
        // This will use the refresh token if the access token is expired
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (ignore) return;
        
        // Use refreshed session if available, otherwise use original session
        const currentSession = refreshData?.session || session;
        
        if (!currentSession?.user) {
          router.replace("/login");
          return;
        }
        
        setUser(currentSession.user);

        // Fetch all events
        fetchEvents(currentSession.user.id);
      } catch (error) {
        console.error('Error getting session:', error);
        if (!ignore) {
          router.replace("/login");
        }
      }
    }

    getUserSession();

    // Listen for auth changes to handle sign out and token refresh
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (ignore) return;
        
        if (event === "SIGNED_OUT") {
          router.replace("/login");
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // Session was refreshed, update user and refetch events
          setUser(session.user);
          fetchEvents(session.user.id);
        } else if (event === "SIGNED_IN" && session?.user) {
          // User signed in, update user and fetch events
          setUser(session.user);
          fetchEvents(session.user.id);
        }
      }
    );

    return () => {
      ignore = true;
      listener.subscription?.unsubscribe?.();
    };
    // We want router to be available always
    // eslint-disable-next-line
  }, []);

  async function fetchEvents(userId) {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Verify session is still valid before fetching
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Session expired, redirect to login
        router.replace("/login");
        setLoading(false);
        return;
      }

      // Fetch only the user's events
      const { data, error } = await supabase
        .from("events")
        .select("id, title, slug, event_date, description, items(current_amount_cents)")
        .eq("user_id", userId)
        .order("event_date", { ascending: false });

      if (error) {
        console.error('Error fetching events:', error);
        // If it's an auth error, try refreshing session
        if (error.message?.includes('JWT') || error.message?.includes('token') || error.message?.includes('expired')) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session?.user) {
            // Retry with refreshed session
            const { data: retryData, error: retryError } = await supabase
              .from("events")
              .select("id, title, slug, event_date, description, items(current_amount_cents)")
              .eq("user_id", refreshData.session.user.id)
              .order("event_date", { ascending: false });
            
            if (retryError) {
              setEvents([]);
              setLoading(false);
              return;
            }
            
            const mapped = (retryData || []).map((event) => {
              const items = event.items || [];
              const totalRaised = items.reduce(
                (sum, item) => sum + (item.current_amount_cents || 0),
                0
              );
              return {
                ...event,
                totalRaised,
                itemCount: items.length,
              };
            });
            
            setEvents(mapped);
            setLoading(false);
            return;
          } else {
            // Session refresh failed, redirect to login
            router.replace("/login");
            setLoading(false);
            return;
          }
        }
        
        setEvents([]);
        setLoading(false);
        return;
      }

      // Calculate total raised per event and item count
      const mapped = (data || []).map((event) => {
        const items = event.items || [];
        const totalRaised = items.reduce(
          (sum, item) => sum + (item.current_amount_cents || 0),
          0
        );
        return {
          ...event,
          totalRaised,
          itemCount: items.length,
        };
      });

      setEvents(mapped);
    } catch (error) {
      console.error('Unexpected error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // Handle delete event
  const handleDeleteClick = (event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete || !user) return;

    setDeletingEventId(eventToDelete.id);
    
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventToDelete.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting event:", error);
        alert("Failed to delete event. Please try again.");
        setDeletingEventId(null);
        return;
      }

      // Remove event from local state
      setEvents(events.filter((e) => e.id !== eventToDelete.id));
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      setDeletingEventId(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event. Please try again.");
      setDeletingEventId(null);
    }
  };

  // Handle card click to navigate to event
  const handleCardClick = (slug) => {
    router.push(`/event/${slug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            {user && (
              <p className="text-gray-600 text-sm mt-1">{user.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/create-event"
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition"
            >
              Create New Event
            </Link>
            <button
              onClick={handleSignOut}
              className="bg-red-500 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="text-lg font-medium text-gray-700 animate-pulse">
              Loading events...
            </div>
          </div>
        ) : (
          <>
            {/* No events state */}
            {events.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  No events found
                </h2>
                <p className="text-gray-500 mb-4">
                  No events found.
                </p>
                <Link
                  href="/create-event"
                  className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition"
                >
                  Create Your First Event
                </Link>
              </div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white shadow-md rounded-lg p-6 flex flex-col justify-between relative cursor-pointer hover:shadow-lg transition"
                      onClick={() => handleCardClick(event.slug)}
                    >
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(event);
                        }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-lg transition z-10"
                        title="Delete event"
                        disabled={deletingEventId === event.id}
                      >
                        ×
                      </button>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">
                          {event.title}
                        </h3>
                        <p className="text-gray-500 text-sm mb-3">
                          {event.event_date
                            ? new Date(event.event_date).toLocaleDateString()
                            : "No date"}
                        </p>
                        <p className="text-gray-600 mb-4">
                          {event.description || <span className="italic text-gray-400">No description.</span>}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between mt-2">
                        <div className="flex flex-col">
                          <span className="text-green-600 font-semibold">
                            ${ (event.totalRaised / 100).toFixed(2) }
                          </span>
                          <span className="text-xs text-gray-500">
                            Total Raised
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-800 font-semibold">
                            {event.itemCount}
                          </span>
                          <span className="text-xs text-gray-500">
                            Item{event.itemCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delete Confirmation Dialog */}
                {deleteDialogOpen && eventToDelete && (
                  <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={handleCloseDeleteDialog}
                  >
                    <div 
                      className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Event</h3>
                      <p className="text-gray-600 mb-4">
                        Are you sure you want to delete <span className="font-semibold">"{eventToDelete.title}"</span>? 
                        This action cannot be undone and will delete all associated items and contributions.
                      </p>
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={handleCloseDeleteDialog}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition"
                          disabled={deletingEventId === eventToDelete.id}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
                          disabled={deletingEventId === eventToDelete.id}
                        >
                          {deletingEventId === eventToDelete.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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

  // Fetch user session on mount and redirect if not logged in
  useEffect(() => {
    let ignore = false;

    async function getUserSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (ignore) return;
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setUser(session.user);

      // Fetch all events
      fetchEvents(session.user.id);
    }

    getUserSession();

    // Listen for auth changes to handle sign out in another window/tab
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          router.replace("/login");
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
    setLoading(true);
    // Fetch only the user's events
    const { data, error } = await supabase
      .from("events")
      .select("id, title, slug, event_date, description, items(current_amount_cents)")
      .eq("user_id", userId)
      .order("event_date", { ascending: false });

    if (error) {
      setEvents([]);
      setLoading(false);
      return;
    }

    // Calculate total raised per event and item count
    const mapped = data.map((event) => {
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
  }

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
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
              <div className="grid gap-6 md:grid-cols-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white shadow-md rounded-lg p-6 flex flex-col justify-between"
                  >
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
                      <Link
                        href={`/event/${event.slug}`}
                        className="ml-auto bg-blue-100 text-blue-700 px-4 py-2 rounded-md font-semibold hover:bg-blue-200 transition text-sm"
                      >
                        View Event
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

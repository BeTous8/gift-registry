"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "../lib/supabase";
import LocationSearchModal from "../components/LocationSearchModal";

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("gift-registry");
  const [location, setLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  // Generate URL slug from title: lowercase, replace spaces with hyphens, add timestamp for uniqueness
  function generateSlug(title) {
    if (!title) return "";
    // Convert to lowercase, replace spaces with hyphens, remove special characters
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    
    // Add timestamp for uniqueness
    const timestamp = Date.now();
    return `${baseSlug}-${timestamp}`;
  }

  // Generate a unique random invite code (12 characters: alphanumeric)
 function generateInviteCode() {
   const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
   let code = '';
   for (let i = 0; i < 12; i++) {
     code += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return code;
 }

  // Check if user is logged in and redirect if not
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
    }

    getUserSession();

    // Listen for auth changes to handle sign out in another window/tab
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          router.replace("/login");
        }
      }
    );

    return () => {
      ignore = true;
      listener.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!user) {
      setError("You must be logged in to create an event");
      setLoading(false);
      return;
    }

    // Generate slug from title
    const slug = generateSlug(title);
    const inviteCode = generateInviteCode();

    // DEBUG: Log values before insert
    console.log('=== CREATE EVENT DEBUG ===');
    console.log('eventType state:', eventType);
    console.log('location state:', location);
    console.log('Data being sent to database:', {
      user_id: user.id,
      title: title.trim(),
      slug: slug,
      description: description.trim() || null,
      event_date: date || null,
      event_type: eventType,
      invite_code: inviteCode,
      location: location || null,
    });

    // Insert event into database
    const { data, error: insertError } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        title: title.trim(),
        slug: slug,
        description: description.trim() || null,
        event_date: date || null,
        event_type: eventType,
        invite_code: inviteCode,
        location: location || null, // Store location as JSONB
        slug: slug,
        invite_code: inviteCode,
      })
      .select()
      .single();

    console.log('Insert result:', { data, error: insertError });

    setLoading(false);

    if (insertError) {
      setError(insertError.message || "Failed to create event. Please try again.");
      return;
    }


    router.refresh();
    // Success - redirect to dashboard
    router.push(`/event/${slug}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-4 px-4">
      <div className="bg-white shadow-2xl rounded-2xl px-6 sm:px-8 py-6 max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-50 transition border border-blue-200"
          >
            ← Dashboard
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">Create Event</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="title">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Enter event title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900">
                Event Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Gift Registry Card */}
                <button
                  type="button"
                  onClick={() => setEventType("gift-registry")}
                  className={`relative p-4 rounded-2xl border-3 transition-all transform hover:scale-105 ${
                    eventType === "gift-registry"
                      ? "border-purple-500 bg-gradient-to-br from-pink-50 to-rose-50 shadow-lg ring-2 ring-purple-500"
                      : "border-gray-200 bg-white hover:border-purple-300 hover:shadow-md"
                  }`}
                >
                  {/* Selected checkmark */}
                  {eventType === "gift-registry" && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Image illustration */}
                  <div className="mb-3 flex justify-center">
                    <img
                      src="/special-ceremony.png"
                      alt="Special Ceremony"
                      className="w-40 h-40 object-contain rounded-2xl"
                    />
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1">Special Ceremony</h3>
                  <p className="text-xs text-gray-600">Birthday, Wedding, etc.</p>
                </button>

                {/* Casual Meetup Card */}
                <button
                  type="button"
                  onClick={() => setEventType("casual-meetup")}
                  className={`relative p-4 rounded-2xl border-3 transition-all transform hover:scale-105 ${
                    eventType === "casual-meetup"
                      ? "border-teal-500 bg-gradient-to-br from-teal-50 to-cyan-50 shadow-lg ring-2 ring-teal-500"
                      : "border-gray-200 bg-white hover:border-teal-300 hover:shadow-md"
                  }`}
                >
                  {/* Selected checkmark */}
                  {eventType === "casual-meetup" && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Image illustration */}
                  <div className="mb-3 flex justify-center">
                    <img
                      src="/casual-meetup.png"
                      alt="Casual Meet-up"
                      className="w-40 h-40 object-contain rounded-2xl"
                    />
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1">Casual Meet-up</h3>
                  <p className="text-xs text-gray-600">Coffee, Hangout, Book Club</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="date">
                Event Date
              </label>
              <input
                id="date"
                type="date"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                rows={2}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter event description (optional)"
              />
            </div>

            {/* Location field - only for casual meetups */}
            {eventType === "casual-meetup" && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Location
                </label>
                {location ? (
                  <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{location.name}</p>
                        <p className="text-sm text-gray-800 truncate">{location.formatted_address}</p>
                        {location.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-sm text-gray-900">{location.rating}</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocation(null)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-400 hover:bg-blue-50 transition text-gray-800 hover:text-blue-600 font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Add Location
                  </button>
                )}
                <p className="text-xs text-gray-900 mt-1">
                  Add a venue or meeting place for your casual meetup
                </p>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 border-2 border-red-200 p-4 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? "Creating Event..." : "Create Event"}
            </button>
        </form>
      </div>

      {/* Location Search Modal */}
      {showLocationModal && (
        <LocationSearchModal
          onClose={() => setShowLocationModal(false)}
          onLocationSelected={(locationData) => {
            setLocation(locationData);
            setShowLocationModal(false);
          }}
        />
      )}
    </div>
  );
}


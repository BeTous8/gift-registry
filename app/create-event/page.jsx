"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="bg-white shadow-md rounded-lg px-10 py-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Event</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="title">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Enter event title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="eventType">
                Event Type <span className="text-red-500">*</span>
              </label>
              <select
                id="eventType"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                required
              >
                <option value="gift-registry">Gift Registry</option>
                <option value="casual-meetup">Casual Meetup</option>
              </select>
              <p className="text-xs text-gray-700 mt-1">
                {eventType === "gift-registry"
                  ? "Create a wishlist with items for contributions"
                  : "Organize a casual gathering with location details"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="date">
                Event Date
              </label>
              <input
                id="date"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200 resize-vertical"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter event description (optional)"
              />
            </div>

            {/* Location field - only for casual meetups */}
            {eventType === "casual-meetup" && (
              <div>
                <label className="block text-sm font-medium mb-1">
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
                            <span className="text-sm text-gray-700">{location.rating}</span>
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
                <p className="text-xs text-gray-700 mt-1">
                  Add a venue or meeting place for your casual meetup
                </p>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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


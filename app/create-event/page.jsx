"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../lib/supabase";

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
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

    // Insert event into database
    const { data, error: insertError } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        title: title.trim(),
        slug: slug,
        description: description.trim() || null,
        event_date: date || null,
      })
      .select()
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message || "Failed to create event. Please try again.");
      return;
    }

    // Success - redirect to dashboard
    router.push(`/event/${slug}/edit`);
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
    </div>
  );
}


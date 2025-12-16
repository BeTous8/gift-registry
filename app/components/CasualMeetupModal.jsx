"use client";

import { useState } from "react";
import LocationSearchModal from "./LocationSearchModal";
import InviteFromContactsModal from "./InviteFromContactsModal";
import supabase from "../lib/supabase";

/**
 * Simplified modal for creating casual meetups
 * Includes: Title, Date, Location, and Quick Invite flow
 * No gift registry - just calendar events
 */
export default function CasualMeetupModal({ onClose, onSuccess }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // After event creation, show invite flow
  const [createdEvent, setCreatedEvent] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Generate URL slug from title: lowercase, replace spaces with hyphens, add timestamp for uniqueness
  function generateSlug(title) {
    if (!title) return "";
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError("You must be logged in to create an event");
        setLoading(false);
        return;
      }

      // Generate slug and invite code
      const slug = generateSlug(title);
      const inviteCode = generateInviteCode();

      // Insert casual event
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({
          user_id: session.user.id,
          title: title.trim(),
          slug: slug,
          description: null,
          event_date: date || null,
          event_category: "casual",
          invite_code: inviteCode,
          location: location || null,
          is_recurring: false,
          registry_enabled: false,
          is_private: false
        })
        .select()
        .single();

      setLoading(false);

      if (insertError) {
        setError(insertError.message || "Failed to create event. Please try again.");
        return;
      }

      // Event created - now show invite modal
      setCreatedEvent(data);
      setShowInviteModal(true);
    } catch (err) {
      console.error("Error creating casual meetup:", err);
      setError("Failed to create event. Please try again.");
      setLoading(false);
    }
  };

  const handleInviteSuccess = (message) => {
    // Invites sent, close everything
    onSuccess(createdEvent);
    onClose();
  };

  const handleSkipInvite = () => {
    // User chose to skip inviting
    onSuccess(createdEvent);
    onClose();
  };

  // If we're in invite step, show the invite modal
  if (showInviteModal && createdEvent) {
    return (
      <>
        <InviteFromContactsModal
          isOpen={true}
          onClose={handleSkipInvite}
          eventId={createdEvent.id}
          eventTitle={createdEvent.title}
          onInviteSuccess={handleInviteSuccess}
        />
        {/* Skip button overlay */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60]">
          <button
            onClick={handleSkipInvite}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-medium transition shadow-lg"
          >
            Skip for now
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white shadow-2xl rounded-2xl px-6 sm:px-8 py-6 max-w-lg w-full max-h-[95vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Casual Meet-up
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 border-2 border-red-200 p-4 rounded-lg">
                {error}
              </div>
            )}

            {/* Event Title */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="title">
                What's the plan? <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Coffee catch-up, Dinner, Book club..."
              />
            </div>

            {/* Event Date */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="date">
                When? <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900">
                Where?
              </label>
              {location ? (
                <div className="border-2 border-teal-200 rounded-lg p-3 bg-teal-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{location.name}</p>
                      <p className="text-sm text-gray-700 truncate">{location.formatted_address}</p>
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
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition text-gray-700 hover:text-teal-600 font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Add Location
                </button>
              )}
            </div>

            {/* Add to Calendar */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={addToCalendar}
                  onChange={(e) => setAddToCalendar(e.target.checked)}
                  className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                />
                <span className="font-medium text-gray-900 group-hover:text-teal-600 transition">
                  Add to my calendar
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-3 rounded-xl font-bold hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-4"
              disabled={loading || !title.trim() || !date}
            >
              {loading ? "Creating..." : "Create & Invite Friends"}
            </button>
          </form>
        </div>
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
    </>
  );
}

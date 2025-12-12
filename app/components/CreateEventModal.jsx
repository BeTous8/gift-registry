"use client";

import { useState } from "react";
import LocationSearchModal from "./LocationSearchModal";
import supabase from "../lib/supabase";

/**
 * Unified Event Creation Modal
 * Combines gift registry creation with calendar options
 * Used by both Dashboard and Calendar pages for consistency
 *
 * @param {string} defaultMode - "registry" (from Dashboard) or "calendar" (from Calendar page)
 * @param {function} onClose - Function to call when modal is closed
 * @param {function} onSuccess - Function to call when event is created successfully
 * @param {object} prefillData - Optional data to prefill the form
 */
export default function CreateEventModal({ defaultMode = "registry", onClose, onSuccess, prefillData = {} }) {
  const [title, setTitle] = useState(prefillData.title || "");
  const [date, setDate] = useState(prefillData.event_date || "");
  const [description, setDescription] = useState(prefillData.description || "");
  const [eventType, setEventType] = useState(prefillData.event_type || "gift-registry");
  const [location, setLocation] = useState(prefillData.location || null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Calendar options - default based on mode
  const [addToCalendar, setAddToCalendar] = useState(
    prefillData.add_to_calendar !== undefined
      ? prefillData.add_to_calendar
      : defaultMode === "calendar" // Calendar mode: calendar ON by default
  );
  const [isRecurring, setIsRecurring] = useState(prefillData.is_recurring || false);

  // Registry option - default based on mode
  const [registryEnabled, setRegistryEnabled] = useState(
    prefillData.registry_enabled !== undefined
      ? prefillData.registry_enabled
      : defaultMode === "registry" // Registry mode: registry ON by default
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  // Handle form submission
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

      // Generate slug and invite code only if registry enabled
      const slug = registryEnabled ? generateSlug(title) : null;
      const inviteCode = registryEnabled ? generateInviteCode() : null;

      // Map event type to event category for unified events table
      const eventCategory = eventType === "gift-registry" ? "other" : "casual";

      // Insert event into database
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({
          user_id: session.user.id,
          title: title.trim(),
          slug: slug,
          description: description.trim() || null,
          event_date: date || null,
          event_category: eventCategory,
          invite_code: inviteCode,
          location: location || null,
          is_recurring: addToCalendar ? isRecurring : false,
          registry_enabled: registryEnabled,
          is_private: false // Default to public
        })
        .select()
        .single();

      setLoading(false);

      if (insertError) {
        setError(insertError.message || "Failed to create event. Please try again.");
        return;
      }

      // Success - call onSuccess callback and close modal
      onSuccess(data);
      onClose();
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white shadow-2xl rounded-2xl px-6 sm:px-8 py-6 max-w-4xl w-full max-h-[95vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Create New Event
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

            {/* Event Type Selection with PNG Images */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900">
                Event Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Special Ceremony Card */}
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

            {/* Event Date */}
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

            {/* Description */}
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

            {/* Location field */}
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
                Add a venue or meeting place for your event
              </p>
            </div>

            {/* Calendar Options Section */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>📅</span> Calendar Options
              </h3>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={addToCalendar}
                  onChange={(e) => {
                    setAddToCalendar(e.target.checked);
                    if (!e.target.checked) {
                      setIsRecurring(false);
                    }
                  }}
                  className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900 group-hover:text-purple-600 transition">
                    Add to my personal calendar
                  </span>
                  <p className="text-sm text-gray-600 mt-0.5">
                    This event will appear in your calendar view
                  </p>
                </div>
              </label>

              {/* Recurring Option (only if calendar enabled) */}
              {addToCalendar && (
                <div className="ml-8 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900 group-hover:text-purple-600 transition">
                        Repeat yearly
                      </span>
                      <p className="text-sm text-gray-600 mt-0.5">
                        Perfect for birthdays and anniversaries
                      </p>
                    </div>
                  </label>

                  {isRecurring && date && (
                    <p className="text-sm text-purple-600 ml-8">
                      Will remind you every year on {new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Gift Registry Options Section */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>🎁</span> Gift Registry Options
              </h3>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={registryEnabled}
                  onChange={(e) => setRegistryEnabled(e.target.checked)}
                  className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900 group-hover:text-purple-600 transition">
                    Create gift registry
                  </span>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Friends can contribute to gift items for this event
                  </p>
                </div>
              </label>

              {registryEnabled && (
                <p className="text-sm text-gray-600 ml-8">
                  You'll be able to add gift items and invite friends after creating the event
                </p>
              )}
            </div>

            {/* Validation Warning */}
            {!addToCalendar && !registryEnabled && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Please select at least one: Add to calendar OR Create gift registry
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading || (!addToCalendar && !registryEnabled)}
            >
              {loading ? "Creating Event..." : "Create Event"}
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

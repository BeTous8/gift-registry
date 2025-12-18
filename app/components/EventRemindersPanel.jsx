"use client";

import { useState, useEffect } from "react";
import supabase from "../lib/supabase";

/**
 * EventRemindersPanel - UI for managing event reminders
 * Only visible to event owner
 * Max 2 reminders per event
 *
 * @param {string} eventId - The event UUID
 * @param {string} eventDate - The event date (YYYY-MM-DD)
 * @param {boolean} isOwner - Whether current user is the event owner
 */
export default function EventRemindersPanel({ eventId, eventDate, isOwner }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // New reminder form state
  const [selectedType, setSelectedType] = useState("");
  const [sendToMembers, setSendToMembers] = useState(true);

  // Reminder type options
  const reminderOptions = [
    { value: '1_hour', label: '1 hour before' },
    { value: '2_hours', label: '2 hours before' },
    { value: '1_day', label: '1 day before' },
    { value: '2_days', label: '2 days before' },
    { value: '3_days', label: '3 days before' },
    { value: '1_week', label: '1 week before' },
    { value: '2_weeks', label: '2 weeks before' },
    { value: '1_month', label: '1 month before' },
  ];

  // Fetch reminders on mount
  useEffect(() => {
    if (isOwner && eventId) {
      fetchReminders();
    } else {
      setLoading(false);
    }
  }, [eventId, isOwner]);

  async function fetchReminders() {
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/events/${eventId}/reminders`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReminders(data.reminders || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load reminders');
      }
    } catch (err) {
      console.error('Error fetching reminders:', err);
      setError('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddReminder(e) {
    e.preventDefault();
    if (!selectedType) return;

    setSaving(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be logged in');
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/events/${eventId}/reminders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reminder_type: selectedType,
          send_to_members: sendToMembers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReminders([...reminders, data.reminder]);
        setSelectedType("");
        setSendToMembers(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create reminder');
      }
    } catch (err) {
      console.error('Error creating reminder:', err);
      setError('Failed to create reminder');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteReminder(reminderId) {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/events/${eventId}/reminders?reminder_id=${reminderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setReminders(reminders.filter(r => r.id !== reminderId));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete reminder');
      }
    } catch (err) {
      console.error('Error deleting reminder:', err);
      setError('Failed to delete reminder');
    }
  }

  // Get label for reminder type
  function getReminderLabel(type) {
    const option = reminderOptions.find(o => o.value === type);
    return option ? option.label : type;
  }

  // Format scheduled time
  function formatScheduledTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // Filter out reminder types already used
  const availableOptions = reminderOptions.filter(
    opt => !reminders.some(r => r.reminder_type === opt.value)
  );

  // Don't render if not owner
  if (!isOwner) return null;

  // Don't render if no event date
  if (!eventDate) {
    return (
      <div className="bg-[var(--buttercream-100)] border border-[var(--buttercream-200)] rounded-xl p-4">
        <p className="text-sm text-[var(--charcoal-800)]">
          Set an event date to enable reminders.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-[var(--lavender-200)] p-4">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-[var(--lavender-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <h3 className="font-semibold text-[var(--charcoal-900)]">Event Reminders</h3>
        <span className="text-xs text-[var(--charcoal-800)] ml-auto">
          {reminders.length}/2 set
        </span>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-[var(--lavender-200)] border-t-[var(--lavender-500)] rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Existing Reminders */}
          {reminders.length > 0 && (
            <div className="space-y-2 mb-4">
              {reminders.map(reminder => (
                <div
                  key={reminder.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    reminder.is_sent
                      ? 'bg-[var(--mint-100)] border border-[var(--mint-200)]'
                      : 'bg-[var(--lavender-50)] border border-[var(--lavender-100)]'
                  }`}
                >
                  <div>
                    <p className="font-medium text-[var(--charcoal-900)] text-sm">
                      {getReminderLabel(reminder.reminder_type)}
                    </p>
                    <p className="text-xs text-[var(--charcoal-800)]">
                      {reminder.is_sent ? (
                        <span className="text-[var(--mint-400)]">Sent</span>
                      ) : (
                        <>Scheduled: {formatScheduledTime(reminder.scheduled_for)}</>
                      )}
                    </p>
                    <p className="text-xs text-[var(--charcoal-800)]">
                      {reminder.send_to_members ? 'All guests' : 'Just you'}
                    </p>
                  </div>
                  {!reminder.is_sent && (
                    <button
                      onClick={() => handleDeleteReminder(reminder.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"
                      title="Delete reminder"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Reminder Form */}
          {reminders.length < 2 && (
            <form onSubmit={handleAddReminder} className="space-y-3">
              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--lavender-200)] rounded-lg focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent bg-white"
                >
                  <option value="">Select reminder time...</option>
                  {availableOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendToMembers}
                  onChange={(e) => setSendToMembers(e.target.checked)}
                  className="w-4 h-4 text-[var(--lavender-500)] border-[var(--lavender-200)] rounded focus:ring-[var(--lavender-400)]"
                />
                <span className="text-[var(--charcoal-900)]">Send to all guests</span>
              </label>

              <button
                type="submit"
                disabled={!selectedType || saving}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] rounded-lg hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Adding...' : 'Add Reminder'}
              </button>
            </form>
          )}

          {reminders.length === 2 && (
            <p className="text-xs text-center text-[var(--charcoal-800)]">
              Maximum 2 reminders per event
            </p>
          )}
        </>
      )}
    </div>
  );
}

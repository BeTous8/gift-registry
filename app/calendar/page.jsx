"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../lib/supabase";
import Link from "next/link";
import CreateEventModal from "../components/CreateEventModal";
import CasualMeetupModal from "../components/CasualMeetupModal";
import EventCategoryModal from "../components/EventCategoryModal";

/**
 * Sanitizes text for safe display (XSS prevention)
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeForDisplay(text) {
  if (!text) return '';
  // Remove any HTML tags and encode special characters
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCasualMeetupModal, setShowCasualMeetupModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // For prefilling date when clicking a day
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_type: 'ceremony',
    is_recurring: false
  });
  const [submitting, setSubmitting] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch events when month changes
  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [currentDate, user]);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvents() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const response = await fetch(
        `/api/calendar/events?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }

  function goToPreviousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  }

  function goToNextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  }

  function getMonthDays() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const startOffset = firstDay.getDay();

    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day);
    }

    return days;
  }

  function getEventsForDay(day) {
    if (!day) return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];

    return events.filter(event => {
      const eventDate = event.display_date || event.event_date;
      return eventDate === dateStr;
    });
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowAddModal(false);
        setFormData({
          title: '',
          description: '',
          event_date: '',
          event_type: 'ceremony',
          is_recurring: false
        });
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditEvent(e) {
    e.preventDefault();
    if (!selectedEvent) return;

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedEvent(null);
        setFormData({
          title: '',
          description: '',
          event_date: '',
          event_type: 'ceremony',
          is_recurring: false
        });
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  }

  function openEditModal(event) {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      event_type: event.event_type,
      is_recurring: event.is_recurring
    });
    setShowEditModal(true);
  }

  // Handle clicking on a date square to create event
  function handleDateClick(day) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    setSelectedDate(dateStr);
    setShowCategoryModal(true); // Show category selection first
  }

  const monthDays = getMonthDays();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--lavender-50)] via-[var(--peach-100)] to-[var(--mint-100)]">
        <div className="w-12 h-12 border-4 border-[var(--lavender-200)] border-t-[var(--lavender-500)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--lavender-50)] via-[var(--peach-100)] to-[var(--mint-100)] p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-[var(--lavender-600)] hover:text-[var(--lavender-700)] text-sm font-medium mb-2 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[var(--lavender-500)] via-[var(--peach-400)] to-[var(--mint-400)] bg-clip-text text-transparent">
              Calendar
            </h1>
            <p className="text-[var(--charcoal-900)] text-sm mt-1">Track important dates and events</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-[var(--lavender-200)]">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-[var(--lavender-50)] text-[var(--charcoal-900)] transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-[var(--charcoal-900)]">{monthName}</h2>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-[var(--lavender-50)] text-[var(--charcoal-900)] transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="text-center font-semibold text-[var(--charcoal-900)] text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {monthDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dayEvents = getEventsForDay(day);
            const isToday =
              day === new Date().getDate() &&
              currentDate.getMonth() === new Date().getMonth() &&
              currentDate.getFullYear() === new Date().getFullYear();

            return (
              <div
                key={day}
                onClick={() => handleDateClick(day)}
                className={`
                  aspect-square border rounded-lg p-2 overflow-hidden
                  ${isToday ? 'border-[var(--lavender-500)] bg-[var(--lavender-50)]' : 'border-gray-200 hover:border-[var(--lavender-300)] hover:bg-[var(--lavender-50)]'}
                  transition cursor-pointer
                `}
              >
                <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-[var(--lavender-700)]' : 'text-[var(--charcoal-900)]'}`}>
                  {day}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-20">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent date click when clicking event
                        openEditModal(event);
                      }}
                      className={`
                        text-xs px-2 py-1 rounded cursor-pointer truncate
                        ${event.event_type === 'ceremony'
                          ? 'bg-[var(--lavender-100)] text-[var(--lavender-700)] hover:bg-[var(--lavender-200)]'
                          : 'bg-[var(--mint-100)] text-[var(--charcoal-900)] hover:bg-[var(--mint-200)]'}
                      `}
                      title={sanitizeForDisplay(event.title)}
                    >
                      {sanitizeForDisplay(event.title)}
                      {event.is_recurring && ' 🔄'}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Event Category Selection Modal */}
      {showCategoryModal && (
        <EventCategoryModal
          selectedDate={selectedDate}
          onClose={() => {
            setShowCategoryModal(false);
            setSelectedDate(null);
          }}
          onSelectSpecial={() => {
            setShowCategoryModal(false);
            setShowAddModal(true); // Open CreateEventModal for special events
          }}
          onSelectCasual={() => {
            setShowCategoryModal(false);
            setShowCasualMeetupModal(true); // Open CasualMeetupModal
          }}
        />
      )}

      {/* Add Event Modal (Special Events) */}
      {showAddModal && (
        <CreateEventModal
          defaultMode="calendar"
          prefillData={selectedDate ? { event_date: selectedDate } : {}}
          onClose={() => {
            setShowAddModal(false);
            setSelectedDate(null);
          }}
          onSuccess={(newEvent) => {
            fetchEvents();
            setSelectedDate(null);
          }}
        />
      )}

      {/* Casual Meetup Modal */}
      {showCasualMeetupModal && (
        <CasualMeetupModal
          prefillData={selectedDate ? { event_date: selectedDate } : {}}
          onClose={() => {
            setShowCasualMeetupModal(false);
            setSelectedDate(null);
          }}
          onSuccess={(newEvent) => {
            fetchEvents();
            setSelectedDate(null);
          }}
        />
      )}

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-[var(--charcoal-900)] mb-4">Edit Event</h2>
            <form onSubmit={handleEditEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-1">Title *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-1">Description</label>
                <textarea
                  maxLength={1000}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.event_date}
                  onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-1">Event Type *</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent"
                >
                  <option value="ceremony">Important (Birthday, Anniversary)</option>
                  <option value="casual">Casual (Meetup, Coffee)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({...formData, is_recurring: e.target.checked})}
                  className="w-4 h-4 text-[var(--lavender-500)] border-[var(--lavender-200)] rounded focus:ring-[var(--lavender-400)]"
                />
                <label htmlFor="edit_is_recurring" className="text-sm text-[var(--charcoal-900)]">
                  Repeat yearly
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-[var(--lavender-200)] rounded-lg text-[var(--charcoal-900)] hover:bg-[var(--lavender-50)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white rounded-lg hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

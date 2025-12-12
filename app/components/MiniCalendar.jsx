"use client";

import { useEffect, useState } from "react";
import supabase from "../lib/supabase";
import Link from "next/link";

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

export default function MiniCalendar({ sidebarOpen }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch events for the current month
  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  async function fetchEvents() {
    try {
      setLoading(true);

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Calculate start and end of month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      // Fetch events from API
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
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  }

  // Navigate to previous month
  function goToPreviousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  }

  // Navigate to next month
  function goToNextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  }

  // Get all days for current month
  function getMonthDays() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];

    // Add empty slots for days before month starts (offset by day of week)
    const startOffset = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day);
    }

    return days;
  }

  // Get events for a specific day
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

  const monthDays = getMonthDays();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Collapsed view (when sidebar is closed)
  if (!sidebarOpen) {
    return (
      <div className="p-4 border-t border-b border-purple-100">
        <Link
          href="/calendar"
          className="flex justify-center p-2 rounded-lg hover:bg-purple-50 transition"
          title="Calendar"
        >
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </Link>
      </div>
    );
  }

  // Full mini-calendar view
  return (
    <div className="p-4 border-t border-b border-purple-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousMonth}
          className="p-1 rounded-md hover:bg-purple-50 text-gray-900 transition"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Link
          href="/calendar"
          className="text-sm font-semibold text-gray-900 hover:text-purple-600 transition"
        >
          {monthName}
        </Link>
        <button
          onClick={goToNextMonth}
          className="p-1 rounded-md hover:bg-purple-50 text-gray-900 transition"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-900">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayEvents = getEventsForDay(day);
          // Check for registry events (purple) and calendar events by category
          const hasRegistry = dayEvents.some(e => e.registry_enabled);
          const hasImportant = dayEvents.some(e =>
            !e.registry_enabled && ['other', 'birthday', 'anniversary', 'wedding'].includes(e.event_category)
          );
          const hasCasual = dayEvents.some(e => !e.registry_enabled && e.event_category === 'casual');
          const isToday =
            day === new Date().getDate() &&
            currentDate.getMonth() === new Date().getMonth() &&
            currentDate.getFullYear() === new Date().getFullYear();

          return (
            <div
              key={day}
              className={`
                aspect-square flex flex-col items-center justify-center text-xs rounded-md
                ${isToday ? 'bg-purple-100 font-bold' : 'hover:bg-purple-50'}
                transition cursor-pointer relative
              `}
              title={dayEvents.map(e => sanitizeForDisplay(e.title)).join(', ')}
            >
              <span className="text-gray-900">{day}</span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasRegistry && (
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Gift Registry" />
                  )}
                  {hasImportant && (
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500" title="Important Event" />
                  )}
                  {hasCasual && (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Casual Event" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-purple-100 space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-900">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Gift Registry</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-900">
          <div className="w-2 h-2 rounded-full bg-pink-500" />
          <span>Important</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-900">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Casual</span>
        </div>
      </div>

      {/* Link to full calendar */}
      <Link
        href="/calendar"
        className="mt-3 block text-center text-xs text-purple-600 hover:text-purple-700 font-medium"
      >
        View Full Calendar →
      </Link>
    </div>
  );
}

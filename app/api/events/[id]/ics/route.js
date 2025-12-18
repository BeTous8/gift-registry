import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Escape special characters for ICS format
 */
function escapeICS(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Format date as YYYYMMDD for ICS (all-day event)
 */
function formatICSDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
}

/**
 * Format ISO datetime as ICS datetime
 */
function formatICSDateTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * GET /api/events/[id]/ics
 * Generate downloadable .ics file for calendar import
 */
export async function GET(request, { params }) {
  const { id: eventId } = await params;

  try {
    // Fetch event details (public - no auth required for downloading .ics)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, description, event_date, location, slug, created_at')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.event_date) {
      return NextResponse.json({ error: 'Event has no date set' }, { status: 400 });
    }

    // Generate unique ID for the event
    const uid = `${event.id}@mymemoraapp.com`;

    // Format dates
    const dtStart = formatICSDate(event.event_date);
    // For all-day events, DTEND is the next day
    const endDate = new Date(event.event_date);
    endDate.setDate(endDate.getDate() + 1);
    const dtEnd = endDate.toISOString().split('T')[0].replace(/-/g, '');

    const dtstamp = formatICSDateTime(event.created_at || new Date().toISOString());

    // Format event details
    const summary = escapeICS(event.title);
    const description = escapeICS(event.description || '');
    const location = event.location
      ? escapeICS(event.location.formatted_address || event.location.name || '')
      : '';

    // Build event URL
    const eventUrl = event.slug
      ? `https://memoraapp.netlify.app/event/${event.slug}`
      : '';

    // Add URL to description if available
    const fullDescription = eventUrl
      ? `${description}${description ? '\\n\\n' : ''}View on Memora: ${eventUrl}`
      : description;

    // Generate ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Memora//Event Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${summary}`,
      fullDescription ? `DESCRIPTION:${fullDescription}` : null,
      location ? `LOCATION:${location}` : null,
      eventUrl ? `URL:${eventUrl}` : null,
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    // Generate safe filename
    const safeFilename = event.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50) || 'event';

    // Return as downloadable .ics file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('ICS generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client using the Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to detect meeting type from URL
function detectMeetingType(url) {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoom.com')) return 'zoom';
  if (lowerUrl.includes('meet.google.com')) return 'google_meet';
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) return 'teams';
  return 'other';
}

/**
 * PATCH /api/events/[id]
 * Updates an event's non-item-related details (currently location and theme).
 * This endpoint requires authentication to ensure only the event owner can modify the event.
 */
export async function PATCH(request, { params }) {
  // Next.js 15+ requires awaiting params
  const { id: eventId } = await params;

  try {
    const {
      title,
      description,
      event_date,
      event_time,
      event_type,
      location,
      theme,
      is_recurring,
      registry_enabled,
      event_category,
      online_meeting_url
    } = await request.json();

    // 1. Extract JWT from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or invalid' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // 2. Get the user object from the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
        return NextResponse.json({ error: 'User not authenticated or token expired' }, { status: 401 });
    }
    const userId = user.id;

    // 3. Build the update payload dynamically
    const updatePayload = {};
    if (title !== undefined) {
      updatePayload.title = title ? title.trim() : null;
    }
    if (description !== undefined) {
      updatePayload.description = description ? description.trim() : null;
    }
    if (event_date !== undefined) updatePayload.event_date = event_date || null;
    if (event_time !== undefined) updatePayload.event_time = event_time || null;
    if (location !== undefined) updatePayload.location = location;
    if (theme !== undefined) updatePayload.theme = theme;
    if (is_recurring !== undefined) updatePayload.is_recurring = is_recurring;
    if (registry_enabled !== undefined) updatePayload.registry_enabled = registry_enabled;

    // Map event_type to event_category if provided
    if (event_type !== undefined) {
      updatePayload.event_category = event_type === "gift-registry" ? "other" : "casual";
    } else if (event_category !== undefined) {
      updatePayload.event_category = event_category;
    }

    // Handle online meeting URL for casual meetups
    if (online_meeting_url !== undefined) {
      if (online_meeting_url && online_meeting_url.trim()) {
        // Validate URL format
        try {
          new URL(online_meeting_url.trim());
          updatePayload.online_meeting_url = online_meeting_url.trim();
          updatePayload.online_meeting_type = detectMeetingType(online_meeting_url.trim());
        } catch (e) {
          return NextResponse.json({ error: 'Invalid meeting URL format' }, { status: 400 });
        }
      } else {
        // Allow clearing the meeting URL
        updatePayload.online_meeting_url = null;
        updatePayload.online_meeting_type = null;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    // 4. Execute the update using the Service Role Key
    // We filter by both the event ID and the user_id to ensure only the owner can make the change.
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .eq('user_id', userId) // Crucial security check: Must be the owner
      .select()
      .single();

    if (updateError) {
      console.error('Supabase Update Error:', updateError);
      return NextResponse.json({ error: updateError.message || 'Failed to update event details' }, { status: 500 });
    }
    
    if (!updatedEvent) {
      // This happens if the user ID did not match the owner ID for that event ID
      return NextResponse.json({ error: 'Permission denied or event not found.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
    }, { status: 200 });

  } catch (error) {
    console.error('API Error during event PATCH:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Validates if a date string is both correctly formatted AND represents a valid date
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} - True if valid date
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  // Check format first
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  // Parse and validate the date actually exists
  const date = new Date(dateString + 'T00:00:00Z'); // Force UTC
  const [year, month, day] = dateString.split('-').map(Number);

  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/**
 * PUT /api/calendar/events/[id]
 * Updates an existing calendar event
 *
 * Request body (all fields optional):
 * {
 *   title?: string (1-200 chars)
 *   description?: string (0-1000 chars)
 *   event_date?: string (ISO date)
 *   event_type?: 'ceremony' | 'casual'
 *   is_recurring?: boolean
 * }
 */
export async function PUT(request, { params }) {
  try {
    // 1. Authenticate user and create user-scoped client
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create a Supabase client with the user's token (enforces RLS)
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 2. Get event ID from params
    const eventId = params.id;

    // 3. Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json(
        { error: 'Invalid event ID format' },
        { status: 400 }
      );
    }

    // 4. Verify event exists and user owns it (RLS enforces ownership)
    const { data: existingEvent, error: fetchError } = await supabaseUser
      .from('events')
      .select('id, user_id, registry_enabled')
      .eq('id', eventId)
      .eq('registry_enabled', false)  // Only allow calendar events
      .single();

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (existingEvent.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this event' },
        { status: 403 }
      );
    }

    // 5. Parse request body
    const body = await request.json();
    const updates = {};

    // 6. Validate and build updates object
    if (body.title !== undefined) {
      if (body.title.trim().length === 0 || body.title.length > 200) {
        return NextResponse.json(
          { error: 'Title must be between 1 and 200 characters' },
          { status: 400 }
        );
      }
      updates.title = body.title.trim();
    }

    if (body.description !== undefined) {
      if (body.description && body.description.length > 1000) {
        return NextResponse.json(
          { error: 'Description cannot exceed 1000 characters' },
          { status: 400 }
        );
      }
      updates.description = body.description?.trim() || null;
    }

    if (body.event_date !== undefined) {
      if (!isValidDate(body.event_date)) {
        return NextResponse.json(
          { error: 'Invalid date format or date does not exist. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
      updates.event_date = body.event_date;
    }

    if (body.event_type !== undefined) {
      if (!['ceremony', 'casual'].includes(body.event_type)) {
        return NextResponse.json(
          { error: 'event_type must be either "ceremony" or "casual"' },
          { status: 400 }
        );
      }
      // Map old event_type to new event_category
      updates.event_category = body.event_type === 'ceremony' ? 'other' : 'casual';
    }

    if (body.is_recurring !== undefined) {
      if (typeof body.is_recurring !== 'boolean') {
        return NextResponse.json(
          { error: 'is_recurring must be a boolean' },
          { status: 400 }
        );
      }
      updates.is_recurring = body.is_recurring;
    }

    // 7. Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // 8. Update event in database (RLS enforces ownership)
    const { data: updatedEvent, error: updateError } = await supabaseUser
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .eq('user_id', user.id) // Double-check ownership
      .eq('registry_enabled', false)  // Only update calendar events
      .select()
      .single();

    if (updateError) {
      console.error('Event update error:', {
        userId: user.id,
        eventId: eventId,
        error: updateError,
        code: updateError.code,
        details: updateError.details
      });
      return NextResponse.json(
        { error: 'Failed to update event. Please try again.' },
        { status: 500 }
      );
    }

    // 9. Return updated event
    return NextResponse.json({
      success: true,
      event: updatedEvent
    });

  } catch (error) {
    console.error('Calendar PUT error:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calendar/events/[id]
 * Deletes a calendar event
 */
export async function DELETE(request, { params }) {
  try {
    // 1. Authenticate user and create user-scoped client
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create a Supabase client with the user's token (enforces RLS)
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 2. Get event ID from params
    const eventId = params.id;

    // 3. Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json(
        { error: 'Invalid event ID format' },
        { status: 400 }
      );
    }

    // 4. Verify event exists and user owns it (RLS enforces ownership)
    const { data: existingEvent, error: fetchError } = await supabaseUser
      .from('events')
      .select('id, user_id, title, registry_enabled')
      .eq('id', eventId)
      .eq('registry_enabled', false)  // Only allow deleting calendar events
      .single();

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (existingEvent.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this event' },
        { status: 403 }
      );
    }

    // 5. Delete event from database (RLS enforces ownership)
    const { error: deleteError } = await supabaseUser
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', user.id) // Double-check ownership
      .eq('registry_enabled', false);  // Only delete calendar events

    if (deleteError) {
      console.error('Event deletion error:', {
        userId: user.id,
        eventId: eventId,
        error: deleteError,
        code: deleteError.code,
        details: deleteError.details
      });
      return NextResponse.json(
        { error: 'Failed to delete event. Please try again.' },
        { status: 500 }
      );
    }

    // 6. Return success response
    return NextResponse.json({
      success: true,
      message: `Event "${existingEvent.title}" deleted successfully`
    });

  } catch (error) {
    console.error('Calendar DELETE error:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Valid reminder types
const VALID_REMINDER_TYPES = [
  '1_hour', '2_hours', '1_day', '2_days', '3_days', '1_week', '2_weeks', '1_month'
];

// Calculate scheduled_for timestamp based on event date and reminder type
function calculateScheduledFor(eventDate, reminderType) {
  if (!eventDate) return null;

  // Parse event date and set to 9am (default event time)
  const eventTimestamp = new Date(eventDate + 'T09:00:00');

  const intervals = {
    '1_hour': 1 * 60 * 60 * 1000,
    '2_hours': 2 * 60 * 60 * 1000,
    '1_day': 24 * 60 * 60 * 1000,
    '2_days': 2 * 24 * 60 * 60 * 1000,
    '3_days': 3 * 24 * 60 * 60 * 1000,
    '1_week': 7 * 24 * 60 * 60 * 1000,
    '2_weeks': 14 * 24 * 60 * 60 * 1000,
    '1_month': 30 * 24 * 60 * 60 * 1000,
  };

  const interval = intervals[reminderType] || 0;
  return new Date(eventTimestamp.getTime() - interval).toISOString();
}

/**
 * GET /api/events/[id]/reminders
 * List all reminders for an event (owner only)
 */
export async function GET(request, { params }) {
  const { id: eventId } = await params;

  try {
    // Extract JWT from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or invalid' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Get user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Verify user owns the event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, user_id, event_date')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.user_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Fetch reminders for this event
    const { data: reminders, error: fetchError } = await supabaseAdmin
      .from('event_reminders')
      .select('*')
      .eq('event_id', eventId)
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
    }

    return NextResponse.json({ reminders, eventDate: event.event_date }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/events/[id]/reminders
 * Create a new reminder (max 2 per event)
 */
export async function POST(request, { params }) {
  const { id: eventId } = await params;

  try {
    const { reminder_type, send_to_members = true } = await request.json();

    // Validate reminder_type
    if (!reminder_type || !VALID_REMINDER_TYPES.includes(reminder_type)) {
      return NextResponse.json({
        error: `Invalid reminder_type. Must be one of: ${VALID_REMINDER_TYPES.join(', ')}`
      }, { status: 400 });
    }

    // Extract JWT from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or invalid' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Get user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Verify user owns the event and get event date
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, user_id, event_date')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.user_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    if (!event.event_date) {
      return NextResponse.json({ error: 'Cannot set reminder for event without a date' }, { status: 400 });
    }

    // Check existing reminder count
    const { count, error: countError } = await supabaseAdmin
      .from('event_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (countError) {
      console.error('Error checking reminder count:', countError);
      return NextResponse.json({ error: 'Failed to check reminder count' }, { status: 500 });
    }

    if (count >= 2) {
      return NextResponse.json({ error: 'Maximum 2 reminders per event allowed' }, { status: 400 });
    }

    // Calculate scheduled_for timestamp
    const scheduled_for = calculateScheduledFor(event.event_date, reminder_type);

    // Check if reminder would be in the past
    if (new Date(scheduled_for) < new Date()) {
      return NextResponse.json({
        error: 'Cannot set reminder for a time that has already passed'
      }, { status: 400 });
    }

    // Create the reminder
    const { data: reminder, error: insertError } = await supabaseAdmin
      .from('event_reminders')
      .insert({
        event_id: eventId,
        reminder_type,
        send_to_members: Boolean(send_to_members),
        scheduled_for,
        is_sent: false
      })
      .select()
      .single();

    if (insertError) {
      // Check for duplicate constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'A reminder with this timing already exists for this event'
        }, { status: 400 });
      }
      console.error('Error creating reminder:', insertError);
      return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
    }

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/events/[id]/reminders
 * Delete a reminder by reminder_id (passed in query string)
 */
export async function DELETE(request, { params }) {
  const { id: eventId } = await params;
  const { searchParams } = new URL(request.url);
  const reminderId = searchParams.get('reminder_id');

  if (!reminderId) {
    return NextResponse.json({ error: 'reminder_id is required' }, { status: 400 });
  }

  try {
    // Extract JWT from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or invalid' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Get user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Verify user owns the event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, user_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.user_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete the reminder
    const { error: deleteError } = await supabaseAdmin
      .from('event_reminders')
      .delete()
      .eq('id', reminderId)
      .eq('event_id', eventId); // Double-check it belongs to this event

    if (deleteError) {
      console.error('Error deleting reminder:', deleteError);
      return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

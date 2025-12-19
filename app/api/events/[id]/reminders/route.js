import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Valid reminder units
const VALID_REMINDER_UNITS = ['minutes', 'hours', 'days', 'weeks'];

// Legacy reminder types (for backwards compatibility)
const VALID_REMINDER_TYPES = [
  '1_hour', '2_hours', '1_day', '2_days', '3_days', '1_week', '2_weeks', '1_month'
];

// Milliseconds per unit
const MS_PER_UNIT = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000
};

// Convert legacy reminder_type to amount and unit
function legacyTypeToAmountUnit(reminderType) {
  const mapping = {
    '1_hour': { amount: 1, unit: 'hours' },
    '2_hours': { amount: 2, unit: 'hours' },
    '1_day': { amount: 1, unit: 'days' },
    '2_days': { amount: 2, unit: 'days' },
    '3_days': { amount: 3, unit: 'days' },
    '1_week': { amount: 1, unit: 'weeks' },
    '2_weeks': { amount: 2, unit: 'weeks' },
    '1_month': { amount: 30, unit: 'days' } // Approximate 1 month as 30 days
  };
  return mapping[reminderType] || { amount: 1, unit: 'days' };
}

/**
 * Get the timezone offset in minutes for a given timezone at a specific date
 * @param {Date} date - The date to check
 * @param {string} timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns {number} Offset in minutes (positive = behind UTC, negative = ahead)
 */
function getTimezoneOffset(date, timezone) {
  // Get the date formatted in UTC
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  // Get the date formatted in the target timezone
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  // Return the difference in minutes
  return (utcDate - tzDate) / (60 * 1000);
}

/**
 * Calculate scheduled_for timestamp (timezone-aware)
 * @param {string} eventDate - YYYY-MM-DD format
 * @param {string|null} eventTime - HH:MM:SS format or null
 * @param {number} reminderAmount - Number of units before event
 * @param {string} reminderUnit - 'minutes', 'hours', 'days', or 'weeks'
 * @param {string} timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns {Date} The scheduled reminder time in UTC
 */
function calculateScheduledFor(eventDate, eventTime, reminderAmount, reminderUnit, timezone = 'America/Los_Angeles') {
  // Parse date and time components
  const [year, month, day] = eventDate.split('-').map(Number);
  const timeStr = eventTime || '09:00:00';
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);

  // Create a date in UTC with the event's date/time values
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  // Get the timezone offset for this date in the event's timezone
  // This handles DST correctly by checking at the specific date
  const offsetMinutes = getTimezoneOffset(utcDate, timezone);

  // Adjust: if the event is at "3pm LA time", we need to add the offset to get UTC
  // LA is UTC-8, so 3pm LA = 11pm UTC (add 8 hours)
  const eventTimestamp = new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);

  // Subtract reminder interval
  const intervalMs = reminderAmount * MS_PER_UNIT[reminderUnit];
  return new Date(eventTimestamp.getTime() - intervalMs);
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
 * Accepts either:
 *   - reminder_amount (integer) + reminder_unit ('minutes'|'hours'|'days'|'weeks')
 *   - reminder_type (legacy format like '1_hour', '1_day', etc.)
 */
export async function POST(request, { params }) {
  const { id: eventId } = await params;

  try {
    const { reminder_amount, reminder_unit, reminder_type, send_to_members = true } = await request.json();

    // Validate - either new format (amount + unit) or legacy format (type)
    const usingNewFormat = reminder_amount !== undefined && reminder_unit !== undefined;
    const usingLegacyFormat = reminder_type !== undefined;

    if (!usingNewFormat && !usingLegacyFormat) {
      return NextResponse.json({
        error: 'Either reminder_amount+reminder_unit or reminder_type is required'
      }, { status: 400 });
    }

    if (usingNewFormat) {
      // Validate new format
      if (!Number.isInteger(reminder_amount) || reminder_amount < 1) {
        return NextResponse.json({
          error: 'reminder_amount must be a positive integer'
        }, { status: 400 });
      }
      if (!VALID_REMINDER_UNITS.includes(reminder_unit)) {
        return NextResponse.json({
          error: `Invalid reminder_unit. Must be one of: ${VALID_REMINDER_UNITS.join(', ')}`
        }, { status: 400 });
      }
    } else {
      // Validate legacy format
      if (!VALID_REMINDER_TYPES.includes(reminder_type)) {
        return NextResponse.json({
          error: `Invalid reminder_type. Must be one of: ${VALID_REMINDER_TYPES.join(', ')}`
        }, { status: 400 });
      }
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

    // Verify user owns the event and get event date/time/timezone
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, user_id, event_date, event_time, timezone')
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

    // Check existing reminder count (also enforced by DB trigger)
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

    // Determine reminder amount and unit (convert legacy format if needed)
    let finalAmount, finalUnit;
    if (usingNewFormat) {
      finalAmount = reminder_amount;
      finalUnit = reminder_unit;
    } else {
      const converted = legacyTypeToAmountUnit(reminder_type);
      finalAmount = converted.amount;
      finalUnit = converted.unit;
    }

    // Calculate scheduled_for in JavaScript (timezone-aware)
    const scheduledFor = calculateScheduledFor(
      event.event_date,
      event.event_time,
      finalAmount,
      finalUnit,
      event.timezone || 'America/Los_Angeles' // Fallback for existing events without timezone
    );

    // Validate reminder is not in the past
    if (scheduledFor < new Date()) {
      return NextResponse.json({
        error: 'Cannot set reminder for a time that has already passed'
      }, { status: 400 });
    }

    // Build the reminder data
    const reminderData = {
      event_id: eventId,
      send_to_members: Boolean(send_to_members),
      scheduled_for: scheduledFor.toISOString(),
      is_sent: false
    };

    if (usingNewFormat) {
      reminderData.reminder_amount = reminder_amount;
      reminderData.reminder_unit = reminder_unit;
    } else {
      reminderData.reminder_type = reminder_type;
    }

    // Create the reminder
    const { data: reminder, error: insertError } = await supabaseAdmin
      .from('event_reminders')
      .insert(reminderData)
      .select()
      .single();

    if (insertError) {
      // Check for duplicate constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'A reminder with this timing already exists for this event'
        }, { status: 400 });
      }
      // Check for trigger-raised exceptions (past reminder, no event date)
      if (insertError.message?.includes('already passed')) {
        return NextResponse.json({
          error: 'Cannot set reminder for a time that has already passed'
        }, { status: 400 });
      }
      if (insertError.message?.includes('without a date')) {
        return NextResponse.json({
          error: 'Cannot set reminder for event without a date'
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

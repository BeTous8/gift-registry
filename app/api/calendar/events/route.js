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
 * GET /api/calendar/events
 * Fetches user's calendar events for a given date range
 * Handles both one-time and recurring events
 *
 * Query params:
 * - startDate: ISO date string (e.g., '2025-12-01')
 * - endDate: ISO date string (e.g., '2025-12-31')
 */
export async function GET(request) {
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

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // 3. Validate date format and validity
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format or date does not exist. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // 4. Validate date range (prevent DoS with unbounded queries)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);

    if (daysDiff > 366) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 366 days' },
        { status: 400 }
      );
    }

    if (daysDiff < 0) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // 5. Call database function to get events (handles recurring logic)
    // RLS enforced automatically via user token
    const { data: events, error: eventsError } = await supabaseUser.rpc(
      'get_user_events_in_range',
      {
        p_user_id: user.id,
        p_start_date: startDate,
        p_end_date: endDate
      }
    );

    if (eventsError) {
      console.error('Error fetching events:', {
        userId: user.id,
        error: eventsError,
        startDate,
        endDate
      });
      return NextResponse.json(
        { error: 'Failed to fetch events. Please try again.' },
        { status: 500 }
      );
    }

    // 6. Return events
    return NextResponse.json({
      events: events || [],
      count: events?.length || 0
    });

  } catch (error) {
    console.error('Calendar GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/events
 * Creates a new calendar event
 *
 * Request body:
 * {
 *   title: string (1-200 chars, required)
 *   description: string (0-1000 chars, optional)
 *   event_date: string (ISO date, required)
 *   event_type: 'ceremony' | 'casual' (required)
 *   is_recurring: boolean (required)
 * }
 */
export async function POST(request) {
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

    // 2. Parse request body
    const body = await request.json();
    const { title, description, event_date, event_type, is_recurring } = body;

    // 3. Validate required fields
    if (!title || !event_date || !event_type || typeof is_recurring !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: title, event_date, event_type, is_recurring' },
        { status: 400 }
      );
    }

    // 4. Validate title length
    if (title.trim().length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 200 characters' },
        { status: 400 }
      );
    }

    // 5. Validate description length
    if (description && description.length > 1000) {
      return NextResponse.json(
        { error: 'Description cannot exceed 1000 characters' },
        { status: 400 }
      );
    }

    // 6. Validate event_type
    if (!['ceremony', 'casual'].includes(event_type)) {
      return NextResponse.json(
        { error: 'event_type must be either "ceremony" or "casual"' },
        { status: 400 }
      );
    }

    // 7. Validate date format AND existence
    if (!isValidDate(event_date)) {
      return NextResponse.json(
        { error: 'Invalid date format or date does not exist. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // 8. Map old event_type to new event_category
    const event_category = event_type === 'ceremony' ? 'other' : 'casual';

    // 9. Insert event into unified events table
    // RLS INSERT policy will verify user_id matches auth.uid()
    const { data: newEvent, error: insertError } = await supabaseUser
      .from('events')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        event_date,
        event_category,  // Use new unified category
        is_recurring,
        registry_enabled: false  // Calendar-only event
      })
      .select()
      .single();

    if (insertError) {
      console.error('Event creation error:', {
        userId: user.id,
        error: insertError,
        code: insertError.code,
        details: insertError.details
      });
      return NextResponse.json(
        { error: 'Failed to create event. Please try again.' },
        { status: 500 }
      );
    }

    // 10. Return created event
    return NextResponse.json({
      success: true,
      event: newEvent
    }, { status: 201 });

  } catch (error) {
    console.error('Calendar POST error:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client using the Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * PATCH /api/events/[id]
 * Updates an event's non-item-related details (currently location and theme).
 * This endpoint requires authentication to ensure only the event owner can modify the event.
 */
export async function PATCH(request, { params }) {
  // Next.js 15+ requires awaiting params
  const { id: eventId } = await params;

  try {
    const { location, theme } = await request.json();

    // 1. Get the current authenticated user (owner)
    // NOTE: This assumes the user's session token is passed in the request headers
    // and you are verifying it, or you are using the public client to get the session.
    // For simplicity and relying on the `user_id` check below (Service Role is admin),
    // we'll primarily focus on authorizing the user via RLS if possible, but the owner check is vital.
    
    // As a best practice, fetch the user from the headers if possible.
    // However, since we are using the admin client, we must verify ownership first.

    // 2. Extract JWT from headers (assuming it's present for authorization context)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or invalid' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // 3. Get the user object from the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
        return NextResponse.json({ error: 'User not authenticated or token expired' }, { status: 401 });
    }
    const userId = user.id;

    // 4. Build the update payload dynamically
    const updatePayload = {};
    if (location !== undefined) {
      updatePayload.location = location;
    }
    if (theme !== undefined) {
      updatePayload.theme = theme;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    // 5. Execute the update using the Service Role Key
    // We filter by both the event ID and the user_id to ensure only the owner can make the change.
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .eq('user_id', userId) // Crucial security check: Must be the owner
      .select('id, title, location, event_type, theme')
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
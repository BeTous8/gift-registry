import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Get event details by invite code (for join page preview)
export async function GET(request, { params }) {
  try {
    const { code } = await params;

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('id, title, description, event_date, user_id, slug')
      .eq('invite_code', code)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Get owner details
    const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(event.user_id);
    const ownerName = ownerData?.user?.user_metadata?.full_name ||
      ownerData?.user?.user_metadata?.name ||
      ownerData?.user?.email?.split('@')[0] ||
      'Someone';

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        slug: event.slug,
        owner_name: ownerName
      }
    });

  } catch (error) {
    console.error('Get event by code error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Join event via invite code
export async function POST(request, { params }) {
  try {
    const { code } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Must be logged in to join' }, { status: 401 });
    }

    // Get event by invite code
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, user_id, slug')
      .eq('invite_code', code)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if user is the owner
    if (event.user_id === userId) {
      return NextResponse.json({ error: 'You are the owner of this event' }, { status: 400 });
    }

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from('event_members')
      .select('id')
      .eq('event_id', event.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({
        error: 'You are already a member of this event',
        eventId: event.id
      }, { status: 400 });
    }

    // Add user as member
    const { error: memberError } = await supabaseAdmin
      .from('event_members')
      .insert({
        event_id: event.id,
        user_id: userId
      });

    if (memberError) {
      console.error('Error adding member:', memberError);
      return NextResponse.json({ error: 'Failed to join event' }, { status: 500 });
    }

    // Get user email for notification
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;

    // Check if there's a pending invitation and mark it as accepted
    if (userEmail) {
      await supabaseAdmin
        .from('event_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('event_id', event.id)
        .eq('email', userEmail.toLowerCase());
    }

    // TODO: Send email notification to event owner

    return NextResponse.json({
      success: true,
      eventId: event.id,
      eventTitle: event.title,
      slug: event.slug,
      message: 'Successfully joined the event!'
    });

  } catch (error) {
    console.error('Join event error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

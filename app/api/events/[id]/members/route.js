import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - List all members of an event
export async function GET(request, { params }) {
  try {
    const { id: eventId } = await params;

    // Get event to check if it exists and get owner
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, user_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get all members with user details
    const { data: members, error: membersError } = await supabaseAdmin
      .from('event_members')
      .select('id, user_id, joined_at')
      .eq('event_id', eventId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Get user details for each member (fetch only specific users, not all)
    let usersMap = {};
    if (members.length > 0) {
      const userPromises = members.map(m =>
        supabaseAdmin.auth.admin.getUserById(m.user_id)
      );
      const userResults = await Promise.all(userPromises);

      userResults.forEach(result => {
        if (result.data?.user) {
          const user = result.data.user;
          usersMap[user.id] = {
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
          };
        }
      });
    }

    // Get owner details
    const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(event.user_id);
    const owner = ownerData?.user ? {
      id: ownerData.user.id,
      email: ownerData.user.email,
      name: ownerData.user.user_metadata?.full_name || ownerData.user.user_metadata?.name || ownerData.user.email?.split('@')[0]
    } : null;

    // Combine member data with user details
    const membersWithDetails = members.map(member => ({
      ...member,
      email: usersMap[member.user_id]?.email || 'Unknown',
      name: usersMap[member.user_id]?.name || 'Unknown'
    }));

    return NextResponse.json({
      owner,
      members: membersWithDetails
    });

  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a member from an event (owner only)
export async function DELETE(request, { params }) {
  try {
    const { id: eventId } = await params;
    const { userId, memberUserId } = await request.json();

    if (!userId || !memberUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('user_id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Allow owner to remove anyone, or allow user to remove themselves
    if (event.user_id !== userId && userId !== memberUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Remove the member
    const { error: deleteError } = await supabaseAdmin
      .from('event_members')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', memberUserId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Member removed' });

  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Respond to an invitation (accept or decline)
export async function POST(request, { params }) {
  try {
    const { id: invitationId } = await params;
    const { userId, response } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });
    }

    if (!response || !['accepted', 'declined'].includes(response)) {
      return NextResponse.json({ error: 'Invalid response' }, { status: 400 });
    }

    // Get user email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!userData?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userEmail = userData.user.email.toLowerCase();

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('event_invitations')
      .select('*, events(id, title, user_id)')
      .eq('id', invitationId)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify this invitation belongs to the user
    if (invitation.email.toLowerCase() !== userEmail) {
      return NextResponse.json({ error: 'This invitation is not for you' }, { status: 403 });
    }

    // Check if already responded
    if (invitation.status !== 'pending') {
      return NextResponse.json({
        error: `Invitation already ${invitation.status}`,
        status: invitation.status
      }, { status: 400 });
    }

    // Update invitation status
    const { error: updateError } = await supabaseAdmin
      .from('event_invitations')
      .update({
        status: response,
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
    }

    // If accepted, add user as member
    if (response === 'accepted') {
      const { error: memberError } = await supabaseAdmin
        .from('event_members')
        .insert({
          event_id: invitation.event_id,
          user_id: userId
        });

      if (memberError) {
        // If duplicate, that's okay
        if (!memberError.message?.includes('duplicate')) {
          console.error('Error adding member:', memberError);
        }
      }
    }

    // TODO: Send email notification to event owner about the response

    return NextResponse.json({
      success: true,
      response,
      eventId: invitation.event_id,
      eventTitle: invitation.events?.title,
      message: response === 'accepted'
        ? 'You have joined the event!'
        : 'Invitation declined'
    });

  } catch (error) {
    console.error('Respond to invitation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

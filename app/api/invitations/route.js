import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - List all pending invitations for the current user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get user email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userEmail = userData.user.email.toLowerCase();

    // Get all pending invitations for this email
    const { data: invitations, error: inviteError } = await supabaseAdmin
      .from('event_invitations')
      .select(`
        id,
        event_id,
        status,
        created_at,
        events (
          id,
          title,
          description,
          event_date,
          slug,
          user_id
        )
      `)
      .eq('email', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (inviteError) {
      console.error('Error fetching invitations:', inviteError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Get owner names for each invitation
    const invitationsWithOwners = await Promise.all(
      invitations.map(async (invite) => {
        if (!invite.events) return invite;

        const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(invite.events.user_id);
        const ownerName = ownerData?.user?.user_metadata?.full_name ||
          ownerData?.user?.user_metadata?.name ||
          ownerData?.user?.email?.split('@')[0] ||
          'Someone';

        return {
          ...invite,
          events: {
            ...invite.events,
            owner_name: ownerName
          }
        };
      })
    );

    return NextResponse.json({ invitations: invitationsWithOwners });

  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

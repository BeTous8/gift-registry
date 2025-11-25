import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// DELETE - Delete an invitation (owner only)
export async function DELETE(request, { params }) {
  try {
    const { id: invitationId } = await params;

    // Delete the invitation
    const { error } = await supabaseAdmin
      .from('event_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      console.error('Error deleting invitation:', error);
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Invitation deleted' });

  } catch (error) {
    console.error('Delete invitation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

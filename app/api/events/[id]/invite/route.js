import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Service role client for privileged operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get Resend client (initialized at runtime)
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return null;
  }
  return new Resend(apiKey);
}

export async function POST(request, { params }) {
  try {
    const { id: eventId } = await params;
    const { email, userId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Verify the user owns this event and get full event details
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, user_id, invite_code, event_date, description')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get owner's name for the email
    const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(event.user_id);
    const ownerName = ownerData?.user?.user_metadata?.full_name
      || ownerData?.user?.user_metadata?.name
      || ownerData?.user?.email?.split('@')[0]
      || 'Someone';

    // Check if invitation already exists
    const { data: existingInvite } = await supabaseAdmin
      .from('event_invitations')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json({
        error: `Invitation already ${existingInvite.status}`,
        status: existingInvite.status
      }, { status: 400 });
    }

    // Check if user is already a member
    const { data: existingMembers } = await supabaseAdmin
      .from('event_members')
      .select('id, user_id')
      .eq('event_id', eventId);

    // Get user by email to check membership
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const inviteeUser = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (inviteeUser && existingMembers?.some(m => m.user_id === inviteeUser.id)) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    // Create the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('event_invitations')
      .insert({
        event_id: eventId,
        email: email.toLowerCase(),
        status: 'pending'
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Send email notification via Resend
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memoraapp.netlify.app';
    const joinUrl = `${siteUrl}/join/${event.invite_code}`;
    const eventDate = event.event_date
      ? new Date(event.event_date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : null;

    const resend = getResendClient();
    if (!resend) {
      console.error('Resend client not available - skipping email');
    } else {
      try {
        await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Memora <onboarding@resend.dev>',
        to: email.toLowerCase(),
        subject: `${ownerName} invited you to ${event.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px;">
                <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
                  <h1 style="color: #1f2937; margin: 0; font-size: 24px; font-weight: 600;">Event Invitation</h1>
                </div>

                <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
                  Hello,
                </p>

                <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                  <strong>${ownerName}</strong> has invited you to their event on Memora.
                </p>

                <div style="background-color: #f3f4f6; border-left: 3px solid #3b82f6; padding: 16px; margin-bottom: 24px;">
                  <h2 style="color: #1f2937; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">${event.title}</h2>
                  ${eventDate ? `<p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">Date: ${eventDate}</p>` : ''}
                  ${event.description ? `<p style="color: #6b7280; margin: 0; font-size: 14px;">${event.description}</p>` : ''}
                </div>

                <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                  Click the link below to view the event details and gift registry.
                </p>

                <div style="margin-bottom: 24px;">
                  <a href="${joinUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">View Invitation</a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin: 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                  If the button does not work, copy and paste this link into your browser:<br>
                  <a href="${joinUrl}" style="color: #3b82f6; word-break: break-all;">${joinUrl}</a>
                </p>
              </div>

              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
                Sent via Memora - <a href="${siteUrl}" style="color: #3b82f6; text-decoration: none;">${siteUrl}</a>
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
Hello,

${ownerName} has invited you to their event on Memora.

Event Details:
${event.title}
${eventDate ? `Date: ${eventDate}` : ''}
${event.description ? `\n${event.description}` : ''}

View the event and gift registry by clicking this link:
${joinUrl}

---
Sent via Memora - ${siteUrl}
        `.trim(),
        });
        console.log('Invitation email sent to:', email);
      } catch (emailError) {
        // Log the error but don't fail the invitation
        console.error('Error sending invitation email:', emailError);
        // Invitation was still created, so we continue
      }
    }

    return NextResponse.json({
      success: true,
      invitation,
      message: 'Invitation sent successfully'
    });

  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - List all invitations for an event (owner only)
export async function GET(request, { params }) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('user_id')
      .eq('id', eventId)
      .single();

    if (!event || event.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get all invitations
    const { data: invitations, error } = await supabaseAdmin
      .from('event_invitations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({ invitations });

  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Helper function to get Resend client (runtime initialization)
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(apiKey);
}

// POST - Invite multiple contacts to an event
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: eventId } = await params;
    const { contact_ids } = await request.json();

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'contact_ids array is required' },
        { status: 400 }
      );
    }

    // Fetch event details and verify ownership
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, user_id, title, slug, invite_code')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only event owner can invite contacts' },
        { status: 403 }
      );
    }

    // Get owner details for email sender name
    const { data: ownerData } = await supabase.auth.admin.getUserById(user.id);
    const ownerMetadata = ownerData?.user?.user_metadata || {};
    const ownerFirstName = ownerMetadata.given_name ||
                          ownerMetadata.full_name?.split(' ')[0] ||
                          user.email?.split('@')[0] ||
                          'Someone';

    // Fetch contacts details
    const { data: contacts, error: contactsError } = await supabase
      .from('user_contacts')
      .select('id, contact_user_id')
      .in('id', contact_ids)
      .eq('user_id', user.id);

    if (contactsError || !contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found' },
        { status: 404 }
      );
    }

    const results = {
      invited: [],
      already_invited: [],
      already_member: [],
      failed: []
    };

    // Process each contact
    for (const contact of contacts) {
      try {
        // Get contact user details
        const { data: contactUserData } = await supabase.auth.admin.getUserById(contact.contact_user_id);
        const contactUser = contactUserData?.user;

        if (!contactUser || !contactUser.email) {
          results.failed.push({
            contact_id: contact.id,
            reason: 'Contact user not found'
          });
          continue;
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', contactUser.id)
          .maybeSingle();

        if (existingMember) {
          results.already_member.push({
            contact_id: contact.id,
            email: contactUser.email
          });
          continue;
        }

        // Check if already invited
        const { data: existingInvite } = await supabase
          .from('event_invitations')
          .select('id, status')
          .eq('event_id', eventId)
          .eq('email', contactUser.email)
          .maybeSingle();

        if (existingInvite && existingInvite.status === 'pending') {
          results.already_invited.push({
            contact_id: contact.id,
            email: contactUser.email
          });
          continue;
        }

        // Create or update invitation
        let invitation;
        if (existingInvite) {
          // Update existing invitation to pending
          const { data: updated, error: updateError } = await supabase
            .from('event_invitations')
            .update({
              status: 'pending',
              responded_at: null,
              created_at: new Date().toISOString()
            })
            .eq('id', existingInvite.id)
            .select()
            .single();

          if (updateError) {
            results.failed.push({
              contact_id: contact.id,
              email: contactUser.email,
              reason: 'Failed to update invitation'
            });
            continue;
          }
          invitation = updated;
        } else {
          // Create new invitation
          const { data: created, error: createError } = await supabase
            .from('event_invitations')
            .insert({
              event_id: eventId,
              email: contactUser.email,
              status: 'pending'
            })
            .select()
            .single();

          if (createError) {
            results.failed.push({
              contact_id: contact.id,
              email: contactUser.email,
              reason: 'Failed to create invitation'
            });
            continue;
          }
          invitation = created;
        }

        // Send email notification
        try {
          const resend = getResendClient();
          const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/join/${event.invite_code}`;

          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Memora <invites@mail.mymemoraapp.com>',
            to: contactUser.email,
            subject: `${ownerFirstName} invited you to ${event.title}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited</h1>
                  </div>

                  <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; margin-bottom: 20px;">
                      <strong>${ownerFirstName}</strong> has invited you to their event:
                    </p>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h2 style="margin: 0 0 10px 0; color: #667eea; font-size: 22px;">${event.title}</h2>
                    </div>

                    <p style="margin: 20px 0;">Click the button below to view the event and join:</p>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">View Event</a>
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      Or copy this link: <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
                    </p>
                  </div>

                  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                    <p>Sent by Memora - Gift Registry App</p>
                  </div>
                </body>
              </html>
            `,
            text: `
${ownerFirstName} has invited you to their event: ${event.title}

Click the link below to view the event and join:
${inviteUrl}

Sent by Memora - Gift Registry App
            `.trim()
          });

          results.invited.push({
            contact_id: contact.id,
            email: contactUser.email,
            invitation_id: invitation.id
          });

        } catch (emailError) {
          console.error('Email send error:', emailError);
          // Still count as invited since DB record was created
          results.invited.push({
            contact_id: contact.id,
            email: contactUser.email,
            invitation_id: invitation.id,
            email_failed: true
          });
        }

      } catch (error) {
        console.error('Error processing contact:', error);
        results.failed.push({
          contact_id: contact.id,
          reason: 'Internal error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Bulk invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
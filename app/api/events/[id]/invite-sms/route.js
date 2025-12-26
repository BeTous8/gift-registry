import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getTwilioClient, formatPhoneNumber, isValidUSPhone } from '../../../../utils/twilioClient';

// Service role client for privileged operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request, { params }) {
  try {
    const { id: eventId } = await params;
    const { phone, userId } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Validate US phone number
    if (!isValidUSPhone(phone)) {
      return NextResponse.json({
        error: 'Please enter a valid US phone number (10 digits)'
      }, { status: 400 });
    }

    const formattedPhone = formatPhoneNumber(phone);

    // Verify the user owns this event and get full event details
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, title, user_id, invite_code, event_date')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get owner's name for the SMS
    const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(event.user_id);
    const ownerName = ownerData?.user?.user_metadata?.full_name
      || ownerData?.user?.user_metadata?.name
      || ownerData?.user?.email?.split('@')[0]
      || 'Someone';

    // Check if invitation already exists for this phone
    const { data: existingInvite } = await supabaseAdmin
      .from('event_invitations')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('phone', formattedPhone)
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json({
        error: `SMS invitation already ${existingInvite.status}`,
        status: existingInvite.status
      }, { status: 400 });
    }

    // Create the invitation with phone instead of email
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('event_invitations')
      .insert({
        event_id: eventId,
        phone: formattedPhone,
        status: 'pending'
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating SMS invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Send SMS via Twilio
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memoraapp.netlify.app';
    const joinUrl = `${siteUrl}/join/${event.invite_code}`;

    const twilioClient = getTwilioClient();
    if (!twilioClient) {
      console.error('Twilio client not available - skipping SMS');
      // Invitation was still created, return success with warning
      return NextResponse.json({
        success: true,
        invitation,
        message: 'Invitation created but SMS could not be sent (Twilio not configured)',
        smsSkipped: true
      });
    }

    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhone) {
      console.error('TWILIO_PHONE_NUMBER not set - skipping SMS');
      return NextResponse.json({
        success: true,
        invitation,
        message: 'Invitation created but SMS could not be sent (no sender number)',
        smsSkipped: true
      });
    }

    try {
      await twilioClient.messages.create({
        body: `${ownerName} invited you to "${event.title}" on Memora! Join here: ${joinUrl}`,
        from: twilioPhone,
        to: formattedPhone
      });
      console.log('SMS invitation sent to:', formattedPhone);
    } catch (smsError) {
      // Log the error but don't fail the invitation
      console.error('Error sending SMS:', smsError);
      return NextResponse.json({
        success: true,
        invitation,
        message: 'Invitation created but SMS failed to send',
        smsError: smsError.message
      });
    }

    return NextResponse.json({
      success: true,
      invitation,
      message: 'SMS invitation sent successfully'
    });

  } catch (error) {
    console.error('SMS invite error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

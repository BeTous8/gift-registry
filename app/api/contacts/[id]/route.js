import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// DELETE - Remove a contact from user's contact list
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { id } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    // Verify the contact belongs to the current user
    const { data: contact, error: fetchError } = await supabaseAdmin
      .from('user_contacts')
      .select('id, user_id, birthday_event_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching contact:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch contact' },
        { status: 500 }
      );
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Ensure the contact belongs to the current user
    if (contact.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this contact' },
        { status: 403 }
      );
    }

    // Delete linked birthday calendar event if exists
    if (contact.birthday_event_id) {
      await supabaseAdmin
        .from('events')
        .delete()
        .eq('id', contact.birthday_event_id)
        .eq('user_id', userId);
    }

    // Delete the contact
    const { error: deleteError } = await supabaseAdmin
      .from('user_contacts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting contact:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete contact' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contact removed successfully'
    });

  } catch (error) {
    console.error('Delete contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update contact birthday
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, birthday_month, birthday_day, add_to_calendar, contact_name } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    // Validate birthday values if provided
    if (birthday_month !== undefined && birthday_month !== null) {
      if (birthday_month < 1 || birthday_month > 12) {
        return NextResponse.json(
          { error: 'Invalid month (must be 1-12)' },
          { status: 400 }
        );
      }
    }

    if (birthday_day !== undefined && birthday_day !== null) {
      if (birthday_day < 1 || birthday_day > 31) {
        return NextResponse.json(
          { error: 'Invalid day (must be 1-31)' },
          { status: 400 }
        );
      }
    }

    // Fetch the contact to verify ownership
    const { data: contact, error: fetchError } = await supabaseAdmin
      .from('user_contacts')
      .select('id, user_id, birthday_event_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching contact:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch contact' },
        { status: 500 }
      );
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    if (contact.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to update this contact' },
        { status: 403 }
      );
    }

    let birthday_event_id = contact.birthday_event_id;

    // Handle calendar event creation/update
    if (add_to_calendar && birthday_month && birthday_day) {
      // Create event_date using a placeholder year (2000)
      const month = String(birthday_month).padStart(2, '0');
      const day = String(birthday_day).padStart(2, '0');
      const eventDate = `2000-${month}-${day}`;
      const eventTitle = `${contact_name || 'Contact'}'s Birthday`;

      if (birthday_event_id) {
        // Update existing event
        await supabaseAdmin
          .from('events')
          .update({
            title: eventTitle,
            event_date: eventDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', birthday_event_id)
          .eq('user_id', userId);
      } else {
        // Create new recurring birthday event
        const { data: newEvent, error: eventError } = await supabaseAdmin
          .from('events')
          .insert({
            user_id: userId,
            title: eventTitle,
            event_date: eventDate,
            event_category: 'birthday',
            is_recurring: true,
            registry_enabled: false
          })
          .select('id')
          .single();

        if (eventError) {
          console.error('Error creating birthday event:', eventError);
          return NextResponse.json(
            { error: 'Failed to create calendar event' },
            { status: 500 }
          );
        }

        birthday_event_id = newEvent.id;
      }
    }

    // Update contact with birthday info
    const updateData = {};
    if (birthday_month !== undefined) updateData.birthday_month = birthday_month;
    if (birthday_day !== undefined) updateData.birthday_day = birthday_day;
    if (birthday_event_id !== contact.birthday_event_id) {
      updateData.birthday_event_id = birthday_event_id;
    }

    const { data: updatedContact, error: updateError } = await supabaseAdmin
      .from('user_contacts')
      .update(updateData)
      .eq('id', id)
      .select('id, birthday_month, birthday_day, birthday_event_id')
      .single();

    if (updateError) {
      console.error('Error updating contact:', updateError);
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contact: updatedContact
    });

  } catch (error) {
    console.error('Update contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

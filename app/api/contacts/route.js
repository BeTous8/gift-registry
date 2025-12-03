import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Add a contact to user's contact list
export async function POST(request) {
  try {
    const { contact_email, userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    if (!contact_email) {
      return NextResponse.json(
        { error: 'contact_email is required' },
        { status: 400 }
      );
    }

    // Find the user by email using admin API
    const { data: contactUserData, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      console.error('Error fetching users:', userError);
      return NextResponse.json(
        { error: 'Failed to find user' },
        { status: 500 }
      );
    }

    const contactUser = contactUserData.users.find(u => u.email === contact_email);

    if (!contactUser) {
      return NextResponse.json(
        { error: 'User not found with this email' },
        { status: 404 }
      );
    }

    // Prevent adding yourself
    if (contactUser.id === userId) {
      return NextResponse.json(
        { error: 'Cannot add yourself as a contact' },
        { status: 400 }
      );
    }

    // Check if contact already exists
    const { data: existingContact } = await supabaseAdmin
      .from('user_contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_user_id', contactUser.id)
      .maybeSingle();

    if (existingContact) {
      return NextResponse.json(
        { error: 'Contact already exists' },
        { status: 409 }
      );
    }

    // Add contact
    const { data: contact, error: insertError } = await supabaseAdmin
      .from('user_contacts')
      .insert({
        user_id: userId,
        contact_user_id: contactUser.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding contact:', insertError);
      return NextResponse.json(
        { error: 'Failed to add contact' },
        { status: 500 }
      );
    }

    // Get contact user details
    const { data: contactDetails } = await supabaseAdmin.auth.admin.getUserById(contactUser.id);

    // Extract first and last names
    const firstName = contactDetails?.user?.user_metadata?.given_name ||
                      contactDetails?.user?.user_metadata?.full_name?.split(' ')[0] ||
                      contactUser.email.split('@')[0];

    const lastName = contactDetails?.user?.user_metadata?.family_name ||
                     contactDetails?.user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
                     '';

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        contact_user_id: contactUser.id,
        email: contactUser.email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        created_at: contact.created_at
      }
    });

  } catch (error) {
    console.error('Add contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - List user's contacts
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    // Get user's contacts
    const { data: contacts, error: fetchError } = await supabaseAdmin
      .from('user_contacts')
      .select('id, contact_user_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching contacts:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      );
    }

    // Get details for all contact users
    const contactsWithDetails = await Promise.all(
      contacts.map(async (contact) => {
        const { data: contactUserData } = await supabaseAdmin.auth.admin.getUserById(contact.contact_user_id);

        const contactUser = contactUserData?.user;
        const metadata = contactUser?.user_metadata || {};

        let firstName = metadata.given_name || '';
        let lastName = metadata.family_name || '';

        // Fallback to full_name if given_name not available
        if (!firstName && metadata.full_name) {
          const nameParts = metadata.full_name.trim().split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }

        // Fallback to email
        if (!firstName && contactUser?.email) {
          firstName = contactUser.email.split('@')[0];
        }

        return {
          id: contact.id,
          contact_user_id: contact.contact_user_id,
          email: contactUser?.email || '',
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          created_at: contact.created_at
        };
      })
    );

    return NextResponse.json({
      contacts: contactsWithDetails
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


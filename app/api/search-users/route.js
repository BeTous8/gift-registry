import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Search for users by email (for adding contacts)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: 'Search query must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Get all users (admin API)
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    // Filter users by email matching query (case-insensitive)
    const matchingUsers = usersData.users.filter(u => {
      // Exclude current user from search results
      if (u.id === userId) return false;

      // Match email
      return u.email?.toLowerCase().includes(query.toLowerCase());
    });

    // Get user's existing contacts to mark them in results
    const { data: existingContacts } = await supabaseAdmin
      .from('user_contacts')
      .select('contact_user_id')
      .eq('user_id', userId);

    const existingContactIds = new Set(
      existingContacts?.map(c => c.contact_user_id) || []
    );

    // Format results with user details
    const results = matchingUsers.slice(0, 10).map(u => {
      const metadata = u.user_metadata || {};

      let firstName = metadata.given_name || '';
      let lastName = metadata.family_name || '';

      // Fallback to full_name if given_name not available
      if (!firstName && metadata.full_name) {
        const nameParts = metadata.full_name.trim().split(' ');
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }

      // Fallback to email
      if (!firstName && u.email) {
        firstName = u.email.split('@')[0];
      }

      return {
        id: u.id,
        email: u.email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        is_contact: existingContactIds.has(u.id)
      };
    });

    return NextResponse.json({
      users: results
    });

  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
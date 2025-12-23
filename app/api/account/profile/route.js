import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch user profile
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

    // Get profile from user_profiles table (may not exist yet)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // Get auth user data for email and provider info
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError) {
      console.error('Error fetching auth user:', authError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    const authUser = authData?.user;
    const provider = authUser?.app_metadata?.provider || 'email';

    // Merge data from both sources with fallback chain
    return NextResponse.json({
      profile: {
        display_name: profile?.display_name || authUser?.user_metadata?.display_name || authUser?.user_metadata?.full_name || '',
        birthday: profile?.birthday || null,
        phone: profile?.phone || '',
        profile_photo_url: profile?.profile_photo_url || null,
        email: authUser?.email || '',
        provider: provider,
        created_at: profile?.created_at || authUser?.created_at
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update user profile (upsert logic)
export async function PATCH(request) {
  try {
    const { userId, display_name, birthday, phone } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // Prepare data (convert empty strings to null)
    const profileData = {
      display_name: display_name || null,
      birthday: birthday || null,
      phone: phone || null
    };

    let result;

    if (existingProfile) {
      // Update existing profile
      result = await supabaseAdmin
        .from('user_profiles')
        .update(profileData)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      // Insert new profile
      result = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: userId,
          ...profileData
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error updating profile:', result.error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: result.data
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

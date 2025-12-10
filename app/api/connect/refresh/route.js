import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/connect/refresh
 * Generates a new onboarding link for users who need to complete or update their account.
 * Account links expire after ~15 minutes, so this allows users to get a fresh link.
 */
export async function POST(request) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const userId = user.id;

    // 2. Get user's Connect account ID
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_payment_settings')
      .select('stripe_connect_account_id, stripe_connect_onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to fetch payment settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch account information' }, { status: 500 });
    }

    // 3. Verify account exists
    if (!settings || !settings.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'No connected account found. Please start onboarding first.' },
        { status: 404 }
      );
    }

    const accountId = settings.stripe_connect_account_id;

    // 4. Check if account is already fully onboarded
    if (settings.stripe_connect_onboarding_completed) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        const fullyVerified = account.charges_enabled &&
                             account.payouts_enabled &&
                             account.capabilities?.transfers === 'active';

        if (fullyVerified) {
          return NextResponse.json({
            success: true,
            alreadyOnboarded: true,
            message: 'Account is fully verified. No onboarding needed.'
          });
        }
      } catch (stripeError) {
        console.error('Error checking account status:', stripeError);
        // Continue to generate new link if account verification fails
      }
    }

    // 5. Generate new account link
    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin');
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?connect=refresh`,
      return_url: `${origin}/dashboard?connect=success`,
      type: 'account_onboarding',
      collection_options: {
        fields: 'eventually_due', // Only collect immediately required fields
        future_requirements: 'omit' // Skip optional future requirements
      }
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      accountId: accountId,
      message: 'New onboarding link generated'
    });

  } catch (error) {
    console.error('Connect refresh error:', error);
    return NextResponse.json({ error: 'Failed to generate new onboarding link' }, { status: 500 });
  }
}
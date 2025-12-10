import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/connect/status
 * Checks the user's Stripe Connect account status and onboarding completion.
 * Returns whether they can receive payouts.
 */
export async function GET(request) {
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

    // 2. Get user's payment settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_payment_settings')
      .select('stripe_connect_account_id, stripe_connect_onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to fetch payment settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch account status' }, { status: 500 });
    }

    // 3. If no account exists, return not connected
    if (!settings || !settings.stripe_connect_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingCompleted: false,
        canReceivePayouts: false,
        message: 'No connected account found'
      });
    }

    // 4. Retrieve account details from Stripe
    try {
      const account = await stripe.accounts.retrieve(settings.stripe_connect_account_id);

      // 5. Check if account is fully verified and capable of receiving transfers
      const chargesEnabled = account.charges_enabled;
      const payoutsEnabled = account.payouts_enabled;
      const transfersActive = account.capabilities?.transfers === 'active';
      const detailsSubmitted = account.details_submitted;

      const fullyVerified = chargesEnabled && payoutsEnabled && transfersActive;

      // 6. Update database if onboarding status changed
      if (fullyVerified && !settings.stripe_connect_onboarding_completed) {
        await supabaseAdmin
          .from('user_payment_settings')
          .update({ stripe_connect_onboarding_completed: true })
          .eq('user_id', userId);
      }

      return NextResponse.json({
        connected: true,
        onboardingCompleted: fullyVerified,
        canReceivePayouts: fullyVerified,
        accountId: settings.stripe_connect_account_id,
        details: {
          chargesEnabled,
          payoutsEnabled,
          transfersActive,
          detailsSubmitted,
          requiresOnboarding: !detailsSubmitted || !fullyVerified
        }
      });

    } catch (stripeError) {
      console.error('Stripe account retrieval error:', stripeError);

      // Account might have been deleted or invalid
      return NextResponse.json({
        connected: false,
        onboardingCompleted: false,
        canReceivePayouts: false,
        error: 'Account not found or invalid'
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Connect status error:', error);
    return NextResponse.json({ error: 'Failed to check account status' }, { status: 500 });
  }
}
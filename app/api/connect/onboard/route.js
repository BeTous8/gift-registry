import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/connect/onboard
 * Creates a Stripe Express Connect account and returns an onboarding link.
 * This is the first step for event owners to connect their bank account for redemptions.
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

    // 2. Check if user already has a Connect account
    const { data: existingSettings } = await supabaseAdmin
      .from('user_payment_settings')
      .select('stripe_connect_account_id, stripe_connect_onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();

    let accountId;

    if (existingSettings?.stripe_connect_account_id) {
      // User already has an account
      accountId = existingSettings.stripe_connect_account_id;

      // If already completed onboarding, return success
      if (existingSettings.stripe_connect_onboarding_completed) {
        return NextResponse.json({
          success: true,
          alreadyOnboarded: true,
          message: 'Bank account already connected'
        });
      }
    } else {
      // 3. Create new Express Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true }
        },
        business_type: 'individual',
        metadata: {
          memora_user_id: userId
        }
      });

      accountId = account.id;

      // 4. Save account ID to database
      const { error: insertError } = await supabaseAdmin
        .from('user_payment_settings')
        .insert({
          user_id: userId,
          stripe_connect_account_id: accountId,
          stripe_connect_onboarding_completed: false
        });

      if (insertError) {
        console.error('Failed to save account ID:', insertError);
        return NextResponse.json({ error: 'Failed to save account information' }, { status: 500 });
      }
    }

    // 5. Create account link for onboarding
    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin');
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?connect=refresh`,
      return_url: `${origin}/dashboard?connect=success`,
      type: 'account_onboarding'
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      accountId: accountId
    });

  } catch (error) {
    console.error('Connect onboard error:', error);
    return NextResponse.json({ error: 'Failed to create onboarding link' }, { status: 500 });
  }
}
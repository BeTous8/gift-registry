import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { validateUUID, validateIdempotencyKey, sanitizeString } from '../../../lib/validation.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Platform fee percentage (configurable via env)
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '5.0');

/**
 * POST /api/fulfillments/create
 * Creates a fulfillment request and initiates Stripe Transfer to Connected Account
 * This is the core redemption endpoint that event owners use to cash out
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

    // 2. Parse and validate request body
    const body = await request.json();
    const {
      itemId,
      eventId,
      fulfillmentMethod = 'bank_transfer',
      notes = '',
      idempotencyKey
    } = body;

    // 3. Validate UUIDs
    try {
      validateUUID(itemId, 'Item ID');
      validateUUID(eventId, 'Event ID');
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // 4. Validate idempotency key
    const idempotencyValidation = validateIdempotencyKey(idempotencyKey, userId, itemId);
    if (!idempotencyValidation.valid) {
      return NextResponse.json({ error: idempotencyValidation.error }, { status: 400 });
    }

    // 5. Sanitize notes
    const sanitizedNotes = sanitizeString(notes, 500);

    // 6. Check if user owns the event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, user_id, title')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have permission' },
        { status: 403 }
      );
    }

    // 7. Check if item belongs to event and is eligible
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('id, title, price_cents, current_amount_cents, is_fulfilled, event_id')
      .eq('id', itemId)
      .eq('event_id', eventId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 8. Validate eligibility
    if (item.is_fulfilled) {
      return NextResponse.json(
        { error: 'Item has already been fulfilled' },
        { status: 400 }
      );
    }

    if (item.current_amount_cents < item.price_cents) {
      return NextResponse.json(
        {
          error: 'Item not fully funded',
          details: {
            current: item.current_amount_cents,
            required: item.price_cents,
            remaining: item.price_cents - item.current_amount_cents
          }
        },
        { status: 400 }
      );
    }

    // 9. Get user's Stripe Connect account
    const { data: paymentSettings, error: paymentError } = await supabaseAdmin
      .from('user_payment_settings')
      .select('stripe_connect_account_id, stripe_connect_onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (paymentError || !paymentSettings?.stripe_connect_account_id) {
      return NextResponse.json(
        {
          error: 'stripe_connect_required',
          message: 'Please connect your bank account first',
          action: 'onboard'
        },
        { status: 402 }
      );
    }

    const stripeAccountId = paymentSettings.stripe_connect_account_id;

    // 10. Verify Stripe account is fully verified
    let account;
    try {
      account = await stripe.accounts.retrieve(stripeAccountId);
    } catch (stripeError) {
      console.error('Failed to retrieve Stripe account:', stripeError);
      return NextResponse.json(
        {
          error: 'stripe_account_invalid',
          message: 'Connected account is invalid or deleted',
          action: 'onboard'
        },
        { status: 402 }
      );
    }

    // Validate account capabilities
    if (!account.charges_enabled || !account.payouts_enabled) {
      return NextResponse.json(
        {
          error: 'stripe_account_unverified',
          message: 'Bank account not yet verified. Please complete onboarding.',
          action: 'refresh_onboarding'
        },
        { status: 402 }
      );
    }

    if (account.capabilities?.transfers !== 'active') {
      return NextResponse.json(
        {
          error: 'stripe_transfers_disabled',
          message: 'Transfers not enabled on your account',
          action: 'refresh_onboarding'
        },
        { status: 402 }
      );
    }

    // 11. Calculate amounts
    const grossAmountCents = item.current_amount_cents;
    const platformFeeCents = Math.floor(grossAmountCents * PLATFORM_FEE_PERCENTAGE / 100);
    const netAmountCents = grossAmountCents - platformFeeCents;

    // 12. Create fulfillment atomically using database function
    const { data: fulfillment, error: fulfillmentError } = await supabaseAdmin.rpc(
      'create_fulfillment_atomically',
      {
        p_item_id: itemId,
        p_event_id: eventId,
        p_user_id: userId,
        p_gross_amount_cents: grossAmountCents,
        p_platform_fee_cents: platformFeeCents,
        p_net_amount_cents: netAmountCents,
        p_fulfillment_method: fulfillmentMethod,
        p_notes: sanitizedNotes,
        p_idempotency_key: idempotencyKey,
        p_stripe_account_id: stripeAccountId
      }
    );

    if (fulfillmentError) {
      console.error('Fulfillment creation error:', fulfillmentError);

      // Handle specific error cases
      if (fulfillmentError.message?.includes('already fulfilled')) {
        return NextResponse.json(
          { error: 'Item already fulfilled by another request' },
          { status: 409 }
        );
      }

      if (fulfillmentError.message?.includes('Fulfillment already in progress')) {
        return NextResponse.json(
          { error: 'Fulfillment already in progress for this item' },
          { status: 409 }
        );
      }

      if (fulfillmentError.message?.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Duplicate request detected (same idempotency key)' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create fulfillment', details: fulfillmentError.message },
        { status: 500 }
      );
    }

    // 13. Create Stripe Transfer
    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: netAmountCents,
        currency: 'usd',
        destination: stripeAccountId,
        metadata: {
          fulfillment_id: fulfillment.id,
          item_id: itemId,
          event_id: eventId,
          user_id: userId,
          item_title: item.title,
          event_title: event.title
        },
        description: `Fulfillment for "${item.title}" - ${event.title}`
      });

      console.log('Transfer created:', transfer.id);

    } catch (stripeError) {
      console.error('Stripe transfer creation failed:', stripeError);

      // Mark fulfillment as failed
      await supabaseAdmin.rpc('fail_fulfillment', {
        p_fulfillment_id: fulfillment.id,
        p_error_message: stripeError.message,
        p_error_code: stripeError.code || 'stripe_transfer_failed'
      });

      return NextResponse.json(
        {
          error: 'Transfer failed',
          message: 'Failed to initiate bank transfer. Please try again.',
          stripe_error: stripeError.message
        },
        { status: 500 }
      );
    }

    // 14. Update fulfillment with transfer ID and set to processing
    await supabaseAdmin
      .from('fulfillments')
      .update({
        stripe_transfer_id: transfer.id,
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', fulfillment.id);

    // 15. Return success response
    return NextResponse.json({
      success: true,
      fulfillment: {
        id: fulfillment.id,
        status: 'processing',
        gross_amount_cents: grossAmountCents,
        platform_fee_cents: platformFeeCents,
        net_amount_cents: netAmountCents,
        stripe_transfer_id: transfer.id,
        estimated_arrival: getEstimatedArrival(),
        item: {
          id: item.id,
          title: item.title
        },
        event: {
          id: event.id,
          title: event.title
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Fulfillment creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper function to calculate estimated arrival date
 * Stripe transfers typically arrive in 2-7 business days for standard payouts
 */
function getEstimatedArrival() {
  const today = new Date();
  const daysToAdd = 3; // Conservative estimate: 3 business days

  // Add days (simplified - doesn't account for weekends/holidays)
  const arrival = new Date(today);
  arrival.setDate(arrival.getDate() + daysToAdd);

  return arrival.toISOString().split('T')[0]; // Return YYYY-MM-DD
}
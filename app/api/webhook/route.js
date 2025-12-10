import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Use service role key for webhooks to bypass RLS policies
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;

  try {
    // Verify webhook signature (security)
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    // Generic error message to avoid leaking system details
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Webhook deduplication - check if we've already processed this event
  const { data: existingEvent } = await supabase
    .from('webhook_events_processed')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log('Duplicate webhook event detected, skipping:', event.id);
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log('Processing webhook event:', event.type, event.id);

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { itemId, contributorName, contributorEmail } = session.metadata || {};

    if (!itemId) {
      console.error('No itemId in session metadata');
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ error: 'Item ID missing from metadata' }, { status: 400 });
    }

    console.log('Payment succeeded for item:', itemId);

    // Use atomic contribution processing to prevent race conditions
    const { data: result, error: processError } = await supabase.rpc(
      'process_contribution',
      {
        p_item_id: itemId,
        p_amount_cents: session.amount_total,
        p_stripe_session_id: session.id,
        p_contributor_name: contributorName || '',
        p_contributor_email: contributorEmail || null
      }
    );

    if (processError) {
      console.error('Error processing contribution:', processError);
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ error: 'Failed to process contribution' }, { status: 500 });
    }

    if (result && result.length > 0) {
      const { new_amount_cents, is_duplicate } = result[0];

      if (is_duplicate) {
        console.log('Duplicate contribution detected (idempotent):', session.id);
      } else {
        console.log('Successfully processed contribution. New amount:', new_amount_cents);
      }
    }
  }

  // Handle payment_intent.payment_failed event
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const error = paymentIntent.last_payment_error;
    const declineCode = error?.decline_code || error?.code || 'unknown';
    const errorMessage = error?.message || 'Payment failed';

    // Try to get checkout session ID from metadata or retrieve it
    let sessionId = paymentIntent.metadata?.checkout_session_id;
    let itemId = null;

    // If we have a session ID, try to get the item ID from the session
    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        itemId = session.metadata?.itemId;
      } catch (err) {
        console.error('Error retrieving checkout session:', err.message);
      }
    }

    // Log the failed payment with details
    console.log('Payment failed:', {
      paymentIntentId: paymentIntent.id,
      itemId: itemId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      declineCode: declineCode,
      errorMessage: errorMessage,
      errorType: error?.type,
      customerId: paymentIntent.customer
    });
  }

  // Handle transfer.paid event (fulfillment completed successfully)
  if (event.type === 'transfer.paid') {
    const transfer = event.data.object;
    const fulfillmentId = transfer.metadata?.fulfillment_id;

    if (!fulfillmentId) {
      console.error('No fulfillment_id in transfer metadata');
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ received: true });
    }

    console.log('Transfer paid successfully:', transfer.id, 'for fulfillment:', fulfillmentId);

    // Mark fulfillment as completed using atomic function
    const { error: completeError } = await supabase.rpc('complete_fulfillment', {
      p_fulfillment_id: fulfillmentId
    });

    if (completeError) {
      console.error('Error completing fulfillment:', completeError);
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ error: 'Failed to complete fulfillment' }, { status: 500 });
    }

    console.log('Fulfillment marked as completed:', fulfillmentId);
  }

  // Handle transfer.failed event (fulfillment failed)
  if (event.type === 'transfer.failed') {
    const transfer = event.data.object;
    const fulfillmentId = transfer.metadata?.fulfillment_id;

    if (!fulfillmentId) {
      console.error('No fulfillment_id in transfer metadata');
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ received: true });
    }

    console.log('Transfer failed:', transfer.id, 'for fulfillment:', fulfillmentId);

    // Extract failure details
    const failureMessage = transfer.failure_message || 'Transfer failed';
    const failureCode = transfer.failure_code || 'unknown';

    // Mark fulfillment as failed using atomic function
    const { error: failError } = await supabase.rpc('fail_fulfillment', {
      p_fulfillment_id: fulfillmentId,
      p_error_message: failureMessage,
      p_error_code: failureCode
    });

    if (failError) {
      console.error('Error marking fulfillment as failed:', failError);
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ error: 'Failed to update fulfillment status' }, { status: 500 });
    }

    console.log('Fulfillment marked as failed:', fulfillmentId);
  }

  // Handle account.updated event (Connect account verification status changed)
  if (event.type === 'account.updated') {
    const account = event.data.object;
    const userId = account.metadata?.memora_user_id;

    if (!userId) {
      console.log('No memora_user_id in account metadata, skipping');
      await markWebhookProcessed(event.id, event.type);
      return NextResponse.json({ received: true });
    }

    console.log('Stripe account updated:', account.id, 'for user:', userId);

    // Check if account is now fully verified
    const fullyVerified = account.charges_enabled &&
                         account.payouts_enabled &&
                         account.capabilities?.transfers === 'active';

    // Update user payment settings
    const { error: updateError } = await supabase
      .from('user_payment_settings')
      .update({
        stripe_connect_onboarding_completed: fullyVerified,
        stripe_connect_status: fullyVerified ? 'active' : 'pending',
        stripe_connect_capabilities: account.capabilities || {}
      })
      .eq('stripe_connect_account_id', account.id);

    if (updateError) {
      console.error('Error updating payment settings:', updateError);
    } else {
      console.log('Payment settings updated for user:', userId, 'Status:', fullyVerified ? 'active' : 'pending');
    }
  }

  // Mark webhook as processed (deduplication)
  await markWebhookProcessed(event.id, event.type);

  return NextResponse.json({ received: true });
}

/**
 * Helper function to mark webhook event as processed
 * Prevents duplicate processing of the same event
 */
async function markWebhookProcessed(stripeEventId, eventType) {
  try {
    await supabase
      .from('webhook_events_processed')
      .insert({
        stripe_event_id: stripeEventId,
        event_type: eventType
      });
  } catch (err) {
    console.error('Error marking webhook as processed:', err.message);
    // Non-critical error, don't fail the webhook
  }
}
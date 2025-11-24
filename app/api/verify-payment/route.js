import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role key to bypass RLS for updates (same as webhook)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { valid: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      });
    } catch (error) {
      // Session doesn't exist or is invalid
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired session',
        status: 'invalid'
      });
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      return NextResponse.json({
        valid: false,
        error: 'Payment session has expired',
        status: 'expired'
      });
    }

    // Check payment status
    const paymentStatus = session.payment_status;
    const metadata = session.metadata || {};
    const itemId = metadata.itemId;

    // Get payment intent if available
    const paymentIntent = session.payment_intent;
    let failed = false;
    let errorType = null;
    let errorMessage = null;

    // Check if payment failed by examining payment_intent
    if (paymentIntent && typeof paymentIntent === 'object') {
      // Check for last_payment_error which indicates a failed payment attempt
      if (paymentIntent.last_payment_error) {
        failed = true;
        const error = paymentIntent.last_payment_error;
        const declineCode = error.decline_code || error.code;
        
        // Map Stripe decline codes to user-friendly error messages
        const errorMessages = {
          'card_declined': {
            type: 'card_declined',
            message: 'Your card was declined. Please contact your card issuer or try a different payment method.'
          },
          'insufficient_funds': {
            type: 'insufficient_funds',
            message: 'Insufficient funds in your account. Please use a different payment method or contact your bank.'
          },
          'expired_card': {
            type: 'expired_card',
            message: 'Your card has expired. Please update your payment information and try again.'
          },
          'incorrect_cvc': {
            type: 'incorrect_cvc',
            message: 'The CVV code entered is incorrect. Please verify and try again.'
          },
          'incorrect_zip': {
            type: 'incorrect_zip',
            message: 'The ZIP code entered is incorrect. Please verify and try again.'
          },
          'generic_decline': {
            type: 'generic_decline',
            message: 'Your bank has rejected the transaction. Please contact your bank for more details or try a different payment method.'
          }
        };

        // Find matching error message or use generic
        if (declineCode && errorMessages[declineCode]) {
          errorType = errorMessages[declineCode].type;
          errorMessage = errorMessages[declineCode].message;
        } else if (error.message) {
          // Use Stripe's error message if no specific mapping
          errorType = declineCode || 'payment_failed';
          errorMessage = error.message;
        } else {
          // Default fallback message
          errorType = 'payment_failed';
          errorMessage = 'Payment failed. Please try again or contact support if the problem persists.';
        }
      }
    }

    // Also check payment_status for 'unpaid' which indicates failure
    if (paymentStatus === 'unpaid' && !failed) {
      failed = true;
      errorType = 'payment_failed';
      errorMessage = 'Payment failed. Please try again or contact support if the problem persists.';
    }

    // Determine if payment was completed
    const isCompleted = paymentStatus === 'paid' && !failed;

    // Fallback: If payment is completed but webhook might have failed,
    // update the database directly (with idempotency check)
    let databaseUpdated = false;
    if (isCompleted && itemId) {
      try {
        // Check if this payment was already processed (idempotency check)
        // Look for existing contribution with this session_id
        const { data: existingContribs, error: contribCheckError } = await supabase
          .from('contributions')
          .select('id')
          .eq('stripe_session_id', sessionId)
          .limit(1);

        // If contribution doesn't exist (or table doesn't exist), proceed with update
        // contribCheckError might indicate table doesn't exist, which is okay
        const alreadyProcessed = existingContribs && existingContribs.length > 0;
        
        if (!alreadyProcessed) {
          // Get current item data
          const { data: item, error: itemError } = await supabase
            .from('items')
            .select('current_amount_cents')
            .eq('id', itemId)
            .single();

          if (!itemError && item) {
            // Update item with new amount
            const newAmount = (item.current_amount_cents || 0) + session.amount_total;

            const { error: updateError } = await supabase
              .from('items')
              .update({ current_amount_cents: newAmount })
              .eq('id', itemId);

            if (!updateError) {
              // Record the contribution for idempotency
              const { contributorName, contributorEmail } = metadata;
              try {
                await supabase
                  .from('contributions')
                  .insert([{
                    item_id: itemId,
                    contributor_name: contributorName || null,
                    contributor_email: contributorEmail || null,
                    amount_cents: session.amount_total,
                    stripe_session_id: sessionId,
                    status: 'completed'
                  }]);
              } catch (contribInsertError) {
                // Contributions table might not exist, that's okay
                // The important part (updating item) succeeded
                console.log('Could not record contribution (table may not exist):', contribInsertError);
              }

              databaseUpdated = true;
              console.log('Fallback: Updated database for payment session:', sessionId);
            }
          }
        } else {
          // Payment was already processed (webhook succeeded)
          console.log('Payment already processed by webhook:', sessionId);
        }
      } catch (fallbackError) {
        // Fallback update failed - log but don't fail the verification
        // Webhook might still process it later
        console.error('Fallback database update failed:', fallbackError);
      }
    }

    return NextResponse.json({
      valid: true,
      status: paymentStatus,
      amount: session.amount_total,
      itemId: itemId,
      completed: isCompleted,
      failed: failed,
      errorType: errorType,
      errorMessage: errorMessage,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      databaseUpdated: databaseUpdated // Indicate if we updated the database
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to verify payment', details: error.message },
      { status: 500 }
    );
  }
}


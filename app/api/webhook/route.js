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
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { itemId, contributorName, contributorEmail } = session.metadata || {};

    if (!itemId) {
      console.error('No itemId in session metadata');
      return NextResponse.json({ error: 'Item ID missing from metadata' }, { status: 400 });
    }

    console.log('Payment succeeded for item:', itemId);

    // Get current item data
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('current_amount_cents')
      .eq('id', itemId)
      .single();

    if (itemError) {
      console.error('Error fetching item:', itemError);
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Update item with new amount
    const newAmount = (item.current_amount_cents || 0) + session.amount_total;

    const { error: updateError } = await supabase
      .from('items')
      .update({ current_amount_cents: newAmount })
      .eq('id', itemId);

    if (updateError) {
      console.error('Error updating item:', updateError);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    // Record the contribution (optional - only if contributions table exists)
    try {
      const { error: contribError } = await supabase
        .from('contributions')
        .insert([{
          item_id: itemId,
          contributor_name: contributorName,
          contributor_email: contributorEmail || null,
          amount_cents: session.amount_total,
          stripe_session_id: session.id,
          status: 'completed'
        }]);

      if (contribError) {
        console.error('Error recording contribution (table may not exist):', contribError);
      }
    } catch (err) {
      console.error('Contributions table may not exist, skipping:', err.message);
    }

    console.log('Successfully updated item amount:', newAmount);
  }

  return NextResponse.json({ received: true });
}
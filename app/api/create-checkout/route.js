import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import supabase from '../../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { itemId, amount, contributorName, contributorEmail } = await request.json();

    // Get item details
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('*, events(slug, title)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Gift: ${item.title}`,
              description: `Contribution for ${item.events.title}`,
            },
            unit_amount: amount, // amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin')}/event/${item.events.slug}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin')}/event/${item.events.slug}?canceled=true`,
      metadata: {
        itemId: String(itemId), // Stripe metadata requires strings
        contributorName: contributorName || '',
        contributorEmail: contributorEmail || '',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

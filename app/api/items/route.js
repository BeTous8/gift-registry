import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { eventId, title, priceCents, productLink, imageUrl, userId } = await request.json()

    // Validate required fields
    if (!eventId || !title || !priceCents || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the event exists and user is the owner
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, user_id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    if (event.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You are not the owner of this event' },
        { status: 403 }
      )
    }

    // Insert item into database
    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert({
        event_id: eventId,
        title: title,
        price_cents: priceCents,
        current_amount_cents: 0,
        product_link: productLink || null,
        image_url: imageUrl || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save item to database', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('Item created successfully:', newItem.id)

    return NextResponse.json({
      success: true,
      item: newItem
    })

  } catch (error) {
    console.error('Error in items route:', error)
    return NextResponse.json(
      { error: 'Failed to add item', details: error.message },
      { status: 500 }
    )
  }
}

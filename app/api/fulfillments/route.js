import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/fulfillments
 * Lists fulfillment history for the authenticated user
 * Supports filtering by status and pagination
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

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // e.g., 'completed', 'pending', 'processing'
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate limit (max 100)
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    // 3. Build query
    let query = supabaseAdmin
      .from('fulfillments')
      .select(`
        id,
        item_id,
        event_id,
        fulfillment_method,
        status,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        stripe_transfer_id,
        error_message,
        requested_at,
        processing_started_at,
        completed_at,
        failed_at,
        items (
          id,
          title,
          image_url
        ),
        events (
          id,
          title
        )
      `)
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .range(offset, offset + safeLimit - 1);

    // Add status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    // 4. Execute query
    const { data: fulfillments, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching fulfillments:', queryError);
      return NextResponse.json({ error: 'Failed to fetch fulfillments' }, { status: 500 });
    }

    // 5. Get total count for pagination (separate query for total)
    const { count: totalCount } = await supabaseAdmin
      .from('fulfillments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', status || undefined);

    // 6. Format response
    const formattedFulfillments = fulfillments.map(f => ({
      id: f.id,
      item: {
        id: f.items?.id || f.item_id,
        title: f.items?.title || 'Unknown Item',
        image_url: f.items?.image_url
      },
      event: {
        id: f.events?.id || f.event_id,
        title: f.events?.title || 'Unknown Event'
      },
      fulfillment_method: f.fulfillment_method,
      status: f.status,
      gross_amount_cents: f.gross_amount_cents,
      platform_fee_cents: f.platform_fee_cents,
      net_amount_cents: f.net_amount_cents,
      stripe_transfer_id: f.stripe_transfer_id,
      error_message: f.error_message,
      requested_at: f.requested_at,
      processing_started_at: f.processing_started_at,
      completed_at: f.completed_at,
      failed_at: f.failed_at
    }));

    return NextResponse.json({
      fulfillments: formattedFulfillments,
      pagination: {
        total: totalCount || fulfillments.length,
        limit: safeLimit,
        offset: offset,
        hasMore: (offset + safeLimit) < (totalCount || 0)
      }
    });

  } catch (error) {
    console.error('Fulfillments list error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

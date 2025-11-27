import { NextResponse } from 'next/server';

// GET - Autocomplete place search
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input');

    if (!input || input.length < 3) {
      return NextResponse.json({
        error: 'Search query must be at least 3 characters'
      }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return NextResponse.json({
        error: 'Places API not configured'
      }, { status: 500 });
    }

    // Call Google Places Autocomplete API (using older API for better compatibility)
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    // Note: If you get REQUEST_DENIED, check:
    // 1. Places API is enabled in Google Cloud Console
    // 2. Billing is enabled
    // 3. API key has no IP/referrer restrictions (or includes localhost)

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json({
        error: 'Failed to fetch places',
        status: data.status
      }, { status: 500 });
    }

    // Limit to top 5 predictions to save costs
    const predictions = (data.predictions || []).slice(0, 5);

    return NextResponse.json({
      predictions,
      status: data.status
    });

  } catch (error) {
    console.error('Autocomplete error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

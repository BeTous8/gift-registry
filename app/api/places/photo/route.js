import { NextResponse } from 'next/server';

// GET - Proxy for Google Places photos
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const photoReference = searchParams.get('photo_reference');
    const maxWidth = searchParams.get('maxwidth') || '400';

    if (!photoReference) {
      return NextResponse.json({
        error: 'photo_reference is required'
      }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return NextResponse.json({
        error: 'Places API not configured'
      }, { status: 500 });
    }

    // Call Google Places Photo API
    const url = new URL('https://maps.googleapis.com/maps/api/place/photo');
    url.searchParams.set('photo_reference', photoReference);
    url.searchParams.set('maxwidth', maxWidth);
    url.searchParams.set('key', apiKey);

    // Fetch and proxy the image
    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Google Places Photo error:', response.status);
      return NextResponse.json({
        error: 'Failed to fetch photo'
      }, { status: 500 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable' // Cache for 1 year
      }
    });

  } catch (error) {
    console.error('Photo proxy error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

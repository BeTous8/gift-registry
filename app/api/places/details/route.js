import { NextResponse } from 'next/server';

// GET - Get place details by place_id
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('place_id');

    if (!placeId) {
      return NextResponse.json({
        error: 'place_id is required'
      }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return NextResponse.json({
        error: 'Places API not configured'
      }, { status: 500 });
    }

    // Call Google Places Details API
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('fields', 'name,formatted_address,geometry,photos,rating,types');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places Details error:', data.status, data.error_message);
      return NextResponse.json({
        error: 'Failed to fetch place details',
        status: data.status
      }, { status: 500 });
    }

    // Extract only needed data
    const place = data.result;

    return NextResponse.json({
      place: {
        place_id: placeId,
        name: place.name,
        formatted_address: place.formatted_address,
        geometry: {
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng
        },
        photos: place.photos?.slice(0, 3).map(p => ({
          photo_reference: p.photo_reference,
          width: p.width,
          height: p.height
        })) || [],
        rating: place.rating,
        types: place.types
      }
    });

  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

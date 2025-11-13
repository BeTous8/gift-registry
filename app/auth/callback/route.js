import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error_description = requestUrl.searchParams.get('error_description');
  const error = requestUrl.searchParams.get('error');
  const next = '/dashboard';

  // Handle OAuth errors
  if (error_description || error) {
    const errorMsg = error_description || error || 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url)
    );
  }

  if (code) {
    try {
      // Create Supabase client with cookie handling for server-side
      const cookieStore = await cookies();
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            get(name) {
              return cookieStore.get(name)?.value;
            },
            set(name, value, options) {
              try {
                cookieStore.set({ name, value, ...options });
              } catch (error) {
                // Handle cookie setting errors
              }
            },
            remove(name, options) {
              try {
                cookieStore.set({ name, value: '', ...options });
              } catch (error) {
                // Handle cookie removal errors
              }
            },
          },
        }
      );

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError) {
        // Success - redirect to dashboard
        return NextResponse.redirect(new URL(next, request.url));
      } else {
        // Error exchanging code
        console.error('Error exchanging code:', exchangeError);
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        );
      }
    } catch (err) {
      console.error('Callback error:', err);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`, request.url)
      );
    }
  }

  // No code provided - redirect to login
  return NextResponse.redirect(
    new URL('/login?error=No authentication code provided', request.url)
  );
}


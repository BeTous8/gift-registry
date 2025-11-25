import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error_description = requestUrl.searchParams.get('error_description');
  const error = requestUrl.searchParams.get('error');
  const returnUrl = requestUrl.searchParams.get('returnUrl');
  const next = returnUrl ? decodeURIComponent(returnUrl) : '/dashboard';

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
      // Use proper cookie options for mobile compatibility
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
                // Set secure cookies with SameSite=None for cross-site requests (mobile)
                cookieStore.set({ 
                  name, 
                  value, 
                  ...options,
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production',
                  httpOnly: false, // Allow client-side access for mobile
                });
              } catch (error) {
                console.error('Error setting cookie:', error);
              }
            },
            remove(name, options) {
              try {
                cookieStore.set({ 
                  name, 
                  value: '', 
                  ...options,
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production',
                  httpOnly: false,
                });
              } catch (error) {
                console.error('Error removing cookie:', error);
              }
            },
          },
        }
      );

      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError && sessionData?.session) {
        // Success - redirect to dashboard with a small delay to ensure cookies are set
        // This helps with mobile browsers that need time to process cookies
        const redirectUrl = new URL(next, request.url);
        redirectUrl.searchParams.set('auth', 'success'); // Add success param for client-side detection
        
        const response = NextResponse.redirect(redirectUrl);
        
        // Set additional headers for mobile compatibility
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        
        return response;
      } else {
        // Error exchanging code
        console.error('Error exchanging code:', exchangeError);
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(exchangeError?.message || 'Authentication failed')}`, request.url)
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


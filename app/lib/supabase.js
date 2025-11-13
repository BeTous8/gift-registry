import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage for better mobile compatibility
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Auto-refresh session for mobile
    autoRefreshToken: true,
    // Persist session across page reloads
    persistSession: true,
    // Detect session from URL (for OAuth redirects)
    detectSessionInUrl: true,
    // Flow type - use PKCE for better mobile security
    flowType: 'pkce',
  }
})

export default supabase

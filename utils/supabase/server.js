// utils/supabase/server.js

const { createClient } = require('@supabase/supabase-js');

// Use the SUPABASE_SERVICE_ROLE_KEY for server-side operations
// This client bypasses Row Level Security (RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabaseAdmin };
-- ============================================
-- ROLLBACK SCRIPT
-- Calendar & Registry Unification
-- ============================================

-- DANGER: Only run this if the migration fails!
-- This will delete all data and restore from backup CSVs

-- Prerequisites:
-- 1. Have backup CSV files ready
-- 2. Verify backup data integrity
-- 3. Coordinate with users (announce downtime)

-- ============================================
-- STEP 1: Disable RLS (for restoration)
-- ============================================
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop modified events table
-- ============================================
DROP TABLE IF EXISTS events CASCADE;

-- ============================================
-- STEP 3: Recreate original events table
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  slug TEXT UNIQUE NOT NULL,
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  event_date DATE NOT NULL,
  event_type TEXT CHECK (event_type IN ('gift-registry', 'casual-meetup')),
  location JSONB,
  theme TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 4: Recreate user_events table
-- ============================================
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('ceremony', 'casual')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 5: Restore data from CSV backups
-- ============================================
-- NOTE: In Supabase SQL Editor, you'll need to manually import CSVs
-- Go to Table Editor > events > Import Data > Upload CSV

-- After importing, verify counts match backup counts

-- ============================================
-- STEP 6: Recreate indexes
-- ============================================

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_invite_code ON events(invite_code);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- User events table indexes
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_date ON user_events(event_date);
CREATE INDEX IF NOT EXISTS idx_user_events_recurring ON user_events(is_recurring, user_id, EXTRACT(MONTH FROM event_date), EXTRACT(DAY FROM event_date));

-- ============================================
-- STEP 7: Recreate RLS policies
-- ============================================

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Events table RLS policies
CREATE POLICY "Users can view their own events"
  ON events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public events"
  ON events FOR SELECT
  USING (is_private = false);

CREATE POLICY "Invited users can view private events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.event_id = events.id
        AND invitations.invitee_user_id = auth.uid()
        AND invitations.status = 'accepted'
    )
  );

-- User events table RLS policies
CREATE POLICY "Users can view their own calendar events"
  ON user_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events"
  ON user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
  ON user_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
  ON user_events FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Invited users can view calendar events"
  ON user_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.event_id = user_events.id
        AND invitations.invitee_user_id = auth.uid()
        AND invitations.status = 'accepted'
    )
  );

-- ============================================
-- STEP 8: Recreate get_user_events_in_range function
-- ============================================
CREATE OR REPLACE FUNCTION get_user_events_in_range(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  event_date DATE,
  event_type TEXT,
  is_recurring BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  display_date DATE
) AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY

  -- One-time events
  SELECT
    e.id, e.title, e.description, e.event_date, e.event_type,
    e.is_recurring, e.created_at, e.updated_at,
    e.event_date AS display_date
  FROM user_events e
  WHERE e.user_id = p_user_id
    AND e.is_recurring = false
    AND e.event_date BETWEEN p_start_date AND p_end_date

  UNION ALL

  -- Recurring events
  SELECT
    e.id, e.title, e.description, e.event_date, e.event_type,
    e.is_recurring, e.created_at, e.updated_at,
    make_date(
      year_series.year,
      EXTRACT(MONTH FROM e.event_date)::INTEGER,
      EXTRACT(DAY FROM e.event_date)::INTEGER
    ) AS display_date
  FROM user_events e
  CROSS JOIN generate_series(
    EXTRACT(YEAR FROM p_start_date)::INTEGER,
    EXTRACT(YEAR FROM p_end_date)::INTEGER
  ) AS year_series(year)
  WHERE e.user_id = p_user_id
    AND e.is_recurring = true
    AND make_date(
      year_series.year,
      EXTRACT(MONTH FROM e.event_date)::INTEGER,
      EXTRACT(DAY FROM e.event_date)::INTEGER
    ) BETWEEN p_start_date AND p_end_date

  UNION ALL

  -- Invited events
  SELECT
    e.id, e.title, e.description, e.event_date, e.event_type,
    e.is_recurring, e.created_at, e.updated_at,
    e.event_date AS display_date
  FROM user_events e
  INNER JOIN invitations i ON e.id = i.event_id
  WHERE i.invitee_user_id = p_user_id
    AND i.status = 'accepted'
    AND e.event_date BETWEEN p_start_date AND p_end_date

  ORDER BY display_date ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- ============================================
-- STEP 9: Verify data restoration
-- ============================================

-- Run these queries and compare to backup counts:
SELECT 'events' as table_name, COUNT(*) as row_count FROM events
UNION ALL
SELECT 'user_events', COUNT(*) FROM user_events
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations
UNION ALL
SELECT 'contributions', COUNT(*) FROM contributions
UNION ALL
SELECT 'fulfillments', COUNT(*) FROM fulfillments;

-- Verify sample data looks correct:
SELECT * FROM events ORDER BY created_at DESC LIMIT 5;
SELECT * FROM user_events ORDER BY created_at DESC LIMIT 5;

-- ============================================
-- STEP 10: Re-enable application
-- ============================================
-- 1. Deploy previous version of Next.js app to Netlify
-- 2. Verify API endpoints work correctly
-- 3. Test critical user flows
-- 4. Announce service restored

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================
-- Post-rollback actions:
-- 1. Investigate what went wrong with migration
-- 2. Fix issues in staging environment
-- 3. Test thoroughly before attempting migration again
-- 4. Document lessons learned

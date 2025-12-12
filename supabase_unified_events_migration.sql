-- ============================================
-- UNIFIED EVENTS TABLE MIGRATION
-- Merges user_events (calendar) + events (registry) into single events table
-- ============================================
-- Run this in Supabase SQL Editor
-- Estimated time: < 1 minute (for small datasets)
-- ============================================

-- ============================================
-- STEP 1: Add calendar features to events table
-- ============================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registry_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_category TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- STEP 2: Make registry-specific fields nullable
-- ============================================
-- These fields will be NULL for calendar-only events
ALTER TABLE events
  ALTER COLUMN slug DROP NOT NULL,
  ALTER COLUMN invite_code DROP NOT NULL;

-- ============================================
-- STEP 3: Update existing events (all are registries)
-- ============================================
UPDATE events
SET
  registry_enabled = true,
  event_category = CASE event_type
    WHEN 'gift-registry' THEN 'other'
    WHEN 'casual-meetup' THEN 'casual'
    ELSE 'other'
  END
WHERE event_category IS NULL;

-- ============================================
-- STEP 4: Migrate user_events data to events table
-- ============================================
INSERT INTO events (
  user_id,
  title,
  description,
  event_date,
  event_category,
  is_recurring,
  registry_enabled,
  created_at,
  updated_at
)
SELECT
  user_id,
  title,
  description,
  event_date,
  CASE event_type
    WHEN 'ceremony' THEN 'other'  -- Map ceremony → other
    WHEN 'casual' THEN 'casual'
    ELSE 'other'
  END,
  is_recurring,
  false,  -- Calendar events have no registry
  created_at,
  updated_at
FROM user_events;

-- ============================================
-- STEP 5: Add constraints
-- ============================================
ALTER TABLE events
  ADD CONSTRAINT registry_requires_slug CHECK (
    (registry_enabled = false) OR
    (registry_enabled = true AND slug IS NOT NULL AND invite_code IS NOT NULL)
  ),
  ADD CONSTRAINT event_category_valid CHECK (
    event_category IN (
      'birthday', 'anniversary', 'wedding', 'baby-shower',
      'holiday', 'casual', 'graduation', 'retirement', 'other'
    )
  );

-- Note: We allow recurring events to have registries enabled
-- The registry is one-time for that year, but the calendar reminder recurs

-- ============================================
-- STEP 6: Create updated_at trigger for events table
-- ============================================
-- Create trigger function if it doesn't exist (may already exist from user_events migration)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_updated_at ON events;

-- Create trigger for events table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 7: Create indexes for calendar queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_calendar_recurring
  ON events(user_id, EXTRACT(MONTH FROM event_date), EXTRACT(DAY FROM event_date))
  WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_events_registry_enabled
  ON events(user_id, registry_enabled, event_date);

CREATE INDEX IF NOT EXISTS idx_events_category
  ON events(event_category, event_date);

-- ============================================
-- STEP 8: Update RLS policies (if needed)
-- ============================================
-- Existing RLS policies already work because they filter by user_id
-- No changes needed - calendar events follow same security model

-- ============================================
-- STEP 9: Update get_user_events_in_range function
-- ============================================
-- Drop old function that queried user_events table
DROP FUNCTION IF EXISTS get_user_events_in_range(UUID, DATE, DATE);

-- Create new function that queries unified events table
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
  event_category TEXT,
  is_recurring BOOLEAN,
  registry_enabled BOOLEAN,
  slug TEXT,
  invite_code TEXT,
  location JSONB,
  theme TEXT,
  is_private BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  display_date DATE
) AS $$
BEGIN
  -- Security check
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY

  -- One-time events (both calendar and registry)
  SELECT
    e.id, e.title, e.description, e.event_date, e.event_category,
    e.is_recurring, e.registry_enabled, e.slug, e.invite_code, e.location,
    e.theme, e.is_private,
    e.created_at, e.updated_at,
    e.event_date AS display_date
  FROM events e
  WHERE e.user_id = p_user_id
    AND e.is_recurring = false
    AND e.event_date BETWEEN p_start_date AND p_end_date

  UNION ALL

  -- Recurring events (can have registry OR not)
  SELECT
    e.id, e.title, e.description, e.event_date, e.event_category,
    e.is_recurring, e.registry_enabled, e.slug, e.invite_code, e.location,
    e.theme, e.is_private,
    e.created_at, e.updated_at,
    make_date(
      year_series.year,
      EXTRACT(MONTH FROM e.event_date)::INTEGER,
      EXTRACT(DAY FROM e.event_date)::INTEGER
    ) AS display_date
  FROM events e
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

  -- Invited events (calendar OR registry)
  SELECT
    e.id, e.title, e.description, e.event_date, e.event_category,
    e.is_recurring, e.registry_enabled, e.slug, e.invite_code, e.location,
    e.theme, e.is_private,
    e.created_at, e.updated_at,
    e.event_date AS display_date
  FROM events e
  INNER JOIN invitations i ON e.id = i.event_id
  WHERE i.invitee_user_id = p_user_id
    AND i.status = 'accepted'
    AND e.event_date BETWEEN p_start_date AND p_end_date

  ORDER BY display_date ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- ============================================
-- STEP 10: Drop user_events table
-- ============================================
DROP TABLE IF EXISTS user_events CASCADE;

-- ============================================
-- STEP 11: Verification queries
-- ============================================
-- Run these to verify migration success:

-- Count events by type
SELECT
  CASE
    WHEN registry_enabled = true THEN 'Registry Events'
    WHEN registry_enabled = false AND is_recurring = true THEN 'Recurring Calendar Events'
    WHEN registry_enabled = false AND is_recurring = false THEN 'One-time Calendar Events'
  END as event_type,
  COUNT(*) as count
FROM events
GROUP BY registry_enabled, is_recurring
ORDER BY event_type;

-- Check for any NULL event_category (should be none)
SELECT COUNT(*) as null_category_count
FROM events
WHERE event_category IS NULL;

-- Check constraint violations (should return 0 rows)
SELECT id, title, registry_enabled, slug, invite_code
FROM events
WHERE registry_enabled = true AND (slug IS NULL OR invite_code IS NULL);

-- Sample of migrated calendar events
SELECT id, title, event_date, event_category, is_recurring, registry_enabled
FROM events
WHERE registry_enabled = false
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Verify query results look correct
-- 2. Test the get_user_events_in_range function
-- 3. Proceed to Phase 2: Update API routes

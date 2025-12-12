-- ============================================
-- DATABASE BACKUP SCRIPT
-- Calendar & Registry Unification - Phase 0
-- Run this BEFORE executing the migration
-- ============================================

-- Purpose: Export all data from events and user_events tables
-- Usage: Run these queries in Supabase SQL Editor
-- Each query will download a CSV that can be used for rollback

-- ============================================
-- BACKUP: events table (gift registries)
-- ============================================
-- NOTE: Supabase SQL Editor doesn't support COPY TO file directly
-- Instead, run these SELECT queries and export results as CSV

-- Export events table
-- Click "Download as CSV" after running this query
SELECT
  id,
  user_id,
  title,
  slug,
  description,
  event_date,
  event_type,
  location,
  theme,
  invite_code,
  is_private,
  created_at,
  updated_at
FROM events
ORDER BY created_at ASC;

-- Save as: events_backup_YYYY-MM-DD.csv

-- ============================================
-- BACKUP: user_events table (calendar events)
-- ============================================
SELECT
  id,
  user_id,
  title,
  description,
  event_date,
  event_type,
  is_recurring,
  created_at,
  updated_at
FROM user_events
ORDER BY created_at ASC;

-- Save as: user_events_backup_YYYY-MM-DD.csv

-- ============================================
-- BACKUP: items table (registry items)
-- ============================================
SELECT
  id,
  event_id,
  name,
  price_cents,
  current_amount_cents,
  url,
  image_url,
  notes,
  status,
  created_at,
  updated_at
FROM items
ORDER BY event_id, created_at ASC;

-- Save as: items_backup_YYYY-MM-DD.csv

-- ============================================
-- BACKUP: invitations table
-- ============================================
SELECT
  id,
  event_id,
  inviter_user_id,
  invitee_user_id,
  status,
  created_at,
  updated_at
FROM invitations
ORDER BY event_id, created_at ASC;

-- Save as: invitations_backup_YYYY-MM-DD.csv

-- ============================================
-- BACKUP: contributions table
-- ============================================
SELECT
  id,
  event_id,
  item_id,
  contributor_user_id,
  amount_cents,
  stripe_payment_intent_id,
  status,
  created_at,
  updated_at
FROM contributions
ORDER BY event_id, created_at ASC;

-- Save as: contributions_backup_YYYY-MM-DD.csv

-- ============================================
-- BACKUP: fulfillments table (if exists)
-- ============================================
SELECT
  id,
  event_id,
  item_id,
  recipient_user_id,
  amount_cents,
  stripe_transfer_id,
  stripe_payout_id,
  status,
  initiated_at,
  completed_at,
  created_at,
  updated_at
FROM fulfillments
ORDER BY event_id, created_at ASC;

-- Save as: fulfillments_backup_YYYY-MM-DD.csv

-- ============================================
-- VERIFICATION COUNTS
-- ============================================
-- Run these to record current counts
-- Compare after migration to ensure no data loss

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

-- Save these counts to verify after migration!

-- ============================================
-- BACKUP COMPLETE
-- ============================================
-- Next steps:
-- 1. Download all CSV files from query results
-- 2. Store in safe location with date stamp
-- 3. Verify all files downloaded successfully
-- 4. Record verification counts
-- 5. Proceed to Phase 1 migration

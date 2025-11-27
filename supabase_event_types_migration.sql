-- ============================================
-- MEMORA EVENT TYPES & LOCATION FEATURE
-- Database Migration: Events Table + User Contacts
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: EVENTS TABLE MODIFICATIONS
-- ============================================

-- Add event_type column (default 'gift-registry' for backward compatibility)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'gift-registry'
CHECK (event_type IN ('gift-registry', 'casual-meetup'));

-- Add location column (JSONB for Google Places data)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS location JSONB;

-- Add theme column for optional event theming
ALTER TABLE events
ADD COLUMN IF NOT EXISTS theme TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_location_gin ON events USING GIN (location);

-- Add comments for documentation
COMMENT ON COLUMN events.event_type IS 'Type of event: gift-registry or casual-meetup (immutable after creation)';
COMMENT ON COLUMN events.location IS 'JSONB: {place_id, name, formatted_address, geometry: {lat, lng}, photos: [], rating, types}';
COMMENT ON COLUMN events.theme IS 'Optional theme for the event (e.g., Birthday, Wedding, Beach Party)';

-- ============================================
-- PART 2: USER CONTACTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure user can't add themselves and no duplicates
  CONSTRAINT no_self_contact CHECK (user_id != contact_user_id),
  UNIQUE(user_id, contact_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_contact_user_id ON user_contacts(contact_user_id);

-- Add comment for documentation
COMMENT ON TABLE user_contacts IS 'Stores user contact lists for quick event invitations';

-- ============================================
-- PART 3: RLS POLICIES FOR USER_CONTACTS
-- ============================================

ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;

-- Users can view their own contacts
CREATE POLICY "Users can view their own contacts"
ON user_contacts FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can add contacts
CREATE POLICY "Users can add contacts"
ON user_contacts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can remove their contacts
CREATE POLICY "Users can remove their contacts"
ON user_contacts FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify:

-- 1. Check events table has new columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'events'
-- AND column_name IN ('event_type', 'location', 'theme');

-- 2. Check user_contacts table exists
-- SELECT * FROM user_contacts LIMIT 1;

-- 3. Test event type constraint (should fail)
-- INSERT INTO events (user_id, title, slug, event_type, invite_code)
-- VALUES ('some-uuid', 'Test', 'test-slug', 'invalid-type', 'code123');

-- ============================================
-- ROLLBACK SCRIPT (use only if needed)
-- ============================================
-- DROP POLICY IF EXISTS "Users can remove their contacts" ON user_contacts;
-- DROP POLICY IF EXISTS "Users can add contacts" ON user_contacts;
-- DROP POLICY IF EXISTS "Users can view their own contacts" ON user_contacts;
-- DROP TABLE IF EXISTS user_contacts;
-- DROP INDEX IF EXISTS idx_events_location_gin;
-- DROP INDEX IF EXISTS idx_events_event_type;
-- ALTER TABLE events DROP COLUMN IF EXISTS theme;
-- ALTER TABLE events DROP COLUMN IF EXISTS location;
-- ALTER TABLE events DROP COLUMN IF EXISTS event_type;

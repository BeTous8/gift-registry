-- ============================================
-- MEMORA INVITEES FEATURE - DATABASE MIGRATION
-- Run these SQL commands in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: MODIFY EVENTS TABLE
-- ============================================

-- Add invite_code column for shareable links
ALTER TABLE events
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Add is_private column (default false = public events work as before)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Generate invite codes for existing events
UPDATE events
SET invite_code = substr(md5(random()::text), 1, 12)
WHERE invite_code IS NULL;

-- Make invite_code NOT NULL after populating existing rows
ALTER TABLE events
ALTER COLUMN invite_code SET NOT NULL;

-- Create index for faster invite code lookups
CREATE INDEX IF NOT EXISTS idx_events_invite_code ON events(invite_code);

-- ============================================
-- STEP 2: CREATE EVENT_INVITATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS event_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_invitations_event_id ON event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_email ON event_invitations(email);

-- ============================================
-- STEP 3: CREATE EVENT_MEMBERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS event_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_members_event_id ON event_members(event_id);
CREATE INDEX IF NOT EXISTS idx_event_members_user_id ON event_members(user_id);

-- ============================================
-- STEP 4: RLS POLICIES FOR EVENT_INVITATIONS
-- ============================================

ALTER TABLE event_invitations ENABLE ROW LEVEL SECURITY;

-- Event owners can manage invitations
CREATE POLICY "Event owners can view invitations"
ON event_invitations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_invitations.event_id
    AND events.user_id = auth.uid()
  )
);

CREATE POLICY "Event owners can create invitations"
ON event_invitations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_invitations.event_id
    AND events.user_id = auth.uid()
  )
);

CREATE POLICY "Event owners can delete invitations"
ON event_invitations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_invitations.event_id
    AND events.user_id = auth.uid()
  )
);

-- Users can view and respond to their own invitations
CREATE POLICY "Users can view their invitations"
ON event_invitations FOR SELECT TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can respond to invitations"
ON event_invitations FOR UPDATE TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================
-- STEP 5: RLS POLICIES FOR EVENT_MEMBERS
-- ============================================

ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

-- Event owners can manage members
CREATE POLICY "Event owners can view members"
ON event_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_members.event_id
    AND events.user_id = auth.uid()
  )
);

CREATE POLICY "Event owners can remove members"
ON event_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_members.event_id
    AND events.user_id = auth.uid()
  )
);

-- Members can view other members
CREATE POLICY "Members can view fellow members"
ON event_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_members em
    WHERE em.event_id = event_members.event_id
    AND em.user_id = auth.uid()
  )
);

-- Users can join events (controlled by API)
CREATE POLICY "Users can join events"
ON event_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Members can leave events
CREATE POLICY "Members can leave events"
ON event_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- STEP 6: UPDATE EVENTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Public can view events" ON events;

-- Authenticated: view owned, public, or member events
CREATE POLICY "Users can view accessible events"
ON events FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_private = false
  OR EXISTS (
    SELECT 1 FROM event_members
    WHERE event_members.event_id = events.id
    AND event_members.user_id = auth.uid()
  )
);

-- Anon: view public events only
CREATE POLICY "Public can view public events"
ON events FOR SELECT TO anon
USING (is_private = false);

-- ============================================
-- STEP 7: UPDATE ITEMS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view items for their own events" ON items;
DROP POLICY IF EXISTS "Public can view items" ON items;

-- Authenticated: view items for accessible events
CREATE POLICY "Users can view items for accessible events"
ON items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND (
      events.user_id = auth.uid()
      OR events.is_private = false
      OR EXISTS (
        SELECT 1 FROM event_members
        WHERE event_members.event_id = events.id
        AND event_members.user_id = auth.uid()
      )
    )
  )
);

-- Anon: view items for public events only
CREATE POLICY "Public can view items for public events"
ON items FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND events.is_private = false
  )
);

-- ============================================
-- DONE! Run this in Supabase SQL Editor
-- ============================================

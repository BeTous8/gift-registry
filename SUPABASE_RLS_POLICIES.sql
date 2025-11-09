-- Supabase RLS Policies for Gift Registry
-- Run these SQL commands in your Supabase SQL Editor to set up Row-Level Security

-- ============================================
-- ITEMS TABLE POLICIES
-- ============================================

-- Enable RLS on items table (if not already enabled)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to INSERT items for events they own
-- This policy checks if the event belongs to the authenticated user
CREATE POLICY "Users can insert items for their own events"
ON items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy: Allow users to SELECT (read) items for events they own
CREATE POLICY "Users can view items for their own events"
ON items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy: Allow users to UPDATE items for events they own
CREATE POLICY "Users can update items for their own events"
ON items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND events.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy: Allow users to DELETE items for events they own
CREATE POLICY "Users can delete items for their own events"
ON items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = items.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy: Allow public (unauthenticated) users to SELECT items
-- This allows the public event page to display items
CREATE POLICY "Public can view items"
ON items
FOR SELECT
TO anon
USING (true);

-- ============================================
-- EVENTS TABLE POLICIES (if needed)
-- ============================================

-- Enable RLS on events table (if not already enabled)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to INSERT their own events
CREATE POLICY "Users can create their own events"
ON events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to SELECT (read) all events
-- This allows the dashboard to show all events
CREATE POLICY "Anyone can view events"
ON events
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow public (unauthenticated) users to SELECT events
-- This allows the public event page to work
CREATE POLICY "Public can view events"
ON events
FOR SELECT
TO anon
USING (true);

-- Policy: Allow users to UPDATE their own events
CREATE POLICY "Users can update their own events"
ON events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to DELETE their own events
CREATE POLICY "Users can delete their own events"
ON events
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


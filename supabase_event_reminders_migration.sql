-- ============================================
-- EVENT REMINDERS TABLE
-- Max 2 reminders per event (spam prevention)
-- ============================================

-- Create the event_reminders table
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN (
    '1_hour', '2_hours', '1_day', '2_days', '3_days', '1_week', '2_weeks', '1_month'
  )),
  send_to_members BOOLEAN NOT NULL DEFAULT true,  -- Send to all event members
  is_sent BOOLEAN NOT NULL DEFAULT false,
  scheduled_for TIMESTAMPTZ NOT NULL,  -- Computed from event_date - reminder_type
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate reminders for same event + timing
  UNIQUE(event_id, reminder_type)
);

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON event_reminders(scheduled_for, is_sent)
  WHERE is_sent = false;

-- Create index for event lookups
CREATE INDEX IF NOT EXISTS idx_reminders_event_id
  ON event_reminders(event_id);

-- ============================================
-- MAX 2 REMINDERS ENFORCEMENT
-- Trigger function to prevent more than 2 reminders per event
-- ============================================

CREATE OR REPLACE FUNCTION check_max_reminders()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM event_reminders WHERE event_id = NEW.event_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 reminders per event allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS enforce_max_reminders ON event_reminders;

-- Create the trigger
CREATE TRIGGER enforce_max_reminders
  BEFORE INSERT ON event_reminders
  FOR EACH ROW
  EXECUTE FUNCTION check_max_reminders();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view reminders for their own events
CREATE POLICY "Users can view reminders for their events"
  ON event_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_reminders.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Policy: Users can create reminders for their own events
CREATE POLICY "Users can create reminders for their events"
  ON event_reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_reminders.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Policy: Users can update reminders for their own events
CREATE POLICY "Users can update reminders for their events"
  ON event_reminders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_reminders.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Policy: Users can delete reminders for their own events
CREATE POLICY "Users can delete reminders for their events"
  ON event_reminders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_reminders.event_id
      AND events.user_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTION: Calculate scheduled_for from event_date and reminder_type
-- Can be used in application or as a database function
-- ============================================

CREATE OR REPLACE FUNCTION calculate_reminder_time(
  p_event_date DATE,
  p_reminder_type TEXT
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_event_timestamp TIMESTAMPTZ;
BEGIN
  -- Convert date to timestamp (assumes 9am event time for date-only events)
  v_event_timestamp := p_event_date::TIMESTAMPTZ + INTERVAL '9 hours';

  RETURN CASE p_reminder_type
    WHEN '1_hour' THEN v_event_timestamp - INTERVAL '1 hour'
    WHEN '2_hours' THEN v_event_timestamp - INTERVAL '2 hours'
    WHEN '1_day' THEN v_event_timestamp - INTERVAL '1 day'
    WHEN '2_days' THEN v_event_timestamp - INTERVAL '2 days'
    WHEN '3_days' THEN v_event_timestamp - INTERVAL '3 days'
    WHEN '1_week' THEN v_event_timestamp - INTERVAL '1 week'
    WHEN '2_weeks' THEN v_event_timestamp - INTERVAL '2 weeks'
    WHEN '1_month' THEN v_event_timestamp - INTERVAL '1 month'
    ELSE v_event_timestamp
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- For the cron job to update reminders after sending
-- ============================================

-- The service role key will bypass RLS, so no additional grants needed
-- Just ensure the cron job uses SUPABASE_SERVICE_ROLE_KEY

COMMENT ON TABLE event_reminders IS 'Stores scheduled reminders for events. Max 2 per event.';
COMMENT ON COLUMN event_reminders.reminder_type IS 'Timing: 1_hour, 2_hours, 1_day, 2_days, 3_days, 1_week, 2_weeks, 1_month';
COMMENT ON COLUMN event_reminders.send_to_members IS 'If true, sends to all accepted event members. If false, only event owner.';
COMMENT ON COLUMN event_reminders.scheduled_for IS 'Calculated timestamp when reminder should be sent';

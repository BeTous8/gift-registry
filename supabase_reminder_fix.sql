-- ============================================
-- FIX: Reminder UPDATE trigger blocking is_sent updates
--
-- Problem: The trigger runs on UPDATE and throws an exception
-- when scheduled_for is in the past, blocking is_sent = true updates.
--
-- Solution: Only validate "past reminder" on INSERT, not UPDATE.
-- On UPDATE, only recalculate scheduled_for if reminder_type changes.
-- ============================================

-- Replace the trigger function with fixed version
CREATE OR REPLACE FUNCTION auto_calculate_scheduled_for()
RETURNS TRIGGER AS $$
DECLARE
  v_event_date DATE;
BEGIN
  -- On UPDATE: only recalculate if reminder_type changed
  -- This allows is_sent/sent_at updates to pass through without validation
  IF TG_OP = 'UPDATE' THEN
    -- If reminder_type hasn't changed, just allow the update
    IF OLD.reminder_type = NEW.reminder_type AND OLD.event_id = NEW.event_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get the event_date from the events table
  SELECT event_date INTO v_event_date
  FROM events
  WHERE id = NEW.event_id;

  -- If event has no date, raise an error
  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'Cannot create reminder for event without a date';
  END IF;

  -- Auto-calculate the scheduled_for timestamp
  NEW.scheduled_for := calculate_reminder_time(v_event_date, NEW.reminder_type);

  -- Only validate "not in past" on INSERT (new reminders)
  -- Allow UPDATE to proceed even if event is past (for is_sent updates)
  IF TG_OP = 'INSERT' AND NEW.scheduled_for < NOW() THEN
    RAISE EXCEPTION 'Cannot create reminder for a time that has already passed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: No need to recreate the trigger - it already references this function
-- The function replacement takes effect immediately

COMMENT ON FUNCTION auto_calculate_scheduled_for() IS
  'Validates reminders on INSERT, allows is_sent updates on UPDATE without blocking';

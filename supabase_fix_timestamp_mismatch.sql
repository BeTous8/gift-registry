-- ============================================
-- FIX: Timestamp type mismatch in get_user_events_in_range
-- ============================================

DROP FUNCTION IF EXISTS get_user_events_in_range(UUID, DATE, DATE);

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
  created_at TIMESTAMP,  -- Changed from TIMESTAMPTZ
  updated_at TIMESTAMP,  -- Changed from TIMESTAMPTZ
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

  ORDER BY display_date ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- Verification: Test the function for December 2025
SELECT
  title,
  event_date,
  display_date,
  event_category,
  is_recurring,
  registry_enabled
FROM get_user_events_in_range(
  auth.uid(),
  '2025-12-01'::DATE,
  '2025-12-31'::DATE
);

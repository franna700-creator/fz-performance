BEGIN;

ALTER TABLE fz_athlete_events
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS fz_athlete_events_reported_idx
  ON fz_athlete_events (reported_at DESC NULLS LAST, event_id DESC);

CREATE OR REPLACE VIEW fz_training_timeline AS
SELECT
  e.event_id,
  e.event_key,
  e.session_id,
  e.event_type,
  e.occurred_at,
  e.local_date,
  e.actor,
  e.certainty,
  e.summary,
  e.payload,
  s.title,
  s.sport_type,
  s.session_kind,
  s.status,
  s.reconciliation_state,
  e.reported_at
FROM fz_athlete_events e
LEFT JOIN fz_training_sessions s ON s.session_id = e.session_id
ORDER BY e.occurred_at DESC, e.event_id DESC;

COMMIT;

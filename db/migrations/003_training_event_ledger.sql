BEGIN;

CREATE TABLE IF NOT EXISTS fz_training_source_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_key TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('planned_workout','executed_activity','athlete_feedback','event_context','recommendation','decision')),
  source_record_id TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ,
  local_date DATE NOT NULL,
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  payload JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, record_type, source_record_id, source_hash)
);

CREATE INDEX IF NOT EXISTS fz_training_source_records_lookup_idx
  ON fz_training_source_records (source_key, record_type, local_date DESC, source_record_id, ingested_at DESC);

CREATE OR REPLACE VIEW fz_training_source_latest AS
SELECT DISTINCT ON (source_key, record_type, source_record_id)
  *
FROM fz_training_source_records
ORDER BY source_key, record_type, source_record_id, source_updated_at DESC NULLS LAST, ingested_at DESC, id DESC;

CREATE TABLE IF NOT EXISTS fz_training_sessions (
  session_id TEXT PRIMARY KEY,
  local_date DATE NOT NULL,
  planned_start_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ,
  title TEXT,
  sport_type TEXT,
  session_kind TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (status IN ('UNKNOWN','PLANNED','RECOMMENDED','ACCEPTED','MODIFIED','IN_PROGRESS','COMPLETED','STOPPED_EARLY','ABORTED','SKIPPED','SUPERSEDED')),
  reconciliation_state TEXT NOT NULL DEFAULT 'UNMATCHED'
    CHECK (reconciliation_state IN ('UNMATCHED','MATCH_REQUIRED','MATCHED','MANUAL')),
  parent_session_id TEXT REFERENCES fz_training_sessions(session_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fz_training_sessions_date_idx
  ON fz_training_sessions (local_date DESC, actual_start_at DESC NULLS LAST, planned_start_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS fz_training_session_sources (
  session_id TEXT NOT NULL REFERENCES fz_training_sessions(session_id) ON DELETE CASCADE,
  source_record_pk BIGINT NOT NULL REFERENCES fz_training_source_records(id),
  relationship TEXT NOT NULL CHECK (relationship IN ('PLAN','EXECUTION','EVIDENCE','MATCH_CANDIDATE')),
  match_method TEXT NOT NULL DEFAULT 'SOURCE_NATIVE',
  match_confidence NUMERIC CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, source_record_pk, relationship)
);

CREATE INDEX IF NOT EXISTS fz_training_session_sources_record_idx
  ON fz_training_session_sources (source_record_pk, session_id);

CREATE TABLE IF NOT EXISTS fz_athlete_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  session_id TEXT REFERENCES fz_training_sessions(session_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('PLANNED','RECOMMENDED','ATHLETE_ACCEPTED','ATHLETE_MODIFIED','STARTED','EXECUTED','STOPPED_EARLY','ABORTED','SKIPPED','POST_SESSION_FEEDBACK','NEXT_DAY_RESPONSE','CONTEXT','RECONCILED','LINKED')),
  occurred_at TIMESTAMPTZ NOT NULL,
  local_date DATE NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('ATHLETE','FZ','TREDICT','GARMIN','SYSTEM')),
  source_key TEXT,
  source_record_pk BIGINT REFERENCES fz_training_source_records(id),
  certainty TEXT NOT NULL DEFAULT 'OBSERVED'
    CHECK (certainty IN ('OBSERVED','REPORTED','INFERRED','HYPOTHESIS')),
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fz_athlete_events_timeline_idx
  ON fz_athlete_events (local_date DESC, occurred_at DESC, event_id DESC);
CREATE INDEX IF NOT EXISTS fz_athlete_events_session_idx
  ON fz_athlete_events (session_id, occurred_at, event_id);

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
  s.reconciliation_state
FROM fz_athlete_events e
LEFT JOIN fz_training_sessions s ON s.session_id = e.session_id
ORDER BY e.occurred_at DESC, e.event_id DESC;

COMMIT;

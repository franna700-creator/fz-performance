BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION fz_record_athlete_memory(
  p_event_key TEXT,
  p_event_type TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_local_date DATE,
  p_summary TEXT,
  p_categories TEXT[],
  p_session_id TEXT DEFAULT NULL,
  p_certainty TEXT DEFAULT 'REPORTED',
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_source_key TEXT DEFAULT 'conversation',
  p_source_record_id TEXT DEFAULT NULL,
  p_match_method TEXT DEFAULT 'FORWARD_ATHLETE_MEMORY',
  p_match_confidence NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed_categories CONSTANT TEXT[] := ARRAY['STATE','SESSION','COST','RECOVERY','FUELING','CONSTRAINT','HYPOTHESIS'];
  v_source_record_id TEXT;
  v_source_payload JSONB;
  v_source_hash TEXT;
  v_source_record_pk BIGINT;
  v_event_id BIGINT;
  v_inserted BOOLEAN := FALSE;
  v_status TEXT;
  v_category TEXT;
BEGIN
  IF p_event_key IS NULL OR btrim(p_event_key) = '' THEN
    RAISE EXCEPTION 'event_key_required';
  END IF;
  IF p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_required';
  END IF;
  IF p_occurred_at IS NULL OR p_local_date IS NULL THEN
    RAISE EXCEPTION 'event_time_required';
  END IF;
  IF p_summary IS NULL OR btrim(p_summary) = '' THEN
    RAISE EXCEPTION 'event_summary_required';
  END IF;
  IF p_categories IS NULL OR cardinality(p_categories) = 0 THEN
    RAISE EXCEPTION 'memory_category_required';
  END IF;
  FOREACH v_category IN ARRAY p_categories LOOP
    IF NOT (upper(v_category) = ANY(v_allowed_categories)) THEN
      RAISE EXCEPTION 'invalid_memory_category:%', v_category;
    END IF;
  END LOOP;
  IF p_certainty NOT IN ('OBSERVED','REPORTED','INFERRED','HYPOTHESIS') THEN
    RAISE EXCEPTION 'invalid_certainty:%', p_certainty;
  END IF;
  IF p_match_confidence IS NOT NULL AND (p_match_confidence < 0 OR p_match_confidence > 1) THEN
    RAISE EXCEPTION 'invalid_match_confidence';
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fz_training_sessions WHERE session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'unknown_session:%', p_session_id;
  END IF;

  v_source_record_id := COALESCE(NULLIF(btrim(p_source_record_id), ''), p_event_key);
  v_source_payload := COALESCE(p_payload, '{}'::jsonb)
    || jsonb_build_object(
      'memoryCategories', to_jsonb(ARRAY(SELECT upper(x) FROM unnest(p_categories) AS x)),
      'sourceOrigin', COALESCE(NULLIF(p_payload->>'sourceOrigin',''), 'forward-athlete-memory-v1')
    );
  v_source_hash := encode(digest(convert_to(v_source_payload::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO fz_training_source_records
    (source_key, record_type, source_record_id, source_updated_at, local_date, source_hash, payload)
  VALUES
    (COALESCE(NULLIF(btrim(p_source_key), ''), 'conversation'), 'athlete_feedback', v_source_record_id,
     p_occurred_at, p_local_date, v_source_hash, v_source_payload)
  ON CONFLICT (source_key, record_type, source_record_id, source_hash) DO NOTHING
  RETURNING id INTO v_source_record_pk;

  IF v_source_record_pk IS NULL THEN
    SELECT id INTO v_source_record_pk
    FROM fz_training_source_records
    WHERE source_key = COALESCE(NULLIF(btrim(p_source_key), ''), 'conversation')
      AND record_type = 'athlete_feedback'
      AND source_record_id = v_source_record_id
      AND source_hash = v_source_hash
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  INSERT INTO fz_athlete_events
    (event_key, session_id, event_type, occurred_at, local_date, actor, source_key, source_record_pk, certainty, summary, payload)
  VALUES
    (p_event_key, p_session_id, p_event_type, p_occurred_at, p_local_date, 'ATHLETE',
     COALESCE(NULLIF(btrim(p_source_key), ''), 'conversation'), v_source_record_pk, p_certainty,
     p_summary, v_source_payload)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING event_id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    v_inserted := TRUE;
  ELSE
    SELECT event_id INTO v_event_id
    FROM fz_athlete_events
    WHERE event_key = p_event_key;
  END IF;

  IF p_session_id IS NOT NULL THEN
    INSERT INTO fz_training_session_sources
      (session_id, source_record_pk, relationship, match_method, match_confidence)
    VALUES
      (p_session_id, v_source_record_pk, 'EVIDENCE', COALESCE(NULLIF(btrim(p_match_method), ''), 'FORWARD_ATHLETE_MEMORY'), p_match_confidence)
    ON CONFLICT (session_id, source_record_pk, relationship) DO UPDATE SET
      match_method = EXCLUDED.match_method,
      match_confidence = EXCLUDED.match_confidence;

    v_status := CASE p_event_type
      WHEN 'STOPPED_EARLY' THEN 'STOPPED_EARLY'
      WHEN 'ABORTED' THEN 'ABORTED'
      WHEN 'SKIPPED' THEN 'SKIPPED'
      WHEN 'ATHLETE_MODIFIED' THEN 'MODIFIED'
      ELSE NULL
    END;

    IF v_status IS NOT NULL THEN
      UPDATE fz_training_sessions
      SET status = v_status, updated_at = NOW()
      WHERE session_id = p_session_id
        AND status <> 'SUPERSEDED';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'inserted', v_inserted,
    'eventId', v_event_id,
    'eventKey', p_event_key,
    'sessionId', p_session_id,
    'linked', p_session_id IS NOT NULL,
    'sourceRecordPk', v_source_record_pk,
    'categories', to_jsonb(ARRAY(SELECT upper(x) FROM unnest(p_categories) AS x)),
    'certainty', p_certainty
  );
END;
$$;

COMMENT ON FUNCTION fz_record_athlete_memory(TEXT,TEXT,TIMESTAMPTZ,DATE,TEXT,TEXT[],TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC)
IS 'Idempotently writes one athlete-reported memory observation, optionally linking it to canonical training evidence without changing the observation timestamp.';

COMMIT;

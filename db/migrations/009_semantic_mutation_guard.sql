BEGIN;

-- Tranche 5.0 release hardening: canonical mutation outbox records semantic
-- changes, not idempotent source-sync touches.
CREATE OR REPLACE FUNCTION fz_capture_canonical_mutation()
RETURNS TRIGGER AS $$
DECLARE
  row_data JSONB;
  stable_key TEXT;
  nodes JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  -- UPDATE statements that do not change canonical meaning are not mutations.
  -- Legacy training sync always bumps fz_training_sessions.updated_at, so that
  -- housekeeping timestamp is ignored when deciding semantic equality.
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'fz_training_sessions' THEN
      IF (to_jsonb(OLD) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
        RETURN NEW;
      END IF;
    ELSIF to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Derived FZ intelligence rows are downstream outputs, not fresh canonical inputs.
  -- Excluding them here prevents revision/outbox self-loops.
  IF TG_TABLE_NAME = 'fz_training_source_records'
     AND COALESCE(row_data->>'source_key','') = 'fz-intelligence' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Current Athlete State is driven only by athlete-authored memory events.
  IF TG_TABLE_NAME = 'fz_athlete_events'
     AND COALESCE(row_data->>'actor','') <> 'ATHLETE' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  stable_key := CASE TG_TABLE_NAME
    WHEN 'fz_training_session_sources' THEN concat_ws(':',row_data->>'session_id',row_data->>'source_record_pk',row_data->>'relationship')
    WHEN 'fz_objective_capabilities' THEN concat_ws(':',row_data->>'objective_id',row_data->>'capability_id')
    WHEN 'fz_wellness_snapshots' THEN concat_ws(':',row_data->>'source_key',row_data->>'local_date',row_data->>'id')
    ELSE COALESCE(
      row_data->>'event_key',
      row_data->>'session_id',
      row_data->>'objective_id',
      row_data->>'profile_id',
      row_data->>'capability_id',
      row_data->>'source_record_id',
      row_data->>'source_evidence_id',
      row_data->>'assessment_id',
      row_data->>'revision_id',
      row_data->>'id'
    )
  END;
  nodes := to_jsonb(string_to_array(TG_ARGV[0], ','));

  INSERT INTO fz_canonical_mutation_outbox
    (source_table, source_operation, row_key, changed_nodes, occurred_at)
  VALUES
    (TG_TABLE_NAME, TG_OP, NULLIF(stable_key,''), nodes, NOW());

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

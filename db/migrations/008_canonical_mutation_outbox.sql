BEGIN;

-- Persistence-boundary safety net for Tranche 5.0.
-- This outbox stores mutation metadata only. It does not duplicate athlete payloads.
CREATE TABLE IF NOT EXISTS fz_canonical_mutation_outbox (
  mutation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_table TEXT NOT NULL,
  source_operation TEXT NOT NULL CHECK (source_operation IN ('INSERT','UPDATE','DELETE')),
  row_key TEXT,
  changed_nodes JSONB NOT NULL CHECK (jsonb_typeof(changed_nodes)='array'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  revision_id TEXT REFERENCES fz_canonical_revisions(revision_id) ON DELETE SET NULL,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS fz_canonical_mutation_outbox_pending_idx
  ON fz_canonical_mutation_outbox (mutation_id)
  WHERE processed_at IS NULL;

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

  stable_key := COALESCE(
    row_data->>'event_key',
    row_data->>'session_id',
    row_data->>'objective_id',
    row_data->>'profile_id',
    row_data->>'source_record_id',
    row_data->>'assessment_id',
    row_data->>'revision_id',
    row_data->>'id'
  );
  nodes := to_jsonb(string_to_array(TG_ARGV[0], ','));

  INSERT INTO fz_canonical_mutation_outbox
    (source_table, source_operation, row_key, changed_nodes, occurred_at)
  VALUES
    (TG_TABLE_NAME, TG_OP, stable_key, nodes, NOW());

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fz_mutation_wellness_current ON fz_wellness_current;
CREATE TRIGGER fz_mutation_wellness_current
AFTER INSERT OR UPDATE ON fz_wellness_current
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('source.garmin.wellness,wellness.current,wellness.history');

DROP TRIGGER IF EXISTS fz_mutation_training_source_records ON fz_training_source_records;
CREATE TRIGGER fz_mutation_training_source_records
AFTER INSERT ON fz_training_source_records
FOR EACH ROW
WHEN (NEW.source_key <> 'fz-intelligence')
EXECUTE FUNCTION fz_capture_canonical_mutation('training.evidence,training.session');

DROP TRIGGER IF EXISTS fz_mutation_training_sessions ON fz_training_sessions;
CREATE TRIGGER fz_mutation_training_sessions
AFTER INSERT OR UPDATE ON fz_training_sessions
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('training.session');

DROP TRIGGER IF EXISTS fz_mutation_training_session_sources ON fz_training_session_sources;
CREATE TRIGGER fz_mutation_training_session_sources
AFTER INSERT OR UPDATE OR DELETE ON fz_training_session_sources
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('training.session,process.reconcilePlannedIntent,process.reconcileAthleteMemory');

DROP TRIGGER IF EXISTS fz_mutation_athlete_events ON fz_athlete_events;
CREATE TRIGGER fz_mutation_athlete_events
AFTER INSERT OR UPDATE ON fz_athlete_events
FOR EACH ROW
WHEN (NEW.actor = 'ATHLETE')
EXECUTE FUNCTION fz_capture_canonical_mutation('source.athlete.feedback,athlete.memory');

DROP TRIGGER IF EXISTS fz_mutation_objectives ON fz_objectives;
CREATE TRIGGER fz_mutation_objectives
AFTER INSERT OR UPDATE OR DELETE ON fz_objectives
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('source.athlete.objective,objective.graph');

DROP TRIGGER IF EXISTS fz_mutation_objective_capabilities ON fz_objective_capabilities;
CREATE TRIGGER fz_mutation_objective_capabilities
AFTER INSERT OR UPDATE OR DELETE ON fz_objective_capabilities
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('objective.graph,capability.priority');

DROP TRIGGER IF EXISTS fz_mutation_event_format_profiles ON fz_event_format_profiles;
CREATE TRIGGER fz_mutation_event_format_profiles
AFTER INSERT OR UPDATE OR DELETE ON fz_event_format_profiles
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('event.format');

DROP TRIGGER IF EXISTS fz_mutation_event_source_evidence ON fz_event_source_evidence;
CREATE TRIGGER fz_mutation_event_source_evidence
AFTER INSERT OR UPDATE OR DELETE ON fz_event_source_evidence
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('event.intake');

DROP TRIGGER IF EXISTS fz_mutation_event_transfer_assessments ON fz_event_transfer_assessments;
CREATE TRIGGER fz_mutation_event_transfer_assessments
AFTER INSERT OR UPDATE OR DELETE ON fz_event_transfer_assessments
FOR EACH ROW EXECUTE FUNCTION fz_capture_canonical_mutation('event.intelligence');

COMMIT;

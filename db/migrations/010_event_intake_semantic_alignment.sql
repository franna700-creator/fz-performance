BEGIN;

-- Stage 2 event-intake semantic alignment.
-- The intake contract can retain a genuinely unclassified event and can distinguish
-- "research required" from "athlete structure required". Persistence must not force
-- either concept into a stronger role/knowledge state.

ALTER TABLE fz_objectives
  DROP CONSTRAINT IF EXISTS fz_objectives_role_check;

ALTER TABLE fz_objectives
  ADD CONSTRAINT fz_objectives_role_check
  CHECK (role = ANY (ARRAY[
    'PRIMARY'::text,
    'SECONDARY'::text,
    'VALIDATION'::text,
    'MAINTENANCE'::text,
    'UNCLASSIFIED'::text
  ]));

ALTER TABLE fz_objectives
  DROP CONSTRAINT IF EXISTS fz_objectives_knowledge_status_check;

ALTER TABLE fz_objectives
  ADD CONSTRAINT fz_objectives_knowledge_status_check
  CHECK (knowledge_status = ANY (ARRAY[
    'QUALIFIED'::text,
    'PROVISIONAL'::text,
    'RESEARCH_REQUIRED'::text,
    'ATHLETE_STRUCTURE_REQUIRED'::text,
    'NOT_APPLICABLE'::text
  ]));

ALTER TABLE fz_objectives
  DROP CONSTRAINT IF EXISTS fz_objectives_unclassified_weight_check;

ALTER TABLE fz_objectives
  ADD CONSTRAINT fz_objectives_unclassified_weight_check
  CHECK (role <> 'UNCLASSIFIED' OR strategic_weight = 0);

-- Canonical source evidence uses source_ref as the idempotency identity supplied by
-- the semantic ingestion layer. Production has no duplicate keys as of migration
-- preparation, so enforce that invariant at persistence rather than relying only on
-- application-side existence checks.
CREATE UNIQUE INDEX IF NOT EXISTS fz_event_source_evidence_idempotency_idx
  ON fz_event_source_evidence (objective_id, source_type, source_ref)
  WHERE source_ref IS NOT NULL;

COMMIT;

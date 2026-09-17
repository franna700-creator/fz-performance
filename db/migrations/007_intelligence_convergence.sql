BEGIN;

-- Tranche 5.0 — Intelligence Convergence & Canonical Athlete State
-- Foundation migration. Apply only through the controlled migration gate.

-- 5.0A: application/schema parity. Choice-outcome persistence already exists in
-- application code; the deployed ledger constraint must admit that record type.
ALTER TABLE fz_training_source_records
  DROP CONSTRAINT IF EXISTS fz_training_source_records_record_type_check;

ALTER TABLE fz_training_source_records
  ADD CONSTRAINT fz_training_source_records_record_type_check
  CHECK (record_type IN (
    'planned_workout',
    'executed_activity',
    'athlete_feedback',
    'event_context',
    'recommendation',
    'decision',
    'choice_outcome'
  ));

-- 5.0B: one durable high-level revision per canonical propagation request.
CREATE TABLE IF NOT EXISTS fz_canonical_revisions (
  revision_id TEXT PRIMARY KEY,
  revision_sha256 TEXT NOT NULL CHECK (revision_sha256 ~ '^[a-f0-9]{64}$'),
  source_type TEXT NOT NULL,
  source_key TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  local_date DATE NOT NULL,
  changed_nodes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changed_nodes)='array'),
  dependency_closure JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dependency_closure)='array'),
  affected_surfaces JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(affected_surfaces)='array'),
  trigger JSONB NOT NULL DEFAULT '{}'::jsonb,
  materiality JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fz_canonical_revisions_occurred_idx
  ON fz_canonical_revisions (occurred_at DESC, revision_id DESC);

-- 5.0D: explicit convergence accounting for every node affected by a revision.
CREATE TABLE IF NOT EXISTS fz_convergence_ledger (
  revision_id TEXT NOT NULL REFERENCES fz_canonical_revisions(revision_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'INVALIDATED',
    'RECOMPUTED',
    'RECONCILED',
    'PROVEN_UNAFFECTED',
    'WITHHELD',
    'FAILED'
  )),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (revision_id, node_id)
);
CREATE INDEX IF NOT EXISTS fz_convergence_ledger_open_idx
  ON fz_convergence_ledger (state, updated_at DESC)
  WHERE state IN ('INVALIDATED','FAILED');

COMMIT;

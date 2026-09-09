BEGIN;

CREATE TABLE IF NOT EXISTS fz_runtime_state_versions (
  state_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  shell_version TEXT,
  master_validated BOOLEAN NOT NULL CHECK (master_validated = TRUE),
  master_as_of TIMESTAMPTZ,
  payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  source_class TEXT NOT NULL DEFAULT 'FZ_RUNTIME_INGEST',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fz_runtime_state_pointer (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  current_state_id TEXT REFERENCES fz_runtime_state_versions(state_id),
  previous_state_id TEXT REFERENCES fz_runtime_state_versions(state_id),
  pointer_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fz_runtime_state_pointer (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS fz_runtime_state_versions_created_at_idx
  ON fz_runtime_state_versions (created_at DESC);

COMMIT;

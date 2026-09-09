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

CREATE OR REPLACE FUNCTION fz_publish_runtime_state(
  p_state_id TEXT,
  p_schema_version TEXT,
  p_shell_version TEXT,
  p_master_validated BOOLEAN,
  p_master_as_of TIMESTAMPTZ,
  p_payload JSONB,
  p_payload_sha256 TEXT,
  p_source_class TEXT
)
RETURNS TABLE (
  current_state_id TEXT,
  previous_state_id TEXT,
  pointer_version BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current TEXT;
  v_previous TEXT;
  v_version BIGINT;
  v_existing_hash TEXT;
BEGIN
  IF p_master_validated IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'runtime state must be master validated';
  END IF;

  IF p_state_id IS NULL OR LENGTH(p_state_id) < 8 THEN
    RAISE EXCEPTION 'invalid runtime state id';
  END IF;

  IF p_payload_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid runtime payload checksum';
  END IF;

  INSERT INTO fz_runtime_state_versions (
    state_id,
    schema_version,
    shell_version,
    master_validated,
    master_as_of,
    payload,
    payload_sha256,
    source_class
  ) VALUES (
    p_state_id,
    p_schema_version,
    p_shell_version,
    TRUE,
    p_master_as_of,
    p_payload,
    p_payload_sha256,
    COALESCE(NULLIF(p_source_class, ''), 'FZ_RUNTIME_INGEST')
  )
  ON CONFLICT (state_id) DO NOTHING;

  SELECT s.payload_sha256
    INTO v_existing_hash
  FROM fz_runtime_state_versions s
  WHERE s.state_id = p_state_id;

  IF v_existing_hash IS DISTINCT FROM p_payload_sha256 THEN
    RAISE EXCEPTION 'state id already exists with a different payload checksum';
  END IF;

  SELECT p.current_state_id, p.previous_state_id, p.pointer_version
    INTO v_current, v_previous, v_version
  FROM fz_runtime_state_pointer p
  WHERE p.id = 1
  FOR UPDATE;

  IF v_current = p_state_id THEN
    RETURN QUERY SELECT v_current, v_previous, v_version;
    RETURN;
  END IF;

  IF v_current IS NOT NULL AND p_state_id <= v_current THEN
    RAISE EXCEPTION 'runtime publication must be monotonic: % <= %', p_state_id, v_current;
  END IF;

  UPDATE fz_runtime_state_pointer
  SET previous_state_id = v_current,
      current_state_id = p_state_id,
      pointer_version = v_version + 1,
      updated_at = NOW()
  WHERE id = 1;

  RETURN QUERY
  SELECT p.current_state_id, p.previous_state_id, p.pointer_version
  FROM fz_runtime_state_pointer p
  WHERE p.id = 1;
END;
$$;

CREATE INDEX IF NOT EXISTS fz_runtime_state_versions_created_at_idx
  ON fz_runtime_state_versions (created_at DESC);

COMMIT;

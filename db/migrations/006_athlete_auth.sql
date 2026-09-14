BEGIN;

CREATE TABLE IF NOT EXISTS fz_athlete_auth_credentials (
  athlete_id TEXT PRIMARY KEY,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_params JSONB NOT NULL,
  credential_version BIGINT NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  bootstrap_digest TEXT NOT NULL CHECK (bootstrap_digest ~ '^[a-f0-9]{64}$'),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  next_attempt_after TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fz_athlete_auth_sessions (
  session_hash TEXT PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  athlete_id TEXT NOT NULL REFERENCES fz_athlete_auth_credentials(athlete_id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL CHECK (csrf_hash ~ '^[a-f0-9]{64}$'),
  credential_version BIGINT NOT NULL CHECK (credential_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fz_athlete_auth_sessions_active_idx
  ON fz_athlete_auth_sessions (athlete_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS fz_athlete_auth_nonces (
  nonce_hash TEXT PRIMARY KEY CHECK (nonce_hash ~ '^[a-f0-9]{64}$'),
  session_hash TEXT NOT NULL REFERENCES fz_athlete_auth_sessions(session_hash) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fz_athlete_auth_nonces_session_idx
  ON fz_athlete_auth_nonces (session_hash, created_at DESC);

COMMIT;

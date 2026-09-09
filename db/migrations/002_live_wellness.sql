BEGIN;

CREATE TABLE IF NOT EXISTS fz_source_connections (
  source_key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED'
    CHECK (status IN ('DISCONNECTED', 'AUTH_PENDING', 'CONNECTED', 'ERROR')),
  auth_state TEXT,
  encrypted_oauth_state TEXT,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fz_source_connections (source_key)
VALUES ('fitness-ai')
ON CONFLICT (source_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS fz_wellness_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_key TEXT NOT NULL,
  local_date DATE NOT NULL,
  source_as_of TIMESTAMPTZ NOT NULL,
  steps INTEGER,
  distance_km NUMERIC,
  active_calories INTEGER,
  active_minutes NUMERIC,
  intensity_minutes NUMERIC,
  floors INTEGER,
  heart_rate_current INTEGER,
  resting_heart_rate INTEGER,
  stress_avg NUMERIC,
  stress_current NUMERIC,
  body_battery_current NUMERIC,
  body_battery_high NUMERIC,
  body_battery_low NUMERIC,
  body_battery_charged NUMERIC,
  body_battery_drained NUMERIC,
  hrv_last_night NUMERIC,
  sleep_score NUMERIC,
  sleep_hours NUMERIC,
  respiration_current NUMERIC,
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  source_status TEXT NOT NULL DEFAULT 'available',
  payload JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, local_date, source_hash)
);

CREATE INDEX IF NOT EXISTS fz_wellness_snapshots_current_idx
  ON fz_wellness_snapshots (source_key, local_date DESC, source_as_of DESC, ingested_at DESC);

CREATE TABLE IF NOT EXISTS fz_wellness_series_points (
  source_key TEXT NOT NULL,
  local_date DATE NOT NULL,
  series_name TEXT NOT NULL
    CHECK (series_name IN ('heart_rate', 'stress', 'body_battery', 'respiration')),
  observed_at TIMESTAMPTZ NOT NULL,
  value NUMERIC NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_key, series_name, observed_at)
);

CREATE INDEX IF NOT EXISTS fz_wellness_series_today_idx
  ON fz_wellness_series_points (source_key, local_date DESC, series_name, observed_at);

CREATE OR REPLACE VIEW fz_wellness_current AS
SELECT DISTINCT ON (source_key, local_date)
  *
FROM fz_wellness_snapshots
ORDER BY source_key, local_date, source_as_of DESC, ingested_at DESC, id DESC;

COMMIT;

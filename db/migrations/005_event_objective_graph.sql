BEGIN;

-- Prepared v0.7 foundation only. Do not apply until the release migration gate is approved.
-- Event structure/provenance is first-class so new events can be researched or athlete-described
-- without hard-coding race knowledge into recommendation logic.
CREATE TABLE IF NOT EXISTS fz_capabilities (
  capability_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fz_event_format_profiles (
  profile_id TEXT PRIMARY KEY,
  event_family TEXT NOT NULL,
  variant TEXT NOT NULL,
  knowledge_status TEXT NOT NULL CHECK (knowledge_status IN ('QUALIFIED','PROVISIONAL','RESEARCH_REQUIRED')),
  source_authority TEXT NOT NULL,
  profile JSONB NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fz_objectives (
  objective_id TEXT PRIMARY KEY,
  objective_type TEXT NOT NULL CHECK (objective_type IN ('EVENT','EVERGREEN')),
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('DORMANT','SCHEDULED','ACTIVE','COMPLETED','CANCELLED')),
  role TEXT NOT NULL CHECK (role IN ('PRIMARY','SECONDARY','VALIDATION','MAINTENANCE')),
  strategic_weight NUMERIC NOT NULL CHECK (strategic_weight >= 0 AND strategic_weight <= 1),
  starts_on DATE,
  ends_on DATE,
  format_profile_id TEXT REFERENCES fz_event_format_profiles(profile_id),
  knowledge_status TEXT NOT NULL DEFAULT 'RESEARCH_REQUIRED' CHECK (knowledge_status IN ('QUALIFIED','PROVISIONAL','RESEARCH_REQUIRED','NOT_APPLICABLE')),
  target JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fz_objectives_active_date_idx ON fz_objectives (state, role, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS fz_objectives_format_profile_idx ON fz_objectives (format_profile_id) WHERE format_profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fz_event_source_evidence (
  source_evidence_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  objective_id TEXT REFERENCES fz_objectives(objective_id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES fz_event_format_profiles(profile_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ATHLETE','OFFICIAL_RULEBOOK','OFFICIAL_EVENT','ORGANISER_RACE_BRIEF','SECONDARY_RESEARCH','STANDARD_REFERENCE','SYSTEM')),
  source_ref TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fz_event_source_evidence_lookup_idx ON fz_event_source_evidence (objective_id, observed_at DESC, source_evidence_id DESC);

CREATE TABLE IF NOT EXISTS fz_objective_capabilities (
  objective_id TEXT NOT NULL REFERENCES fz_objectives(objective_id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES fz_capabilities(capability_id),
  demand_weight NUMERIC NOT NULL CHECK (demand_weight >= 0 AND demand_weight <= 1),
  transfer_weight NUMERIC NOT NULL CHECK (transfer_weight >= 0 AND transfer_weight <= 1),
  specificity TEXT NOT NULL CHECK (specificity IN ('SHARED','EVENT_SPECIFIC','SUPPORT')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (objective_id, capability_id)
);

CREATE TABLE IF NOT EXISTS fz_event_transfer_assessments (
  assessment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_objective_id TEXT NOT NULL REFERENCES fz_objectives(objective_id) ON DELETE CASCADE,
  target_objective_id TEXT NOT NULL REFERENCES fz_objectives(objective_id) ON DELETE CASCADE,
  source_profile_id TEXT REFERENCES fz_event_format_profiles(profile_id),
  target_profile_id TEXT REFERENCES fz_event_format_profiles(profile_id),
  transfer_score NUMERIC CHECK (transfer_score IS NULL OR (transfer_score >= 0 AND transfer_score <= 1)),
  transfer_class TEXT,
  net_training_value_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  assessment JSONB NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fz_event_transfer_assessments_lookup_idx ON fz_event_transfer_assessments (source_objective_id, target_objective_id, effective_at DESC, assessment_id DESC);
CREATE INDEX IF NOT EXISTS fz_event_transfer_assessments_target_lookup_idx ON fz_event_transfer_assessments (target_objective_id, source_objective_id, effective_at DESC, assessment_id DESC);

CREATE TABLE IF NOT EXISTS fz_objective_revisions (
  revision_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES fz_objectives(objective_id) ON DELETE RESTRICT,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor TEXT NOT NULL CHECK (actor IN ('ATHLETE','FZ','SYSTEM')),
  reason TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fz_objective_revisions_lookup_idx ON fz_objective_revisions (objective_id, effective_at DESC, revision_id DESC);

COMMIT;

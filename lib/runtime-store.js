import { getSql } from './db.js';

const MODE_ENV = 'FZ_RUNTIME_STORE_MODE';
const HEX64 = /^[a-f0-9]{64}$/;

export function runtimeStoreMode() {
  const value = String(process.env[MODE_ENV] || 'immutable').trim().toLowerCase();
  if (['immutable', 'prefer-database', 'database-only'].includes(value)) return value;
  return 'immutable';
}

export function databaseRuntimeEnabled() {
  return runtimeStoreMode() !== 'immutable';
}

export function databaseRuntimeRequired() {
  return runtimeStoreMode() === 'database-only';
}

export async function loadDatabaseRuntimeState() {
  const sql = await getSql();
  const rows = await sql`
    SELECT
      s.state_id,
      s.payload,
      s.payload_sha256,
      s.master_as_of,
      s.created_at,
      p.pointer_version
    FROM fz_runtime_state_pointer p
    JOIN fz_runtime_state_versions s
      ON s.state_id = p.current_state_id
    WHERE p.id = 1
    LIMIT 1
  `;

  const row = rows?.[0];
  if (!row) return null;
  const state = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return {
    state,
    payloadSha256: row.payload_sha256,
    stateId: row.state_id,
    pointerVersion: Number(row.pointer_version || 0),
    source: 'database'
  };
}

export async function publishDatabaseRuntimeState({ state, payloadSha256, sourceClass = 'FZ_RUNTIME_INGEST' }) {
  if (!state || state.masterValidated !== true) throw new Error('runtime state must be master validated');
  if (typeof state.stateId !== 'string' || state.stateId.length < 8) throw new Error('invalid runtime state id');
  if (!HEX64.test(payloadSha256 || '')) throw new Error('invalid runtime payload checksum');

  const sql = await getSql();
  const payload = JSON.stringify(state);
  const rows = await sql`
    WITH locked AS (
      SELECT current_state_id, previous_state_id, pointer_version
      FROM fz_runtime_state_pointer
      WHERE id = 1
      FOR UPDATE
    ), existing AS (
      SELECT payload_sha256
      FROM fz_runtime_state_versions
      WHERE state_id = ${state.stateId}
    ), inserted AS (
      INSERT INTO fz_runtime_state_versions (
        state_id,
        schema_version,
        shell_version,
        master_validated,
        master_as_of,
        payload,
        payload_sha256,
        source_class
      )
      SELECT
        ${state.stateId}::text,
        ${state.schemaVersion}::text,
        ${state.shellVersion || null}::text,
        TRUE,
        ${state.masterAsOf || null}::timestamptz,
        ${payload}::jsonb,
        ${payloadSha256}::text,
        ${sourceClass}::text
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      ON CONFLICT (state_id) DO NOTHING
      RETURNING payload_sha256
    ), candidate AS (
      SELECT payload_sha256 FROM existing
      UNION ALL
      SELECT payload_sha256 FROM inserted
      LIMIT 1
    ), updated AS (
      UPDATE fz_runtime_state_pointer p
      SET previous_state_id = p.current_state_id,
          current_state_id = ${state.stateId}::text,
          pointer_version = p.pointer_version + 1,
          updated_at = NOW()
      FROM locked l, candidate c
      WHERE p.id = 1
        AND c.payload_sha256 = ${payloadSha256}::text
        AND p.current_state_id IS DISTINCT FROM ${state.stateId}::text
        AND (p.current_state_id IS NULL OR ${state.stateId}::text > p.current_state_id)
      RETURNING p.current_state_id, p.previous_state_id, p.pointer_version
    )
    SELECT
      COALESCE(u.current_state_id, l.current_state_id) AS current_state_id,
      COALESCE(u.previous_state_id, l.previous_state_id) AS previous_state_id,
      COALESCE(u.pointer_version, l.pointer_version) AS pointer_version,
      c.payload_sha256 AS candidate_sha256
    FROM locked l
    LEFT JOIN updated u ON TRUE
    LEFT JOIN candidate c ON TRUE
    LIMIT 1
  `;

  const row = rows?.[0];
  if (!row || row.candidate_sha256 !== payloadSha256) {
    throw new Error('state id already exists with a different payload checksum');
  }
  if (row.current_state_id !== state.stateId) {
    throw new Error(`runtime publication must be monotonic: ${state.stateId} <= ${row.current_state_id}`);
  }
  return {
    current_state_id: row.current_state_id,
    previous_state_id: row.previous_state_id,
    pointer_version: Number(row.pointer_version || 0)
  };
}

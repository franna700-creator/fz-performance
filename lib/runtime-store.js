let sqlClientPromise;

const MODE_ENV = 'FZ_RUNTIME_STORE_MODE';

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

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

async function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error('database connection string is not configured');
  if (!sqlClientPromise) {
    sqlClientPromise = import('@neondatabase/serverless').then(({ neon }) => neon(url));
  }
  return sqlClientPromise;
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
  const sql = await getSql();
  const payload = JSON.stringify(state);
  const rows = await sql`
    SELECT * FROM fz_publish_runtime_state(
      ${state.stateId}::text,
      ${state.schemaVersion}::text,
      ${state.shellVersion || null}::text,
      ${state.masterValidated === true}::boolean,
      ${state.masterAsOf || null}::timestamptz,
      ${payload}::jsonb,
      ${payloadSha256}::text,
      ${sourceClass}::text
    )
  `;
  return rows?.[0] || null;
}

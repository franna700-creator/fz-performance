import { getSql } from './db.js';
import { loadDatabaseRuntimeState } from './runtime-store.js';
import { ingestTrainingSourceRecord, sourceHash } from './training-store.js';
import { evaluateReadiness, READINESS_ENGINE_VERSION, READINESS_STATE_CONTEXT } from './readiness-engine.js';

const SOURCE_KEY = 'fz-intelligence';
// The canonical ledger already supports event_context and discriminates derived
// intelligence by payload.contextType. Keep readiness inside that deployed
// envelope rather than inventing a new database record_type at runtime.
const RECORD_TYPE = 'event_context';
const TZ = 'Africa/Johannesburg';

function dateOnly(value) {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(String(value || ''));
  return match ? match[0] : null;
}
function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function maxIso(...values) {
  let best = null, bestTime = 0;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time) && time > bestTime) { best = new Date(time).toISOString(); bestTime = time; }
  }
  return best;
}
function wellnessShape(row = {}) {
  return {
    hrvLastNight: row.hrv_last_night == null ? null : Number(row.hrv_last_night),
    restingHeartRate: row.resting_heart_rate == null ? null : Number(row.resting_heart_rate),
    sleepHours: row.sleep_hours == null ? null : Number(row.sleep_hours),
    sleepScore: row.sleep_score == null ? null : Number(row.sleep_score),
    bodyBatteryHigh: row.body_battery_high == null ? null : Number(row.body_battery_high)
  };
}
function runtimeWellnessShape(row = {}) {
  return {
    hrvLastNight: row.hrv == null ? null : Number(row.hrv),
    restingHeartRate: row.rhr == null ? null : Number(row.rhr),
    sleepHours: row.sleepHours == null ? null : Number(row.sleepHours),
    sleepScore: row.sleepScore == null ? null : Number(row.sleepScore),
    bodyBatteryHigh: row.bodyBatteryHigh == null ? null : Number(row.bodyBatteryHigh)
  };
}
function mergeHistory(date, runtimeRows = [], databaseRows = []) {
  const merged = new Map();
  for (const row of runtimeRows || []) {
    const d = dateOnly(row?.date);
    if (!d || d >= date) continue;
    merged.set(d, { localDate: d, ...runtimeWellnessShape(row), provenance: 'RUNTIME_HISTORICAL_SEED' });
  }
  for (const row of databaseRows || []) {
    const d = dateOnly(row?.local_date);
    if (!d || d >= date) continue;
    merged.set(d, { localDate: d, ...wellnessShape(row), provenance: 'NEON_WELLNESS_CURRENT' });
  }
  return [...merged.values()].sort((a,b) => a.localDate.localeCompare(b.localDate)).slice(-28);
}
function eventRelevant(row) {
  const categories = Array.isArray(row?.payload?.memoryCategories) ? row.payload.memoryCategories.map(x => String(x || '').toUpperCase()) : [];
  return categories.some(category => ['STATE','RECOVERY','CONSTRAINT','COST'].includes(category));
}
function materialityValue(row) { return row?.materiality_payload?.materiality || null; }

export async function readReadinessInputs({ date = localDate() } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('readiness_date_required');
  const sql = await getSql();
  const currentRows = await sql`
    SELECT id,source_key,local_date::text AS local_date,source_as_of,ingested_at,source_hash,
           hrv_last_night,resting_heart_rate,sleep_hours,sleep_score,body_battery_high
    FROM fz_wellness_current
    WHERE local_date=${date}::date
    ORDER BY source_as_of DESC NULLS LAST,ingested_at DESC,id DESC
    LIMIT 1
  `;
  const currentRow = currentRows?.[0] || null;
  if (!currentRow) return { date, currentRow: null, current: null, history: [], athleteEvent: null, materiality: null, sourceAsOf: null };

  const [historyRows, runtime] = await Promise.all([
    sql`
      SELECT local_date::text AS local_date,hrv_last_night,resting_heart_rate,sleep_hours,sleep_score,body_battery_high
      FROM fz_wellness_current
      WHERE source_key=${currentRow.source_key}
        AND local_date < ${date}::date
        AND local_date >= (${date}::date - INTERVAL '28 days')
      ORDER BY local_date ASC
      LIMIT 28
    `,
    loadDatabaseRuntimeState().catch(() => null)
  ]);
  const runtimeHistory = runtime?.state?.datasets?.WELLNESS_HISTORY || [];
  const history = mergeHistory(date, runtimeHistory, historyRows || []);

  const eventRows = await sql`
    SELECT e.event_id,e.event_key,e.event_type,e.occurred_at,e.local_date::text AS local_date,e.certainty,e.summary,e.payload,
           m.payload AS materiality_payload,m.source_updated_at AS materiality_updated_at,m.ingested_at AS materiality_ingested_at
    FROM fz_athlete_events e
    LEFT JOIN LATERAL (
      SELECT payload,source_updated_at,ingested_at
      FROM fz_training_source_latest
      WHERE source_key='fz-intelligence'
        AND record_type='event_context'
        AND payload->>'contextType'='MATERIALITY_ASSESSMENT'
        AND payload->>'evidenceKey'=e.event_key
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC
      LIMIT 1
    ) m ON TRUE
    WHERE e.actor='ATHLETE' AND e.local_date=${date}::date
    ORDER BY e.occurred_at DESC,e.event_id DESC
    LIMIT 25
  `;
  const athleteEvent = (eventRows || []).find(eventRelevant) || null;
  return {
    date,
    currentRow,
    current: wellnessShape(currentRow),
    history,
    athleteEvent,
    materiality: materialityValue(athleteEvent),
    sourceAsOf: maxIso(currentRow.source_as_of, athleteEvent?.occurred_at, athleteEvent?.materiality_updated_at, athleteEvent?.materiality_ingested_at)
  };
}

export function buildReadinessCandidate(inputs = {}) {
  const evaluated = evaluateReadiness({
    localDate: inputs.date,
    current: inputs.current || {},
    history: inputs.history || [],
    athleteEvent: inputs.athleteEvent || null,
    materiality: inputs.materiality || null
  });
  const fingerprintBasis = {
    engineVersion: READINESS_ENGINE_VERSION,
    localDate: inputs.date || null,
    current: inputs.current || null,
    baselines: Object.fromEntries(Object.entries(evaluated.components || {}).map(([key, value]) => [key, value.baseline || null])),
    athleteEventKey: inputs.athleteEvent?.event_key || null,
    athleteEventOccurredAt: inputs.athleteEvent?.occurred_at || null,
    athleteCategories: inputs.athleteEvent?.payload?.memoryCategories || [],
    materiality: inputs.materiality ? {
      level: inputs.materiality.level || null,
      reasonCodes: inputs.materiality.reasonCodes || [],
      blocksExistingRecommendation: inputs.materiality.blocksExistingRecommendation === true
    } : null
  };
  const inputFingerprint = sourceHash(fingerprintBasis);
  return {
    ...evaluated,
    inputFingerprint,
    evidence: {
      wellnessSource: inputs.currentRow ? {
        sourceKey: inputs.currentRow.source_key,
        snapshotId: Number(inputs.currentRow.id),
        sourceAsOf: inputs.currentRow.source_as_of || null,
        sourceHash: inputs.currentRow.source_hash || null
      } : null,
      historyWindowDays: 28,
      historyRows: inputs.history?.length || 0,
      historicalSeedPolicy: 'NEON_CURRENT_OVERRIDES_RUNTIME_HISTORY_BY_DATE',
      athleteEventKey: inputs.athleteEvent?.event_key || null,
      athleteEventId: inputs.athleteEvent?.event_id == null ? null : Number(inputs.athleteEvent.event_id),
      athleteEventSummary: inputs.athleteEvent?.summary || null,
      materialityReasonCodes: inputs.materiality?.reasonCodes || []
    }
  };
}

export async function readCurrentReadiness({ date = localDate() } = {}) {
  const sql = await getSql();
  const rows = await sql`
    SELECT id,source_record_id,local_date::text AS local_date,source_updated_at,ingested_at,payload
    FROM fz_training_source_latest
    WHERE source_key=${SOURCE_KEY}
      AND record_type=${RECORD_TYPE}
      AND local_date=${date}::date
      AND payload->>'contextType'=${READINESS_STATE_CONTEXT}
    ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC
    LIMIT 1
  `;
  return rows?.[0] || null;
}

export async function readCurrentReadinessStatus({ date = localDate() } = {}) {
  const inputs = await readReadinessInputs({ date });
  const currentRow = await readCurrentReadiness({ date });
  if (!inputs.currentRow) {
    return { date, status: 'NO_CURRENT_WELLNESS', pending: false, expected: null, row: currentRow, payload: currentRow?.payload || null };
  }
  const expected = buildReadinessCandidate(inputs);
  const payload = currentRow?.payload || null;
  const pending = !payload || payload.engineVersion !== READINESS_ENGINE_VERSION || payload.localDate !== date || payload.inputFingerprint !== expected.inputFingerprint;
  return { date, status: pending ? 'PENDING' : 'CURRENT', pending, expected, row: currentRow, payload };
}

export async function recomputeCurrentReadiness({ date = localDate(), now = new Date(), persist = true } = {}) {
  const before = await readCurrentReadiness({ date });
  const inputs = await readReadinessInputs({ date });
  if (!inputs.currentRow) return { status: 'NO_CURRENT_WELLNESS', changed: false, before: before?.payload || null, row: before, payload: before?.payload || null };
  const payload = buildReadinessCandidate(inputs);
  const changed = before?.payload?.engineVersion !== payload.engineVersion || before?.payload?.inputFingerprint !== payload.inputFingerprint;
  if (!persist) return { status: payload.status, changed, before: before?.payload || null, row: null, payload };
  const row = await ingestTrainingSourceRecord({
    sourceKey: SOURCE_KEY,
    recordType: RECORD_TYPE,
    sourceRecordId: `readiness:${READINESS_ENGINE_VERSION}:${date}`,
    sourceUpdatedAt: inputs.sourceAsOf || now.toISOString(),
    localDate: date,
    payload
  });
  return { status: payload.status, changed, before: before?.payload || null, row, payload };
}

export async function recomputeCurrentReadinessSafely(options = {}) {
  try { return await recomputeCurrentReadiness(options); }
  catch (error) { return { status: 'ERROR', changed: false, error: error instanceof Error ? error.message : String(error), payload: null, row: null }; }
}

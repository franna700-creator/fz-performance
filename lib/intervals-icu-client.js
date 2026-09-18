import { getSql } from './db.js';
const API_BASE = 'https://intervals.icu/api/v1';
export const INTERVALS_ICU_SOURCE_KEY = 'intervals-icu';

function secret(name) {
  return String(process.env[name] || '').trim();
}

export function intervalsIcuConfigured() {
  return Boolean(secret('INTERVALS_ICU_API_KEY') && secret('INTERVALS_ICU_ATHLETE_ID'));
}

function athleteId() {
  const value = secret('INTERVALS_ICU_ATHLETE_ID');
  if (!value) throw new Error('INTERVALS_ICU_ATHLETE_ID is not configured');
  return value;
}

function apiKey() {
  const value = secret('INTERVALS_ICU_API_KEY');
  if (!value) throw new Error('INTERVALS_ICU_API_KEY is not configured');
  return value;
}

function authHeader() {
  return `Basic ${Buffer.from(`API_KEY:${apiKey()}`, 'utf8').toString('base64')}`;
}

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('invalid_intervals_icu_date');
  return text;
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function field(record, names = []) {
  const custom = record?.customFields && typeof record.customFields === 'object' ? record.customFields : {};
  for (const source of [record || {}, custom]) {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(source, name)) return source[name];
    }
    const lower = new Map(Object.entries(source).map(([key, value]) => [key.toLowerCase(), value]));
    for (const name of names) {
      if (lower.has(String(name).toLowerCase())) return lower.get(String(name).toLowerCase());
    }
  }
  return null;
}

function sourceAsOf(record, date) {
  const updated = record?.updated ? new Date(record.updated) : null;
  if (updated && !Number.isNaN(updated.getTime())) return updated.toISOString();
  return new Date(`${date}T12:00:00+02:00`).toISOString();
}

async function requestRange({ oldest, newest }) {
  const url = new URL(`${API_BASE}/athlete/${encodeURIComponent(athleteId())}/wellness`);
  url.searchParams.set('oldest', isoDate(oldest));
  url.searchParams.set('newest', isoDate(newest));
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json'
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Intervals.icu wellness request failed (HTTP ${response.status})${body ? `: ${body.slice(0, 240)}` : ''}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error('Intervals.icu wellness response was not an array');
  return payload;
}

export async function fetchIntervalsWellnessRange({ oldest, newest }) {
  if (!intervalsIcuConfigured()) throw new Error('Intervals.icu wellness source is not configured');
  return requestRange({ oldest, newest });
}

export function normalizeIntervalsWellnessRecord(record = {}) {
  const localDate = isoDate(record.id);
  const sleepSecs = number(field(record, ['sleepSecs']));
  return {
    snapshot: {
      sourceKey: INTERVALS_ICU_SOURCE_KEY,
      localDate,
      sourceAsOf: sourceAsOf(record, localDate),
      steps: number(field(record, ['steps', 'Steps'])),
      distanceKm: null,
      activeCalories: null,
      activeMinutes: null,
      intensityMinutes: null,
      floors: null,
      heartRateCurrent: null,
      restingHeartRate: number(field(record, ['restingHR'])),
      stressAvg: null,
      stressCurrent: null,
      bodyBatteryCurrent: null,
      bodyBatteryHigh: number(field(record, ['BodyBatteryMax', 'bodyBatteryMax'])),
      bodyBatteryLow: number(field(record, ['BodyBatteryMin', 'bodyBatteryMin'])),
      bodyBatteryCharged: null,
      bodyBatteryDrained: null,
      hrvLastNight: number(field(record, ['hrv'])),
      sleepScore: number(field(record, ['sleepScore'])),
      sleepHours: sleepSecs === null ? null : sleepSecs / 3600,
      respirationCurrent: number(field(record, ['respiration'])),
      sourceStatus: 'available'
    },
    series: [],
    rawPayload: record
  };
}

export async function markIntervalsIcuSynced() {
  const sql = await getSql();
  await sql`
    INSERT INTO fz_source_connections
      (source_key,status,connected_at,last_sync_at,last_error,updated_at)
    VALUES
      (${INTERVALS_ICU_SOURCE_KEY},'CONNECTED',NOW(),NOW(),NULL,NOW())
    ON CONFLICT (source_key) DO UPDATE SET
      status='CONNECTED',
      connected_at=COALESCE(fz_source_connections.connected_at,NOW()),
      last_sync_at=NOW(),
      last_error=NULL,
      updated_at=NOW()
  `;
}

export async function markIntervalsIcuError(message) {
  const sql = await getSql();
  const safe = String(message || 'Intervals.icu source error').slice(0, 1000);
  await sql`
    INSERT INTO fz_source_connections
      (source_key,status,last_error,updated_at)
    VALUES
      (${INTERVALS_ICU_SOURCE_KEY},'ERROR',${safe},NOW())
    ON CONFLICT (source_key) DO UPDATE SET
      status='ERROR',
      last_error=${safe},
      updated_at=NOW()
  `;
}

export async function publicIntervalsIcuStatus() {
  const configured = intervalsIcuConfigured();
  let row = null;
  try {
    const sql = await getSql();
    const rows = await sql`
      SELECT status,connected_at,last_sync_at,last_error,updated_at
      FROM fz_source_connections
      WHERE source_key=${INTERVALS_ICU_SOURCE_KEY}
      LIMIT 1
    `;
    row = rows?.[0] || null;
  } catch {}
  return {
    source: 'Intervals.icu / Garmin wellness bridge',
    status: !configured ? 'DISCONNECTED' : row?.status || 'CONFIGURED',
    configured,
    verified: configured && row?.status === 'CONNECTED',
    connectedAt: row?.connected_at || null,
    lastSyncAt: row?.last_sync_at || null,
    lastError: row?.last_error || null,
    updatedAt: row?.updated_at || null,
    athleteIdConfigured: Boolean(secret('INTERVALS_ICU_ATHLETE_ID')),
    apiKeyConfigured: Boolean(secret('INTERVALS_ICU_API_KEY')),
    secretsExposed: false
  };
}

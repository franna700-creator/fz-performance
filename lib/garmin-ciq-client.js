import { timingSafeEqual } from 'node:crypto';
import { getSql } from './db.js';

export const GARMIN_CIQ_SOURCE_KEY = 'garmin-ciq';
const TZ = 'Africa/Johannesburg';
const MAX_BACKFILL_MS = 48 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 15 * 60 * 1000;
const SERIES_NAMES = ['heart_rate', 'stress', 'body_battery', 'respiration'];

function secret(name) {
  return String(process.env[name] || '').trim();
}

export function garminCiqConfigured() {
  return Boolean(secret('FZ_CIQ_INGEST_TOKEN'));
}

function safeTokenEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authorizeGarminCiqRequest(req) {
  const expected = secret('FZ_CIQ_INGEST_TOKEN');
  if (!expected) return { ok: false, status: 503, error: 'garmin_ciq_not_configured' };
  const auth = String(req?.headers?.authorization || '');
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const alternate = String(req?.headers?.['x-fz-ciq-token'] || '');
  const actual = bearer || alternate;
  return safeTokenEqual(actual, expected)
    ? { ok: true }
    : { ok: false, status: 401, error: 'invalid_garmin_ciq_token' };
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  let ms;
  if (Number.isFinite(numeric)) ms = Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric;
  else ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function localDateSast(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('garmin_ciq_invalid_observed_at');
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function normalizePoint(point) {
  if (Array.isArray(point)) return { observedAt: isoTimestamp(point[0]), value: number(point[1]) };
  if (point && typeof point === 'object') {
    return {
      observedAt: isoTimestamp(point.observedAt ?? point.t ?? point.when),
      value: number(point.value ?? point.v ?? point.data)
    };
  }
  return { observedAt: null, value: null };
}

function validSeriesValue(name, value) {
  if (!Number.isFinite(value)) return false;
  if (name === 'stress') return value >= 0 && value <= 100;
  if (name === 'body_battery') return value >= 0 && value <= 100;
  if (name === 'heart_rate') return value > 0 && value < 260;
  if (name === 'respiration') return value > 0 && value < 80;
  return false;
}

function normalizeSeries(payload = {}, fallbackObservedAt) {
  const rows = [];
  for (const name of SERIES_NAMES) {
    const points = Array.isArray(payload?.series?.[name]) ? payload.series[name] : [];
    for (const raw of points) {
      const point = normalizePoint(raw);
      const observedAt = point.observedAt || fallbackObservedAt;
      if (!observedAt || !validSeriesValue(name, point.value)) continue;
      rows.push({
        source_key: GARMIN_CIQ_SOURCE_KEY,
        local_date: localDateSast(observedAt),
        series_name: name,
        observed_at: observedAt,
        value: point.value
      });
    }
  }
  return rows.sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}

function latestSeriesValue(rows, name) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].series_name === name) return Number(rows[i].value);
  }
  return null;
}

function boundedObservationTime(value) {
  const observedAt = isoTimestamp(value) || new Date().toISOString();
  const ms = Date.parse(observedAt);
  const now = Date.now();
  if (ms > now + MAX_FUTURE_SKEW_MS) throw new Error('garmin_ciq_observation_in_future');
  if (ms < now - MAX_BACKFILL_MS) throw new Error('garmin_ciq_observation_too_old');
  return observedAt;
}

export function normalizeGarminCiqPayload(raw = {}) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const observedAt = boundedObservationTime(payload.observedAt ?? payload.sentAt ?? payload.timestamp);
  const series = normalizeSeries(payload, observedAt);
  const latestSeriesAt = series.reduce((latest, row) => !latest || row.observed_at > latest ? row.observed_at : latest, null);
  const sourceAsOf = latestSeriesAt || observedAt;
  const current = payload.current && typeof payload.current === 'object' ? payload.current : payload;

  const heartRate = number(current.heartRate ?? current.heart_rate) ?? latestSeriesValue(series, 'heart_rate');
  const stress = number(current.stress ?? current.stressScore) ?? latestSeriesValue(series, 'stress');
  const bodyBattery = number(current.bodyBattery ?? current.body_battery) ?? latestSeriesValue(series, 'body_battery');
  const respiration = number(current.respiration ?? current.respirationRate) ?? latestSeriesValue(series, 'respiration');
  const steps = number(current.steps);

  const localDate = localDateSast(sourceAsOf);
  return {
    snapshot: {
      sourceKey: GARMIN_CIQ_SOURCE_KEY,
      localDate,
      sourceAsOf,
      steps,
      distanceKm: null,
      activeCalories: null,
      activeMinutes: null,
      intensityMinutes: null,
      floors: null,
      heartRateCurrent: validSeriesValue('heart_rate', heartRate) ? heartRate : null,
      restingHeartRate: null,
      stressAvg: null,
      stressCurrent: validSeriesValue('stress', stress) ? stress : null,
      bodyBatteryCurrent: validSeriesValue('body_battery', bodyBattery) ? bodyBattery : null,
      bodyBatteryHigh: null,
      bodyBatteryLow: null,
      bodyBatteryCharged: null,
      bodyBatteryDrained: null,
      hrvLastNight: null,
      sleepScore: null,
      sleepHours: null,
      respirationCurrent: validSeriesValue('respiration', respiration) ? respiration : null,
      sourceStatus: 'available'
    },
    series,
    rawPayload: {
      schemaVersion: String(payload.schemaVersion || '1.0'),
      device: payload.device || null,
      observedAt,
      current: {
        steps,
        heartRate: validSeriesValue('heart_rate', heartRate) ? heartRate : null,
        stress: validSeriesValue('stress', stress) ? stress : null,
        bodyBattery: validSeriesValue('body_battery', bodyBattery) ? bodyBattery : null,
        respiration: validSeriesValue('respiration', respiration) ? respiration : null
      },
      series: payload.series || {}
    }
  };
}

export async function markGarminCiqSynced() {
  const sql = await getSql();
  await sql`
    INSERT INTO fz_source_connections
      (source_key,status,connected_at,last_sync_at,last_error,updated_at)
    VALUES
      (${GARMIN_CIQ_SOURCE_KEY},'CONNECTED',NOW(),NOW(),NULL,NOW())
    ON CONFLICT (source_key) DO UPDATE SET
      status='CONNECTED',
      connected_at=COALESCE(fz_source_connections.connected_at,NOW()),
      last_sync_at=NOW(),
      last_error=NULL,
      updated_at=NOW()
  `;
}

export async function markGarminCiqError(message) {
  const sql = await getSql();
  const safe = String(message || 'Garmin Connect IQ bridge error').slice(0, 1000);
  await sql`
    INSERT INTO fz_source_connections (source_key,status,last_error,updated_at)
    VALUES (${GARMIN_CIQ_SOURCE_KEY},'ERROR',${safe},NOW())
    ON CONFLICT (source_key) DO UPDATE SET
      status='ERROR',last_error=${safe},updated_at=NOW()
  `;
}

export async function publicGarminCiqStatus() {
  const configured = garminCiqConfigured();
  let row = null;
  try {
    const sql = await getSql();
    const rows = await sql`
      SELECT status,connected_at,last_sync_at,last_error,updated_at
      FROM fz_source_connections
      WHERE source_key=${GARMIN_CIQ_SOURCE_KEY}
      LIMIT 1
    `;
    row = rows?.[0] || null;
  } catch {}
  return {
    source: 'Garmin fēnix 8 / Connect IQ live bridge',
    status: !configured ? 'DISCONNECTED' : row?.status || 'CONFIGURED',
    configured,
    verified: configured && row?.status === 'CONNECTED',
    connectedAt: row?.connected_at || null,
    lastSyncAt: row?.last_sync_at || null,
    lastError: row?.last_error || null,
    updatedAt: row?.updated_at || null,
    secretsExposed: false
  };
}

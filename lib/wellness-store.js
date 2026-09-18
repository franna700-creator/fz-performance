import { createHash } from 'node:crypto';
import { getSql } from './db.js';
import { FITNESS_AI_SOURCE_KEY, markSourceSynced } from './source-connection-store.js';
import { INTERVALS_ICU_SOURCE_KEY } from './intervals-icu-client.js';
import { GARMIN_CIQ_SOURCE_KEY } from './garmin-ciq-client.js';

const SERIES_NAMES = ['heart_rate', 'stress', 'body_battery', 'respiration'];
const SAST_TIME_ZONE = 'Africa/Johannesburg';
const SOURCE_PRIORITY = [INTERVALS_ICU_SOURCE_KEY, GARMIN_CIQ_SOURCE_KEY, FITNESS_AI_SOURCE_KEY];
const MAX_INTRADAY_AGE_MINUTES = 60;

function localDateSast(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAST_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function isoFromSeriesPoint(meta, offsetS) {
  const t0 = meta?.basis?.t0_utc;
  if (!t0 || !Number.isFinite(Number(offsetS))) return null;
  const ms = Date.parse(t0) + Number(offsetS) * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function latestValidPoint(points, { nonNegative = false } = {}) {
  if (!Array.isArray(points)) return null;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = Number(points[i]?.[1]);
    if (!Number.isFinite(value)) continue;
    if (nonNegative && value < 0) continue;
    return { offsetS: Number(points[i]?.[0]), value };
  }
  return null;
}

function latestSeriesTimestamp(payload) {
  let latest = null;
  for (const name of SERIES_NAMES) {
    const point = latestValidPoint(payload?.series?.[name]);
    const iso = point ? isoFromSeriesPoint(payload?.series_meta?.[name], point.offsetS) : null;
    if (iso && (!latest || iso > latest)) latest = iso;
  }
  return latest;
}

function intensityMinutes(daily) {
  const moderate = Number(daily?.intensity_duration_s?.moderate || 0) / 60;
  const vigorous = Number(daily?.intensity_duration_s?.vigorous || 0) / 60;
  return moderate + (2 * vigorous);
}

function normalizedSeries(payload, localDate, sourceKey = FITNESS_AI_SOURCE_KEY) {
  const rows = [];
  for (const name of SERIES_NAMES) {
    const points = Array.isArray(payload?.series?.[name]) ? payload.series[name] : [];
    const meta = payload?.series_meta?.[name];
    for (const point of points) {
      const value = Number(point?.[1]);
      const observedAt = isoFromSeriesPoint(meta, point?.[0]);
      if (!observedAt || !Number.isFinite(value)) continue;
      rows.push({ source_key: sourceKey, local_date: localDate, series_name: name, observed_at: observedAt, value });
    }
  }
  return rows;
}

function withSourceHash(normalized) {
  const { snapshot, series = [] } = normalized;
  const canonicalForHash = JSON.stringify({ snapshot, series });
  const sourceHash = createHash('sha256').update(canonicalForHash).digest('hex');
  return { ...normalized, snapshot: { ...snapshot, sourceHash } };
}

export function normalizeWellnessPayload(rawPayload) {
  const payload = rawPayload?.data && rawPayload?.series
    ? rawPayload
    : rawPayload?.data?.data && rawPayload?.data?.series
      ? rawPayload.data
      : rawPayload;

  const daily = payload?.data?.daily || {};
  const sleep = payload?.data?.sleep || {};
  const stress = payload?.data?.stress || {};
  const hrv = payload?.data?.hrv || {};
  const localDate = daily.calendar_date || sleep.calendar_date || stress.calendar_date || hrv.calendar_date || localDateSast();
  const latestHr = latestValidPoint(payload?.series?.heart_rate);
  const latestStress = latestValidPoint(payload?.series?.stress, { nonNegative: true });
  const latestBb = latestValidPoint(payload?.series?.body_battery);
  const latestResp = latestValidPoint(payload?.series?.respiration, { nonNegative: true });
  const sourceAsOf = latestSeriesTimestamp(payload) || new Date().toISOString();

  return withSourceHash({
    snapshot: {
      sourceKey: FITNESS_AI_SOURCE_KEY,
      localDate,
      sourceAsOf,
      steps: daily.steps ?? null,
      distanceKm: daily.distance_km ?? null,
      activeCalories: daily.calories?.active ?? null,
      activeMinutes: daily.active_time_min ?? null,
      intensityMinutes: intensityMinutes(daily),
      floors: daily.floors_climbed ?? null,
      heartRateCurrent: latestHr?.value ?? daily.heart_rate?.avg ?? null,
      restingHeartRate: daily.heart_rate?.resting ?? null,
      stressAvg: daily.stress_avg ?? stress.overall_stress ?? null,
      stressCurrent: latestStress?.value ?? null,
      bodyBatteryCurrent: latestBb?.value ?? null,
      bodyBatteryHigh: stress.body_battery?.high ?? null,
      bodyBatteryLow: stress.body_battery?.low ?? null,
      bodyBatteryCharged: daily.body_battery?.charged ?? null,
      bodyBatteryDrained: daily.body_battery?.drained ?? null,
      hrvLastNight: hrv.last_night_avg ?? null,
      sleepScore: sleep.sleep_score ?? null,
      sleepHours: sleep.duration_hours ?? null,
      respirationCurrent: latestResp?.value ?? null,
      sourceStatus: payload?.data_status || 'available'
    },
    series: normalizedSeries(payload, localDate, FITNESS_AI_SOURCE_KEY),
    rawPayload: payload
  });
}

export async function ingestNormalizedWellness(normalized) {
  const prepared = normalized?.snapshot?.sourceHash ? normalized : withSourceHash(normalized || {});
  const { snapshot, series = [] } = prepared;
  if (!snapshot?.sourceKey || !snapshot?.localDate || !snapshot?.sourceAsOf) throw new Error('normalized_wellness_snapshot_incomplete');
  const sql = await getSql();
  const rawJson = JSON.stringify(prepared.rawPayload || {});

  await sql`
    INSERT INTO fz_wellness_snapshots (
      source_key, local_date, source_as_of, steps, distance_km, active_calories,
      active_minutes, intensity_minutes, floors, heart_rate_current, resting_heart_rate,
      stress_avg, stress_current, body_battery_current, body_battery_high, body_battery_low,
      body_battery_charged, body_battery_drained, hrv_last_night, sleep_score, sleep_hours,
      respiration_current, source_hash, source_status, payload
    ) VALUES (
      ${snapshot.sourceKey}, ${snapshot.localDate}::date, ${snapshot.sourceAsOf}::timestamptz,
      ${snapshot.steps}, ${snapshot.distanceKm}, ${snapshot.activeCalories}, ${snapshot.activeMinutes},
      ${snapshot.intensityMinutes}, ${snapshot.floors}, ${snapshot.heartRateCurrent},
      ${snapshot.restingHeartRate}, ${snapshot.stressAvg}, ${snapshot.stressCurrent},
      ${snapshot.bodyBatteryCurrent}, ${snapshot.bodyBatteryHigh}, ${snapshot.bodyBatteryLow},
      ${snapshot.bodyBatteryCharged}, ${snapshot.bodyBatteryDrained}, ${snapshot.hrvLastNight},
      ${snapshot.sleepScore}, ${snapshot.sleepHours}, ${snapshot.respirationCurrent},
      ${snapshot.sourceHash}, ${snapshot.sourceStatus || 'available'}, ${rawJson}::jsonb
    )
    ON CONFLICT (source_key, local_date, source_hash) DO NOTHING
  `;

  if (series.length) {
    const seriesJson = JSON.stringify(series);
    await sql`
      INSERT INTO fz_wellness_series_points (
        source_key, local_date, series_name, observed_at, value
      )
      SELECT source_key, local_date::date, series_name, observed_at::timestamptz, value
      FROM jsonb_to_recordset(${seriesJson}::jsonb) AS x(
        source_key text, local_date text, series_name text, observed_at text, value numeric
      )
      ON CONFLICT (source_key, series_name, observed_at)
      DO UPDATE SET value = EXCLUDED.value, local_date = EXCLUDED.local_date, ingested_at = NOW()
    `;
  }

  if (snapshot.sourceKey === FITNESS_AI_SOURCE_KEY) await markSourceSynced();
  return getWellnessToday(snapshot.localDate, { sourceKey: snapshot.sourceKey });
}

export async function ingestWellnessPayload(rawPayload) {
  return ingestNormalizedWellness(normalizeWellnessPayload(rawPayload));
}

async function readWellnessSource(sql, date, sourceKey) {
  const snapshotRows = await sql`
    SELECT * FROM fz_wellness_current
    WHERE source_key = ${sourceKey} AND local_date = ${date}::date
    ORDER BY source_as_of DESC, ingested_at DESC, id DESC
    LIMIT 1
  `;
  const row = snapshotRows?.[0];
  if (!row) return null;

  const seriesRows = await sql`
    SELECT series_name, observed_at, value
    FROM fz_wellness_series_points
    WHERE source_key = ${sourceKey} AND local_date = ${date}::date
    ORDER BY observed_at ASC
  `;
  const series = Object.fromEntries(SERIES_NAMES.map(name => [name, []]));
  for (const point of seriesRows || []) {
    if (series[point.series_name]) series[point.series_name].push([new Date(point.observed_at).toISOString(), Number(point.value)]);
  }
  const sourceAsOf = new Date(row.source_as_of).toISOString();
  const ageMinutes = Math.max(0, (Date.now() - Date.parse(sourceAsOf)) / 60000);
  return {
    sourceKey: row.source_key,
    date: row.local_date instanceof Date ? row.local_date.toISOString().slice(0, 10) : String(row.local_date).slice(0, 10),
    sourceAsOf,
    ingestedAt: new Date(row.ingested_at).toISOString(),
    freshness: ageMinutes <= 20 ? 'LIVE' : ageMinutes <= 60 ? 'DELAYED' : 'STALE',
    ageMinutes: Math.round(ageMinutes),
    current: {
      steps: row.steps == null ? null : Number(row.steps),
      distanceKm: row.distance_km == null ? null : Number(row.distance_km),
      activeCalories: row.active_calories == null ? null : Number(row.active_calories),
      activeMinutes: row.active_minutes == null ? null : Number(row.active_minutes),
      intensityMinutes: row.intensity_minutes == null ? null : Number(row.intensity_minutes),
      floors: row.floors == null ? null : Number(row.floors),
      heartRate: row.heart_rate_current == null ? null : Number(row.heart_rate_current),
      restingHeartRate: row.resting_heart_rate == null ? null : Number(row.resting_heart_rate),
      stressAvg: row.stress_avg == null ? null : Number(row.stress_avg),
      stress: row.stress_current == null ? null : Number(row.stress_current),
      bodyBattery: row.body_battery_current == null ? null : Number(row.body_battery_current),
      bodyBatteryHigh: row.body_battery_high == null ? null : Number(row.body_battery_high),
      bodyBatteryLow: row.body_battery_low == null ? null : Number(row.body_battery_low),
      hrv: row.hrv_last_night == null ? null : Number(row.hrv_last_night),
      sleepScore: row.sleep_score == null ? null : Number(row.sleep_score),
      sleepHours: row.sleep_hours == null ? null : Number(row.sleep_hours),
      respiration: row.respiration_current == null ? null : Number(row.respiration_current)
    },
    series
  };
}

function hasIntradayEvidence(wellness) {
  if (!wellness) return false;
  const ageMinutes = Number(wellness.ageMinutes);
  if (!Number.isFinite(ageMinutes) || ageMinutes > MAX_INTRADAY_AGE_MINUTES) return false;
  const c = wellness.current || {};
  if ([c.heartRate, c.stress, c.bodyBattery, c.respiration].some(value => Number.isFinite(Number(value)))) return true;
  return SERIES_NAMES.some(name => Array.isArray(wellness.series?.[name]) && wellness.series[name].length > 0);
}

function newestIso(...values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

export async function getWellnessToday(date = localDateSast(), { sourceKey = null } = {}) {
  const sql = await getSql();
  if (sourceKey) return readWellnessSource(sql, date, sourceKey);

  const [intervals, ciq, fitness] = await Promise.all([
    readWellnessSource(sql, date, INTERVALS_ICU_SOURCE_KEY),
    readWellnessSource(sql, date, GARMIN_CIQ_SOURCE_KEY),
    readWellnessSource(sql, date, FITNESS_AI_SOURCE_KEY)
  ]);
  const daily = intervals || fitness || ciq;
  if (!daily) return null;

  const intradayAvailable = hasIntradayEvidence(ciq);
  const base = daily.current || {};
  const live = intradayAvailable ? (ciq.current || {}) : {};
  const preferLive = key => live[key] == null ? base[key] : live[key];
  const preferDailyWithLiveFallback = key => base[key] == null ? live[key] : base[key];
  const sourceAsOf = intradayAvailable ? ciq.sourceAsOf : daily.sourceAsOf;
  const ingestedAt = newestIso(daily.ingestedAt, intradayAvailable ? ciq.ingestedAt : null);
  const ageMinutes = sourceAsOf ? Math.max(0, (Date.now() - Date.parse(sourceAsOf)) / 60000) : null;
  const freshness = intradayAvailable
    ? (ageMinutes <= 20 ? 'LIVE' : ageMinutes <= 60 ? 'DELAYED' : 'STALE')
    : 'DAILY';

  return {
    sourceKey: intradayAvailable ? 'canonical-wellness-composite' : daily.sourceKey,
    date,
    sourceAsOf,
    ingestedAt,
    freshness,
    ageMinutes: ageMinutes == null ? null : Math.round(ageMinutes),
    mode: intradayAvailable ? 'LIVE_INTRADAY' : 'DAILY_RECOVERY',
    capabilities: {
      intraday: intradayAvailable,
      heartRateCurrent: intradayAvailable && live.heartRate != null,
      stressCurrent: intradayAvailable && live.stress != null,
      bodyBatteryCurrent: intradayAvailable && live.bodyBattery != null,
      respirationCurrent: intradayAvailable && live.respiration != null,
      sleepScoreFallback: intradayAvailable && base.sleepScore == null && live.sleepScore != null,
      overnightRecovery: Boolean(intervals || fitness)
    },
    sources: {
      daily: daily ? { sourceKey: daily.sourceKey, sourceAsOf: daily.sourceAsOf, ingestedAt: daily.ingestedAt } : null,
      intraday: intradayAvailable ? { sourceKey: ciq.sourceKey, sourceAsOf: ciq.sourceAsOf, ingestedAt: ciq.ingestedAt } : null
    },
    current: {
      ...base,
      steps: preferLive('steps'),
      heartRate: preferLive('heartRate'),
      stress: preferLive('stress'),
      bodyBattery: preferLive('bodyBattery'),
      respiration: preferLive('respiration'),
      sleepScore: preferDailyWithLiveFallback('sleepScore')
    },
    series: intradayAvailable ? ciq.series : daily.series
  };
}

export { localDateSast };

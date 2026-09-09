import { createHash } from 'node:crypto';
import { getSql } from './db.js';
import { FITNESS_AI_SOURCE_KEY, markSourceSynced } from './source-connection-store.js';

const SERIES_NAMES = ['heart_rate', 'stress', 'body_battery', 'respiration'];
const SAST_TIME_ZONE = 'Africa/Johannesburg';

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

function normalizedSeries(payload, localDate) {
  const rows = [];
  for (const name of SERIES_NAMES) {
    const points = Array.isArray(payload?.series?.[name]) ? payload.series[name] : [];
    const meta = payload?.series_meta?.[name];
    for (const point of points) {
      const value = Number(point?.[1]);
      const observedAt = isoFromSeriesPoint(meta, point?.[0]);
      if (!observedAt || !Number.isFinite(value)) continue;
      rows.push({ sourceKey: FITNESS_AI_SOURCE_KEY, localDate, seriesName: name, observedAt, value });
    }
  }
  return rows;
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

  const snapshot = {
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
  };

  const series = normalizedSeries(payload, localDate);
  const canonicalForHash = JSON.stringify({ snapshot, series });
  const sourceHash = createHash('sha256').update(canonicalForHash).digest('hex');
  return { snapshot: { ...snapshot, sourceHash }, series, rawPayload: payload };
}

export async function ingestWellnessPayload(rawPayload) {
  const normalized = normalizeWellnessPayload(rawPayload);
  const { snapshot, series } = normalized;
  const sql = await getSql();
  const rawJson = JSON.stringify(normalized.rawPayload);

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
      ${snapshot.sourceHash}, ${snapshot.sourceStatus}, ${rawJson}::jsonb
    )
    ON CONFLICT (source_key, local_date, source_hash) DO NOTHING
  `;

  for (const row of series) {
    await sql`
      INSERT INTO fz_wellness_series_points (
        source_key, local_date, series_name, observed_at, value
      ) VALUES (
        ${row.sourceKey}, ${row.localDate}::date, ${row.seriesName}, ${row.observedAt}::timestamptz, ${row.value}
      )
      ON CONFLICT (source_key, series_name, observed_at)
      DO UPDATE SET value = EXCLUDED.value, local_date = EXCLUDED.local_date, ingested_at = NOW()
    `;
  }

  await markSourceSynced();
  return getWellnessToday(snapshot.localDate);
}

export async function getWellnessToday(date = localDateSast()) {
  const sql = await getSql();
  const snapshotRows = await sql`
    SELECT * FROM fz_wellness_current
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY} AND local_date = ${date}::date
    LIMIT 1
  `;
  const row = snapshotRows?.[0];
  if (!row) return null;

  const seriesRows = await sql`
    SELECT series_name, observed_at, value
    FROM fz_wellness_series_points
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY} AND local_date = ${date}::date
    ORDER BY observed_at ASC
  `;

  const series = Object.fromEntries(SERIES_NAMES.map(name => [name, []]));
  for (const point of seriesRows || []) {
    if (series[point.series_name]) {
      series[point.series_name].push([new Date(point.observed_at).toISOString(), Number(point.value)]);
    }
  }

  const sourceAsOf = new Date(row.source_as_of).toISOString();
  const ageMinutes = Math.max(0, (Date.now() - Date.parse(sourceAsOf)) / 60000);
  const freshness = ageMinutes <= 20 ? 'LIVE' : ageMinutes <= 60 ? 'DELAYED' : 'STALE';

  return {
    date: String(row.local_date),
    sourceAsOf,
    ingestedAt: new Date(row.ingested_at).toISOString(),
    freshness,
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

export { localDateSast };

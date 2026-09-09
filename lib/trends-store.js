import { getSql } from './db.js';
import { loadDatabaseRuntimeState } from './runtime-store.js';

const TZ = 'Africa/Johannesburg';
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

function n(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
function dateText(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function labelDate(date) {
  if (!date) return '—';
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(d);
}
function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function legacyLabelToDate(label, year = 2026) {
  const m = String(label || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${year}-${MONTHS[m[2]]}-${String(m[1]).padStart(2, '0')}`;
}
function summaryOf(payload) {
  return payload?.summary && typeof payload.summary === 'object' ? payload.summary : {};
}
function hrDistribution(summary) {
  const dist = summary?.intensityDistribution?.heartrate;
  if (dist && typeof dist === 'object') {
    const low = n(dist[0] ?? dist['0']);
    const moderate = n(dist[1] ?? dist['1']);
    const high = n(dist[2] ?? dist['2']);
    if ([low, moderate, high].every(v => v !== null)) return [low, moderate, high];
  }
  const zones = summary?.zonesDistribution?.heartrate;
  if (Array.isArray(zones) && zones.length >= 3) {
    const vals = zones.slice(0, 3).map(n);
    if (vals.every(v => v !== null)) return vals;
  }
  return null;
}
function activityNcl(summary) {
  const dist = hrDistribution(summary);
  if (!dist) return null;
  return round((dist[0] + (2 * dist[1]) + (4 * dist[2])) / 60, 4);
}
function activityMetrics(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const summary = summaryOf(payload);
  const avgHr = n(summary.heartrate ?? payload['summary.heartrate']);
  const avgPower = n(summary.power);
  const pace = n(summary.pace);
  const durationSeconds = n(summary.durationTotal ?? summary.duration ?? payload['summary.durationTotal'] ?? payload['summary.duration']);
  const distanceMeters = n(summary.distance ?? payload['summary.distance']);
  const ncl = activityNcl(summary);
  return {
    sessionId: row.session_id,
    date: row.local_date,
    title: row.title || payload.title || null,
    sportType: row.sport_type || payload.sportType || null,
    sessionKind: row.session_kind || null,
    status: row.status,
    reconciliationState: row.reconciliation_state,
    sourceRecordId: row.source_record_id || null,
    detailLevel: payload.detailLevel || 'activity-list',
    durationSeconds,
    durationMin: durationSeconds === null ? null : round(durationSeconds / 60, 2),
    distanceKm: distanceMeters === null ? null : round(distanceMeters / 1000, 3),
    paceSecPerKm: pace,
    avgHeartRate: avgHr,
    maxHeartRate: n(summary.heartrateMax),
    avgPower,
    powerHr: avgHr && avgPower ? round(avgPower / avgHr, 3) : null,
    runningEffectiveness: n(summary.runningEffectiveness),
    groundContactTimeMs: n(summary.groundContactTime),
    flightTimeMs: n(summary.flightTime),
    stepLengthCm: n(summary.stepLength),
    ascentM: n(summary?.altitude?.ascent),
    walkingDurationMin: n(summary.walkingDuration) === null ? null : round(n(summary.walkingDuration) / 60, 2),
    hrEffort: n(summary?.effort?.heartrate),
    ncl,
    nclAvailable: ncl !== null,
    hrDistributionSeconds: hrDistribution(summary)
  };
}
function eventText(events) {
  return events.map(e => `${e.summary || ''} ${JSON.stringify(e.payload || {})}`).join(' ').toLowerCase();
}
function aetClass(metric, events = []) {
  const isRunning = String(metric.sportType || '').toLowerCase().includes('run');
  const isAet = metric.sessionKind === 'AET' || /\baet\b/i.test(metric.title || '');
  if (!isRunning || !isAet) return null;
  const text = eventText(events);
  if (metric.status === 'STOPPED_EARLY' || metric.status === 'ABORTED') {
    if (/\b(gi|stomach|abdominal|bloat|bloating|gastro|cramp)\b/.test(text) || (metric.durationSeconds !== null && metric.durationSeconds < 1800)) {
      return 'NON_COMPARABLE';
    }
    return 'MATCHED_CAVEAT';
  }
  return metric.powerHr !== null ? 'MATCHED' : 'INSUFFICIENT_DATA';
}
function runningClass(metric, aetComparison) {
  if (aetComparison) return `AET_${aetComparison}`;
  const title = String(metric.title || '').toLowerCase();
  if (title.includes('treadmill')) return 'TREADMILL_CONTEXT';
  if (title.includes('trail') || (metric.ascentM && metric.distanceKm && metric.ascentM / metric.distanceKm > 30)) return 'TRAIL_CONTEXT';
  return 'CONTEXTUAL_RUN';
}
function legacyLoadMap(runtimeState) {
  const map = new Map();
  const rows = runtimeState?.datasets?.LOAD;
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const date = legacyLabelToDate(row[0]);
    const value = n(row[1]);
    if (date) map.set(date, value);
  }
  return map;
}
function rolling(series, days) {
  const tail = series.slice(-days);
  const missing = tail.filter(point => point.value === null).map(point => point.date);
  return {
    days,
    value: missing.length ? null : round(tail.reduce((sum, point) => sum + Number(point.value || 0), 0), 2),
    missingDates: missing
  };
}

async function readEvidence(startDate, endDate) {
  const sql = await getSql();
  const sessions = await sql`
    SELECT DISTINCT ON (s.session_id)
      s.session_id,
      s.local_date::text AS local_date,
      s.actual_start_at,
      s.title,
      s.sport_type,
      s.session_kind,
      s.status,
      s.reconciliation_state,
      r.source_record_id,
      r.payload,
      r.ingested_at
    FROM fz_training_sessions s
    LEFT JOIN fz_training_session_sources l
      ON l.session_id=s.session_id AND l.relationship='EXECUTION'
    LEFT JOIN fz_training_source_records r
      ON r.id=l.source_record_pk AND r.source_key='tredict' AND r.record_type='executed_activity'
    WHERE s.local_date BETWEEN ${startDate} AND ${endDate}
      AND s.status <> 'SUPERSEDED'
    ORDER BY s.session_id,
      CASE WHEN r.payload->>'detailLevel'='activity-detail' THEN 0 ELSE 1 END,
      r.ingested_at DESC NULLS LAST,
      r.id DESC NULLS LAST
  `;
  const events = await sql`
    SELECT event_key,session_id,event_type,occurred_at,local_date::text AS local_date,actor,certainty,summary,payload
    FROM fz_athlete_events
    WHERE local_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY occurred_at,event_id
  `;
  const wellness = await sql`
    SELECT * FROM fz_wellness_current ORDER BY local_date DESC, source_as_of DESC NULLS LAST LIMIT 1
  `;
  return { sessions, events, wellness: wellness[0] || null };
}

export async function buildCurrentTrends({ days = 45 } = {}) {
  const endDate = todayLocal();
  const startDate = addDays(endDate, -(Math.max(28, Math.min(90, Number(days) || 45)) - 1));
  const [runtime, evidence] = await Promise.all([
    loadDatabaseRuntimeState().catch(() => null),
    readEvidence(startDate, endDate)
  ]);
  const runtimeState = runtime?.state || null;
  const eventsBySession = new Map();
  for (const event of evidence.events) {
    if (!event.session_id) continue;
    if (!eventsBySession.has(event.session_id)) eventsBySession.set(event.session_id, []);
    eventsBySession.get(event.session_id).push(event);
  }

  const metrics = evidence.sessions.map(activityMetrics);
  const aets = [];
  const runs = [];
  for (const metric of metrics) {
    const comparison = aetClass(metric, eventsBySession.get(metric.sessionId) || []);
    if (comparison) {
      aets.push({ ...metric, comparison });
    }
    if (String(metric.sportType || '').toLowerCase().includes('run') && metric.paceSecPerKm !== null && metric.avgPower !== null) {
      runs.push({ ...metric, comparisonClass: runningClass(metric, comparison) });
    }
  }
  aets.sort((a,b) => a.date.localeCompare(b.date));
  runs.sort((a,b) => a.date.localeCompare(b.date));
  const matchedAet = aets.filter(row => ['MATCHED','MATCHED_CAVEAT'].includes(row.comparison) && row.powerHr !== null);
  const excludedAet = aets.filter(row => !['MATCHED','MATCHED_CAVEAT'].includes(row.comparison));

  const byDate = new Map();
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) byDate.set(date, []);
  for (const metric of metrics) {
    if (!byDate.has(metric.date)) byDate.set(metric.date, []);
    byDate.get(metric.date).push(metric);
  }
  const legacyLoad = legacyLoadMap(runtimeState);
  const loadSeries = [...byDate.entries()].map(([date, day]) => {
    if (!day.length) {
      const legacy = legacyLoad.get(date);
      return { date, dateLabel: labelDate(date), value: legacy === 0 ? 0 : (legacy ?? 0), state: 'VERIFIED_ZERO', sessions: 0, provenance: legacy === 0 ? 'legacy-reconciled + no canonical sessions' : 'canonical session absence' };
    }
    const known = day.filter(row => row.nclAvailable);
    const missing = day.filter(row => !row.nclAvailable);
    if (!missing.length) {
      return { date, dateLabel: labelDate(date), value: round(known.reduce((sum,row)=>sum+row.ncl,0), 2), state: 'CANONICAL_DERIVED', sessions: day.length, provenance: 'Tredict HR-zone distribution' };
    }
    const legacy = legacyLoad.get(date);
    if (legacy !== undefined && legacy !== null && legacy !== 0) {
      return { date, dateLabel: labelDate(date), value: legacy, state: 'LEGACY_RECONCILED', sessions: day.length, provenance: 'retained reconciled historical load', missingDetailedSessions: missing.length };
    }
    return { date, dateLabel: labelDate(date), value: null, partialValue: known.length ? round(known.reduce((sum,row)=>sum+row.ncl,0),2) : null, state: 'PENDING_DETAIL', sessions: day.length, provenance: 'missing HR-zone detail', missingDetailedSessions: missing.length };
  });

  const history = Array.isArray(runtimeState?.datasets?.WELLNESS_HISTORY)
    ? runtimeState.datasets.WELLNESS_HISTORY.map(item => ({ ...item }))
    : [];
  if (evidence.wellness) {
    const currentDate = dateText(evidence.wellness.local_date);
    const idx = history.findIndex(item => item.date === currentDate);
    const current = {
      date: currentDate,
      dateLabel: labelDate(currentDate),
      status: 'LIVE / PARTIAL',
      provenance: 'canonical Neon wellness current',
      hrv: n(evidence.wellness.hrv_last_night),
      rhr: n(evidence.wellness.resting_heart_rate),
      sleepHours: n(evidence.wellness.sleep_hours),
      sleepScore: n(evidence.wellness.sleep_score),
      bodyBatteryHigh: n(evidence.wellness.body_battery_high),
      completedDaySteps: null,
      completedDayStress: null,
      completedDayActiveCalories: null,
      liveSteps: n(evidence.wellness.steps),
      liveStress: n(evidence.wellness.stress_avg),
      liveActiveCalories: n(evidence.wellness.active_calories),
      liveBodyBattery: n(evidence.wellness.body_battery_current),
      sourceAsOf: evidence.wellness.source_as_of
    };
    if (idx >= 0) history[idx] = { ...history[idx], ...current };
    else history.push(current);
  }
  history.sort((a,b) => String(a.date).localeCompare(String(b.date)));

  const detailCoverage = {
    totalSessions: metrics.length,
    detailedSessions: metrics.filter(row => row.detailLevel === 'activity-detail').length,
    nclSessions: metrics.filter(row => row.nclAvailable).length
  };
  const load28 = loadSeries.slice(-28);
  const quality = {
    detailCoverage,
    loadMissingDates: load28.filter(row => row.value === null).map(row => row.date),
    warnings: []
  };
  if (quality.loadMissingDates.length) quality.warnings.push('Some NCL days are pending Tredict HR-zone detail; missing is not rendered as zero.');
  if (excludedAet.length) quality.warnings.push('Non-comparable AET exposures are retained as context but excluded from the matched progression line.');

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    range: { startDate, endDate },
    provenance: {
      operationalTruth: 'Neon canonical training + Athlete Memory',
      historicalWellnessSeed: history.length ? 'runtime WELLNESS_HISTORY with current Neon overlay' : null,
      auditRepresentation: 'Google Drive is not queried by this runtime contract',
      runtimeStateId: runtime?.stateId || null,
      runtimeMasterAsOf: runtimeState?.masterAsOf || null
    },
    recovery: { wellnessHistory: history },
    load: {
      formula: 'low HR-zone minutes ×1 + moderate ×2 + high ×4',
      series: loadSeries,
      rolling7d: rolling(loadSeries, 7),
      rolling28d: rolling(loadSeries, 28)
    },
    performance: {
      matchedAet,
      excludedAet,
      runningRelationship: runs,
      latestMatchedAet: matchedAet.at(-1) || null
    },
    capabilities: Array.isArray(runtimeState?.datasets?.CAP) ? runtimeState.datasets.CAP : [],
    summaries: runtimeState?.renderContract?.trends || null,
    quality
  };
}

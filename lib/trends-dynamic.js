import { getSql } from './db.js';
import { buildCurrentTrends } from './trends-store.js';
import { deriveNcl, evidenceCoverage, evidenceSummary, heartRateIntensitySeconds, mergeEvidenceRows } from './training-evidence.js';
import { classifyTrainingSession } from './training-classifier.js';

const TZ = 'Africa/Johannesburg';

function n(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function labelDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00Z`));
}
function eventText(events = []) {
  return events.map(event => `${event.summary || ''} ${JSON.stringify(event.payload || {})}`).join(' ').toLowerCase();
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
function metricFromEvidence(session, merged, events, sources) {
  const payload = merged.payload || {};
  const summary = evidenceSummary(payload);
  const avgHeartRate = n(summary.heartrate ?? payload['summary.heartrate']);
  const avgPower = n(summary.power);
  const durationSeconds = n(summary.durationTotal ?? summary.duration ?? payload['summary.durationTotal'] ?? payload['summary.duration']);
  const distanceMeters = n(summary.distance ?? payload['summary.distance']);
  const classification = classifyTrainingSession({ session, events, sources });
  const sport = session.sport_type || payload.sportType || null;
  return {
    sessionId: session.session_id,
    date: dateText(session.local_date),
    title: classification.displayTitle || session.title || payload.title || null,
    sourceTitle: session.title || payload.title || null,
    sportType: sport,
    modality: classification.modality,
    modalityLabel: classification.modalityLabel,
    adaptiveIntent: classification.adaptiveIntent,
    classificationConfidence: classification.confidence,
    classificationBasis: classification.basis,
    sessionKind: session.session_kind || null,
    status: session.status,
    reconciliationState: session.reconciliation_state,
    sourceRecordId: merged.sourceRecordId || null,
    evidenceVersions: merged.versions || 0,
    evidenceEnrichedFromHistory: merged.enrichedFromHistory === true,
    evidenceCoverage: evidenceCoverage(payload),
    detailLevel: payload.detailLevel || 'activity-list',
    durationSeconds,
    durationMin: durationSeconds === null ? null : round(durationSeconds / 60, 2),
    distanceKm: distanceMeters === null ? null : round(distanceMeters / 1000, 3),
    paceSecPerKm: n(summary.pace),
    avgHeartRate,
    maxHeartRate: n(summary.heartrateMax),
    avgPower,
    powerHr: avgHeartRate && avgPower ? round(avgPower / avgHeartRate, 3) : null,
    runningEffectiveness: n(summary.runningEffectiveness),
    groundContactTimeMs: n(summary.groundContactTime),
    flightTimeMs: n(summary.flightTime),
    stepLengthCm: n(summary.stepLength),
    ascentM: n(summary?.altitude?.ascent),
    walkingDurationMin: n(summary.walkingDuration) === null ? null : round(n(summary.walkingDuration) / 60, 2),
    hrEffort: n(summary?.effort?.heartrate),
    hrDistributionSeconds: heartRateIntensitySeconds(payload),
    ncl: deriveNcl(payload),
    nclAvailable: deriveNcl(payload) !== null
  };
}
function aetClass(metric, events = []) {
  const isRunning = String(metric.sportType || '').toLowerCase().includes('run') || metric.modality === 'RUNNING';
  const text = eventText(events);
  const isAet = String(metric.sessionKind || '').toUpperCase() === 'AET' || /\baet\b/i.test(metric.sourceTitle || '') || /\b(run\s+)?aet\b/.test(text);
  if (!isRunning || !isAet) return null;
  if (metric.status === 'STOPPED_EARLY' || metric.status === 'ABORTED') {
    if (/\b(gi|stomach|abdominal|bloat|bloating|gastro|cramp)\b/.test(text) || (metric.durationSeconds !== null && metric.durationSeconds < 1800)) return 'NON_COMPARABLE';
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
function latestIso(values) {
  const valid = values.map(value => new Date(value).getTime()).filter(Number.isFinite);
  return valid.length ? new Date(Math.max(...valid)).toISOString() : null;
}

async function readMergedTrainingEvidence(startDate, endDate) {
  const sql = await getSql();
  const [sessions, sourceRows, events] = await Promise.all([
    sql`
      SELECT session_id,local_date::text AS local_date,actual_start_at,planned_start_at,title,sport_type,session_kind,status,reconciliation_state
      FROM fz_training_sessions
      WHERE local_date BETWEEN ${startDate} AND ${endDate} AND status <> 'SUPERSEDED'
      ORDER BY local_date,COALESCE(actual_start_at,planned_start_at),session_id
    `,
    sql`
      SELECT l.session_id,l.relationship,l.match_method,l.match_confidence,
             r.id AS source_record_pk,r.source_key,r.record_type,r.source_record_id,r.source_updated_at,r.local_date::text AS local_date,r.payload,r.ingested_at
      FROM fz_training_session_sources l
      JOIN fz_training_source_records r ON r.id=l.source_record_pk
      JOIN fz_training_sessions s ON s.session_id=l.session_id
      WHERE s.local_date BETWEEN ${startDate} AND ${endDate}
        AND s.status <> 'SUPERSEDED'
        AND l.relationship='EXECUTION'
      ORDER BY l.session_id,r.ingested_at DESC,r.id DESC
    `,
    sql`
      SELECT event_key,session_id,event_type,occurred_at,local_date::text AS local_date,actor,certainty,summary,payload
      FROM fz_athlete_events
      WHERE local_date BETWEEN ${startDate} AND ${endDate}
      ORDER BY occurred_at,event_id
    `
  ]);
  const sourcesBySession = new Map();
  for (const row of sourceRows) {
    if (!sourcesBySession.has(row.session_id)) sourcesBySession.set(row.session_id, []);
    sourcesBySession.get(row.session_id).push(row);
  }
  const eventsBySession = new Map();
  for (const event of events) {
    if (!event.session_id) continue;
    if (!eventsBySession.has(event.session_id)) eventsBySession.set(event.session_id, []);
    eventsBySession.get(event.session_id).push(event);
  }
  const metrics = sessions.map(session => {
    const sources = sourcesBySession.get(session.session_id) || [];
    const tredict = sources.filter(row => row.source_key === 'tredict' && row.record_type === 'executed_activity');
    const merged = mergeEvidenceRows(tredict);
    merged.sourceRecordId = tredict[0]?.source_record_id || null;
    return metricFromEvidence(session, merged, eventsBySession.get(session.session_id) || [], sources);
  });
  return { sessions, sourceRows, events, eventsBySession, metrics };
}

function dynamicLoad(baseSeries, metrics, startDate, endDate) {
  const baseByDate = new Map((baseSeries || []).map(point => [point.date, point]));
  const byDate = new Map();
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) byDate.set(date, []);
  for (const metric of metrics) {
    if (!byDate.has(metric.date)) byDate.set(metric.date, []);
    byDate.get(metric.date).push(metric);
  }
  return [...byDate.entries()].map(([date, day]) => {
    const prior = baseByDate.get(date) || null;
    if (!day.length) return prior || { date, dateLabel: labelDate(date), value: 0, state: 'VERIFIED_ZERO', sessions: 0, provenance: 'canonical session absence' };
    const known = day.filter(row => row.nclAvailable);
    const missing = day.filter(row => !row.nclAvailable);
    if (!missing.length) {
      return { date, dateLabel: labelDate(date), value: round(known.reduce((sum, row) => sum + row.ncl, 0), 2), state: 'CANONICAL_BEST_EVIDENCE', sessions: day.length, provenance: 'Tredict HR-zone distribution · monotonic best-available evidence', enrichedSessions: day.filter(row => row.evidenceEnrichedFromHistory).length };
    }
    const validatedPrior = prior && prior.value !== null && /HISTORICAL|LEGACY_RECONCILED/.test(String(prior.state || ''));
    if (validatedPrior) return { ...prior, sessions: day.length, missingDetailedSessions: missing.length, evidencePolicy: 'MONOTONIC_BEST_AVAILABLE' };
    return { date, dateLabel: labelDate(date), value: null, partialValue: known.length ? round(known.reduce((sum, row) => sum + row.ncl, 0), 2) : null, state: 'PENDING_DETAIL', sessions: day.length, provenance: 'canonical workout exists; HR-zone detail not yet available', missingDetailedSessions: missing.length };
  });
}

export async function buildDynamicCurrentTrends({ days = 45 } = {}) {
  const boundedDays = Math.max(28, Math.min(90, Number(days) || 45));
  const endDate = todayLocal();
  const startDate = addDays(endDate, -(boundedDays - 1));
  const [base, evidence] = await Promise.all([buildCurrentTrends({ days: boundedDays }), readMergedTrainingEvidence(startDate, endDate)]);
  const aets = [], runs = [];
  for (const metric of evidence.metrics) {
    const comparison = aetClass(metric, evidence.eventsBySession.get(metric.sessionId) || []);
    if (comparison) aets.push({ ...metric, comparison });
    const isRunning = String(metric.sportType || '').toLowerCase().includes('run') || metric.modality === 'RUNNING';
    if (isRunning && metric.paceSecPerKm !== null && metric.avgPower !== null) runs.push({ ...metric, comparisonClass: runningClass(metric, comparison) });
  }
  aets.sort((a,b)=>a.date.localeCompare(b.date)); runs.sort((a,b)=>a.date.localeCompare(b.date));
  const matchedAet=aets.filter(row=>['MATCHED','MATCHED_CAVEAT'].includes(row.comparison)&&row.powerHr!==null),excludedAet=aets.filter(row=>!['MATCHED','MATCHED_CAVEAT'].includes(row.comparison));
  const loadSeries=dynamicLoad(base.load?.series||[],evidence.metrics,startDate,endDate),load28=loadSeries.slice(-28),intentRows=evidence.metrics.filter(row=>row.classificationConfidence!=='LOW'),intentCounts=Object.fromEntries(['ABSORB','MAINTAIN','ADAPT'].map(lane=>[lane,intentRows.filter(row=>row.adaptiveIntent===lane).length])),mergedSessions=evidence.metrics.filter(row=>row.evidenceVersions>1).length,enrichedSessions=evidence.metrics.filter(row=>row.evidenceEnrichedFromHistory).length,latestSourceEvidenceAt=latestIso(evidence.sourceRows.map(row=>row.ingested_at));
  const quality={...(base.quality||{}),evidencePolicy:'MONOTONIC_BEST_AVAILABLE',expectedMatchedAetDates:undefined,expectedMatchedAetMissing:undefined,loadMissingDates:load28.filter(row=>row.value===null).map(row=>row.date),matchedAetCount:matchedAet.length,latestMatchedAetDate:matchedAet.at(-1)?.date||null,excludedAetCount:excludedAet.length,mergedSourceSessions:mergedSessions,historicallyEnrichedSessions:enrichedSessions,lowConfidenceTrainingIdentities:evidence.metrics.filter(row=>row.classificationConfidence==='LOW').length,warnings:[...(base.quality?.warnings||[]).filter(message=>!/Matched AET history is incomplete/i.test(message)&&!/NCL days are pending/i.test(message)),...(load28.some(row=>row.value===null)?['Some NCL days are pending source detail; a workout day is never represented as zero because detail is missing.']:[]),...(enrichedSessions?[`${enrichedSessions} session(s) use older richer evidence to fill gaps in newer source payloads.`]:[])]};
  return {...base,generatedAt:new Date().toISOString(),range:{startDate,endDate},provenance:{...(base.provenance||{}),operationalTruth:'Neon canonical training + Athlete Memory',trainingEvidencePolicy:'Monotonic best available: newest evidence wins; richer historical fields fill only missing values',auditRepresentation:'Google Drive is not queried by this runtime contract'},freshness:{contractGeneratedAt:new Date().toISOString(),latestTrainingEvidenceAt:latestSourceEvidenceAt,mode:'DYNAMIC_CANONICAL_READ',sourceRefreshOwner:'training auto-sync; no shell deployment'},load:{formula:'low HR-zone minutes ×1 + moderate ×2 + high ×4',series:loadSeries,rolling7d:rolling(loadSeries,7),rolling28d:rolling(loadSeries,28)},performance:{matchedAet,excludedAet,runningRelationship:runs,latestMatchedAet:matchedAet.at(-1)||null},trainingIntent:{classificationVersion:'1.0.0',counts:intentCounts,sessions:evidence.metrics.map(row=>({sessionId:row.sessionId,date:row.date,title:row.title,modality:row.modality,lane:row.adaptiveIntent,confidence:row.classificationConfidence,basis:row.classificationBasis}))},quality};
}

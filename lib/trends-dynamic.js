import { getSql } from './db.js';
import { buildCurrentTrends } from './trends-store.js';
import { deriveNcl, evidenceCoverage, evidenceSummary, heartRateIntensitySeconds, mergeEvidenceRows } from './training-evidence.js';
import { classifyTrainingSession } from './training-classifier.js';
import { deriveTrainingWorkoutDetail } from './training-workout-detail.js';

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
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0,10);
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
  return { days, value: missing.length ? null : round(tail.reduce((sum, point) => sum + Number(point.value || 0), 0), 2), missingDates: missing };
}
function metricFromEvidence(session, merged, events, sources) {
  const payload = merged.payload || {};
  const summary = evidenceSummary(payload);
  const workoutDetail = deriveTrainingWorkoutDetail(payload);
  const strengthSets = workoutDetail?.strength?.sets || [];
  const strengthReps = strengthSets.map(set => n(set.reps)).filter(value => value !== null);
  const strengthExercises = [...new Set(strengthSets.map(set => set.exerciseLabel).filter(Boolean))];
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
    nclAvailable: deriveNcl(payload) !== null,
    strengthSetCount: strengthSets.length ? n(workoutDetail?.strength?.setCount) ?? strengthSets.length : null,
    strengthRepCount: strengthReps.length ? strengthReps.reduce((sum, value) => sum + value, 0) : null,
    strengthRepsKnownSets: strengthReps.length,
    strengthExerciseCount: strengthExercises.length || null,
    strengthExercises
  };
}
function aetClass(metric, events = []) {
  const isRunning = String(metric.sportType || '').toLowerCase().includes('run') || metric.modality === 'RUNNING' || metric.modality === 'HYROX_MIXED';
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
  if (metric.modality === 'HYROX_MIXED') return 'HYROX_COMPROMISED_CONTEXT';
  return 'CONTEXTUAL_RUN';
}
function latestIso(values) {
  const valid = values.map(value => new Date(value).getTime()).filter(Number.isFinite);
  return valid.length ? new Date(Math.max(...valid)).toISOString() : null;
}
function fmt(value, digits = 0) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : null;
}
function deriveCurrentSummaries({ base, metrics, matchedAet, runs, loadSeries, endDate }) {
  const history = base.recovery?.wellnessHistory || [];
  const latestWellness = history.at(-1) || null;
  const latestExecution = metrics.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1) || null;
  const latestRun = runs.at(-1) || null;
  const latestMatched = matchedAet.at(-1) || null;
  const roll7 = rolling(loadSeries, 7);
  const roll28 = rolling(loadSeries, 28);

  const recoveryBits = [];
  if (latestWellness?.sleepHours !== null && latestWellness?.sleepHours !== undefined) recoveryBits.push(`${fmt(latestWellness.sleepHours,2)} h sleep`);
  if (latestWellness?.sleepScore !== null && latestWellness?.sleepScore !== undefined) recoveryBits.push(`sleep score ${fmt(latestWellness.sleepScore)}`);
  if (latestWellness?.hrv !== null && latestWellness?.hrv !== undefined) recoveryBits.push(`HRV ${fmt(latestWellness.hrv)}`);
  if (latestWellness?.rhr !== null && latestWellness?.rhr !== undefined) recoveryBits.push(`RHR ${fmt(latestWellness.rhr)}`);
  const recovery = latestWellness
    ? `${labelDate(latestWellness.date)} is the latest canonical recovery anchor${recoveryBits.length ? `: ${recoveryBits.join(', ')}` : ''}. This is read alongside the latest executed training rather than a historical runtime summary.`
    : 'Current canonical wellness history is unavailable, so recovery direction is withheld rather than copied from an older runtime snapshot.';

  let performance = 'No qualified running benchmark is currently available.';
  if (latestMatched) {
    performance = `Matched Run AET remains anchored at ${labelDate(latestMatched.date)}${latestMatched.powerHr !== null ? ` (P/HR ${fmt(latestMatched.powerHr,3)})` : ''}.`;
    if (latestRun && latestRun.date > latestMatched.date) performance += ` Newer running evidence through ${labelDate(latestRun.date)} is retained as ${String(latestRun.comparisonClass || 'contextual').replaceAll('_',' ').toLowerCase()} rather than being silently folded into the matched AET line.`;
  } else if (latestRun) {
    performance = `The latest canonical running exposure is ${labelDate(latestRun.date)}. It remains contextual until it satisfies a standardized comparison contract.`;
  }

  const missingLoad = loadSeries.slice(-28).filter(row => row.value === null).length;
  const exposure = roll7.value !== null && roll28.value !== null
    ? `Executed training through ${labelDate(latestExecution?.date || endDate)} produces rolling NCL of ${fmt(roll7.value,2)} over 7 days and ${fmt(roll28.value,2)} over 28 days. Planned or merely accepted sessions are excluded from historical exposure.`
    : `Executed training is current through ${labelDate(latestExecution?.date || endDate)}, but ${missingLoad} recent load day${missingLoad===1?' is':'s are'} still awaiting sufficient HR-zone detail. Planned or merely accepted sessions are excluded from historical exposure.`;

  const trajectory = latestExecution
    ? `Current direction is based on executed evidence through ${labelDate(latestExecution.date)}, with the matched running benchmark kept separate from newer hybrid and contextual work. Capability status is resolved from current measurement evidence rather than the retired runtime CAP snapshot.`
    : 'No recent executed training is available for a current trajectory statement; FZ does not reuse an older narrative as if it were current.';

  return { recovery, performance, exposure, trajectory };
}

async function readMergedTrainingEvidence(startDate, endDate) {
  const sql = await getSql();
  const [sessions, sourceRows, events] = await Promise.all([
    sql`
      SELECT session_id,local_date::text AS local_date,actual_start_at,planned_start_at,title,sport_type,session_kind,status,reconciliation_state
      FROM fz_training_sessions
      WHERE local_date BETWEEN ${startDate} AND ${endDate}
        AND status NOT IN ('PLANNED','ACCEPTED','SUPERSEDED','SKIPPED')
        AND (actual_start_at IS NOT NULL OR EXISTS (
          SELECT 1 FROM fz_training_session_sources lx
          WHERE lx.session_id=fz_training_sessions.session_id AND lx.relationship='EXECUTION'
        ))
      ORDER BY local_date,actual_start_at,session_id
    `,
    sql`
      SELECT l.session_id,l.relationship,l.match_method,l.match_confidence,
             r.id AS source_record_pk,r.source_key,r.record_type,r.source_record_id,r.source_updated_at,r.local_date::text AS local_date,r.payload,r.ingested_at
      FROM fz_training_session_sources l
      JOIN fz_training_source_records r ON r.id=l.source_record_pk
      JOIN fz_training_sessions s ON s.session_id=l.session_id
      WHERE s.local_date BETWEEN ${startDate} AND ${endDate}
        AND s.status NOT IN ('PLANNED','ACCEPTED','SUPERSEDED','SKIPPED')
        AND (s.actual_start_at IS NOT NULL OR l.relationship='EXECUTION')
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
    if (!day.length) return prior || { date, dateLabel: labelDate(date), value: 0, state: 'VERIFIED_ZERO', sessions: 0, provenance: 'canonical execution absence' };
    const known = day.filter(row => row.nclAvailable);
    const missing = day.filter(row => !row.nclAvailable);
    if (!missing.length) return { date, dateLabel: labelDate(date), value: round(known.reduce((sum, row) => sum + row.ncl, 0), 2), state: 'CANONICAL_BEST_EVIDENCE', sessions: day.length, provenance: 'Tredict HR-zone distribution · monotonic best-available evidence', enrichedSessions: day.filter(row => row.evidenceEnrichedFromHistory).length };
    const validatedPrior = prior && prior.value !== null && /HISTORICAL|LEGACY_RECONCILED/.test(String(prior.state || ''));
    if (validatedPrior) return { ...prior, sessions: day.length, missingDetailedSessions: missing.length, evidencePolicy: 'MONOTONIC_BEST_AVAILABLE' };
    return { date, dateLabel: labelDate(date), value: null, partialValue: known.length ? round(known.reduce((sum, row) => sum + row.ncl, 0), 2) : null, state: 'PENDING_DETAIL', sessions: day.length, provenance: 'canonical execution exists; HR-zone detail not yet available', missingDetailedSessions: missing.length };
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
    const isRunning = String(metric.sportType || '').toLowerCase().includes('run') || metric.modality === 'RUNNING' || metric.modality === 'HYROX_MIXED';
    if (isRunning && metric.paceSecPerKm !== null && metric.avgPower !== null) runs.push({ ...metric, comparisonClass: runningClass(metric, comparison) });
  }
  aets.sort((a,b)=>a.date.localeCompare(b.date));
  runs.sort((a,b)=>a.date.localeCompare(b.date));
  const matchedAet = aets.filter(row=>['MATCHED','MATCHED_CAVEAT'].includes(row.comparison)&&row.powerHr!==null);
  const excludedAet = aets.filter(row=>!['MATCHED','MATCHED_CAVEAT'].includes(row.comparison));
  const loadSeries = dynamicLoad(base.load?.series||[],evidence.metrics,startDate,endDate);
  const load28 = loadSeries.slice(-28);
  const intentRows = evidence.metrics.filter(row=>row.classificationConfidence!=='LOW');
  const intentCounts = Object.fromEntries(['ABSORB','MAINTAIN','ADAPT'].map(lane=>[lane,intentRows.filter(row=>row.adaptiveIntent===lane).length]));
  const mergedSessions = evidence.metrics.filter(row=>row.evidenceVersions>1).length;
  const enrichedSessions = evidence.metrics.filter(row=>row.evidenceEnrichedFromHistory).length;
  const latestSourceEvidenceAt = latestIso(evidence.sourceRows.map(row=>row.ingested_at));
  const summaries = deriveCurrentSummaries({base,metrics:evidence.metrics,matchedAet,runs,loadSeries,endDate});
  const quality={
    ...(base.quality||{}),
    evidencePolicy:'MONOTONIC_BEST_AVAILABLE',
    expectedMatchedAetDates:undefined,
    expectedMatchedAetMissing:undefined,
    loadMissingDates:load28.filter(row=>row.value===null).map(row=>row.date),
    matchedAetCount:matchedAet.length,
    latestMatchedAetDate:matchedAet.at(-1)?.date||null,
    excludedAetCount:excludedAet.length,
    mergedSourceSessions:mergedSessions,
    historicallyEnrichedSessions:enrichedSessions,
    lowConfidenceTrainingIdentities:evidence.metrics.filter(row=>row.classificationConfidence==='LOW').length,
    warnings:[
      ...(base.quality?.warnings||[]).filter(message=>!/Matched AET history is incomplete/i.test(message)&&!/NCL days are pending/i.test(message)),
      ...(load28.some(row=>row.value===null)?['Some NCL days are pending source detail; an executed workout day is never represented as zero because detail is missing.']:[]),
      ...(enrichedSessions?[`${enrichedSessions} session(s) use older richer evidence to fill gaps in newer source payloads.`]:[])
    ]
  };
  const exposureSessions=evidence.metrics.map(row=>({
    sessionId:row.sessionId,date:row.date,title:row.title,status:row.status,
    modality:row.modality,modalityLabel:row.modalityLabel,adaptiveIntent:row.adaptiveIntent,
    classificationConfidence:row.classificationConfidence,
    durationMin:row.durationMin,distanceKm:row.distanceKm,
    hrDistributionSeconds:row.hrDistributionSeconds,ncl:row.ncl,nclAvailable:row.nclAvailable,
    strengthSetCount:row.strengthSetCount,strengthRepCount:row.strengthRepCount,
    strengthRepsKnownSets:row.strengthRepsKnownSets,strengthExerciseCount:row.strengthExerciseCount,
    strengthExercises:row.strengthExercises
  }));
  const exposureCoverage={
    sessions:exposureSessions.length,
    durationKnown:exposureSessions.filter(row=>row.durationMin!==null).length,
    nclKnown:exposureSessions.filter(row=>row.nclAvailable).length,
    distanceKnown:exposureSessions.filter(row=>row.distanceKm!==null).length,
    strengthDetailSessions:exposureSessions.filter(row=>row.strengthSetCount!==null).length
  };
  return {
    ...base,
    generatedAt:new Date().toISOString(),
    range:{startDate,endDate},
    summaries,
    provenance:{
      ...(base.provenance||{}),
      operationalTruth:'Neon canonical training + Athlete Memory + wellness history',
      trainingEvidencePolicy:'Monotonic best available: newest evidence wins; richer historical fields fill only missing values',
      summaryPolicy:'Derived on read from current canonical evidence; runtime narrative snapshots are not current truth',
      auditRepresentation:'Google Drive is not queried by this runtime contract'
    },
    freshness:{contractGeneratedAt:new Date().toISOString(),latestTrainingEvidenceAt:latestSourceEvidenceAt,mode:'DYNAMIC_CANONICAL_READ',sourceRefreshOwner:'training auto-sync; no shell deployment'},
    load:{formula:'low HR-zone minutes ×1 + moderate ×2 + high ×4',series:loadSeries,rolling7d:rolling(loadSeries,7),rolling28d:rolling(loadSeries,28)},
    performance:{matchedAet,excludedAet,runningRelationship:runs,latestMatchedAet:matchedAet.at(-1)||null},
    trainingIntent:{classificationVersion:'1.0.1',counts:intentCounts,sessions:evidence.metrics.map(row=>({sessionId:row.sessionId,date:row.date,title:row.title,modality:row.modality,lane:row.adaptiveIntent,confidence:row.classificationConfidence,basis:row.classificationBasis}))},
    trainingExposure:{schemaVersion:'1.1',source:'CANONICAL_EXECUTION_EVIDENCE',loadFormula:'low HR-zone minutes ×1 + moderate ×2 + high ×4',rules:{missingIsNotZero:true,noCrossModalitySyntheticVolume:true,nclRequiresHrZoneEvidence:true,plannedAndAcceptedSessionsExcluded:true},coverage:exposureCoverage,sessions:exposureSessions},
    quality
  };
}

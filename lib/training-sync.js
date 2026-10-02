import { callFitnessAiTool, parseFitnessAiToolResult } from './fitness-ai-client.js';
import { getSql } from './db.js';
import { fetchIntervalsActivityRange, intervalsIcuConfigured, normalizeIntervalsActivityRecord } from './intervals-icu-client.js';
import { callTredictTool, markTredictSourceError, markTredictSourceSynced, parseTredictCsvResult, tredictConfigured } from './tredict-client.js';
import {
  appendAthleteEvent,
  findSessionsBySourceRecord,
  ingestTrainingSourceRecord,
  linkTrainingSource,
  setTrainingSessionState,
  upsertTrainingSession
} from './training-store.js';

const TZ = 'Africa/Johannesburg';

function localDateOf(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function num(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sessionKind(title = '', notes = '') {
  const text = `${title} ${notes}`.toUpperCase();
  for (const key of ['AET', 'CPH', 'Z2', 'HYROX', 'LONG RUN', 'RECOVERY']) {
    if (text.includes(key)) return key.replace(' ', '_');
  }
  return null;
}

function sportCompatible(a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  if (!x || !y) return true;
  if (x === y) return true;
  if (x === 'misc' || y === 'misc') return false;
  return x.includes(y) || y.includes(x);
}

function activityArray(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['activities', 'activity_list', 'items', 'data']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function garminId(activity) {
  return String(activity.activity_id ?? activity.activityId ?? activity.id ?? '').trim();
}

function garminStart(activity) {
  return activity.start_time_utc || activity.startTimeUtc || activity.start_time || activity.startTime || activity.date || null;
}

function garminDuration(activity) {
  return num(activity.duration_s ?? activity.durationSeconds ?? activity.duration ?? activity.elapsed_time_s);
}

function garminSport(activity) {
  return String(activity.activity_type || activity.activityType || activity.type || activity.sport || '').toLowerCase();
}

function candidateMatch(candidate, { localDate, startMs, duration, sport }) {
  if (candidate.localDate !== localDate) return null;
  const candidateStartMs = new Date(candidate.startAt).getTime();
  if (!Number.isFinite(candidateStartMs) || !Number.isFinite(startMs)) return null;
  const deltaMs = Math.abs(candidateStartMs - startMs);

  let durationRatio = null;
  if (duration && candidate.durationSeconds) {
    durationRatio = Math.abs(duration - candidate.durationSeconds) / Math.max(duration, candidate.durationSeconds);
  }

  if (sportCompatible(candidate.sportType, sport)) {
    if (deltaMs > 180000) return null;
    if (durationRatio != null && durationRatio > 0.2) return null;
    return {
      candidate,
      method: 'AUTO_TIME_SPORT_DURATION',
      confidence: 0.95,
      deltaMs,
      durationRatio
    };
  }

  const crossSportExact =
    duration != null &&
    candidate.durationSeconds != null &&
    deltaMs <= 10000 &&
    durationRatio != null &&
    durationRatio <= 0.05;
  if (!crossSportExact) return null;

  return {
    candidate,
    method: 'AUTO_TIME_DURATION_CROSS_SPORT',
    confidence: 0.9,
    deltaMs,
    durationRatio
  };
}

function compactTredictDetail(detail, fallback) {
  if (!detail || typeof detail !== 'object') return fallback;
  const summary = detail.summary && typeof detail.summary === 'object' ? detail.summary : fallback.summary || {};
  return {
    id: String(detail._id || detail.id || fallback.id || ''),
    date: detail.date || fallback.date || null,
    createdAt: detail.createdAt || fallback.createdAt || null,
    trainingType: detail.trainingType || fallback.trainingType || null,
    sportType: detail.sportType || fallback.sportType || null,
    subSportType: detail.subSportType || fallback.subSportType || null,
    title: detail.title || fallback.title || '',
    notes: detail.notes || fallback.notes || '',
    timezone: detail.timezone || fallback.timezone || null,
    summary,
    currentCapacities: detail.currentCapacities || null,
    currentZones: detail.currentZones || null,
    detailLevel: 'activity-detail',
    'summary.durationTotal': summary.durationTotal ?? fallback['summary.durationTotal'] ?? '',
    'summary.duration': summary.duration ?? fallback['summary.duration'] ?? '',
    'summary.distance': summary.distance ?? fallback['summary.distance'] ?? '',
    'summary.heartrate': summary.heartrate ?? fallback['summary.heartrate'] ?? ''
  };
}

async function enrichTredictActivity(activity) {
  try {
    const result = await callTredictTool('activity-detail', { activityId: activity.id });
    return compactTredictDetail(result?.structuredContent, activity);
  } catch (error) {
    return { ...activity, detailLevel: 'activity-list', detailWarning: error instanceof Error ? error.message : String(error) };
  }
}

async function ingestTredict(startDate, endDate) {
  if (!tredictConfigured()) return { configured: false, plans: 0, activities: 0, detailed: 0, executions: [] };

  const startIso = `${startDate}T00:00:00Z`;
  const endIso = `${endDate}T23:59:59Z`;
  const [plansResult, activitiesResult] = await Promise.all([
    callTredictTool('planned-workout-list', { startDate: startIso, endDate: endIso }),
    callTredictTool('activity-list', { startDate: endIso, endDate: startIso, pageSize: 200, extendedSummary: 1 })
  ]);

  const plans = parseTredictCsvResult(plansResult);
  const activities = parseTredictCsvResult(activitiesResult);
  const planByExecution = new Map();
  let plansInRange = 0;

  for (const plan of plans) {
    if (!plan.id || !plan.date) continue;
    const localDate = localDateOf(plan.date);
    if (!localDate || localDate < startDate || localDate > endDate) continue;
    plansInRange += 1;
    const record = await ingestTrainingSourceRecord({
      sourceKey: 'tredict',
      recordType: 'planned_workout',
      sourceRecordId: String(plan.id),
      sourceUpdatedAt: plan.updatedAt || null,
      localDate,
      payload: plan
    });
    const sessionId = `plan:tredict:${plan.id}`;
    await upsertTrainingSession({
      sessionId,
      localDate,
      plannedStartAt: plan.date,
      title: plan.title || null,
      sportType: plan.sportType || null,
      sessionKind: sessionKind(plan.title, plan.notes),
      status: 'PLANNED',
      reconciliationState: plan.executedTrainingId ? 'MATCHED' : 'UNMATCHED'
    });
    await linkTrainingSource({ sessionId, sourceRecordPk: record.id, relationship: 'PLAN' });
    await appendAthleteEvent({
      eventKey: `tredict:plan:${plan.id}:PLANNED`,
      sessionId,
      eventType: 'PLANNED',
      occurredAt: plan.date,
      localDate,
      actor: 'TREDICT',
      sourceKey: 'tredict',
      sourceRecordPk: record.id,
      certainty: 'OBSERVED',
      summary: plan.title ? `Planned in Tredict: ${plan.title}` : 'Planned workout observed in Tredict',
      payload: { sourceWorkoutId: plan.id }
    });
    if (plan.executedTrainingId) planByExecution.set(String(plan.executedTrainingId), sessionId);
  }

  const executions = [];
  let detailed = 0;
  for (const activity of activities) {
    if (!activity.id || !activity.date) continue;
    const localDate = localDateOf(activity.date);
    if (!localDate || localDate < startDate || localDate > endDate) continue;

    const enriched = await enrichTredictActivity(activity);
    if (enriched.detailLevel === 'activity-detail') detailed += 1;
    const record = await ingestTrainingSourceRecord({
      sourceKey: 'tredict',
      recordType: 'executed_activity',
      sourceRecordId: String(activity.id),
      sourceUpdatedAt: activity.createdAt || null,
      localDate,
      payload: enriched
    });
    const nativePlanSession = planByExecution.get(String(activity.id));
    const sessionId = nativePlanSession || `exec:tredict:${activity.id}`;
    await upsertTrainingSession({
      sessionId,
      localDate,
      actualStartAt: activity.date,
      title: enriched.title || null,
      sportType: enriched.sportType || null,
      sessionKind: sessionKind(enriched.title, enriched.notes),
      status: 'COMPLETED',
      reconciliationState: nativePlanSession ? 'MATCHED' : 'UNMATCHED'
    });
    await linkTrainingSource({
      sessionId,
      sourceRecordPk: record.id,
      relationship: 'EXECUTION',
      matchMethod: nativePlanSession ? 'TREDICT_EXECUTED_TRAINING_ID' : 'SOURCE_NATIVE',
      matchConfidence: nativePlanSession ? 1 : null
    });
    await appendAthleteEvent({
      eventKey: `tredict:activity:${activity.id}:EXECUTED`,
      sessionId,
      eventType: 'EXECUTED',
      occurredAt: activity.date,
      localDate,
      actor: 'TREDICT',
      sourceKey: 'tredict',
      sourceRecordPk: record.id,
      certainty: 'OBSERVED',
      summary: enriched.title ? `Executed activity in Tredict: ${enriched.title}` : 'Executed activity observed in Tredict',
      payload: {
        durationSeconds: num(enriched['summary.durationTotal'] || enriched['summary.duration']),
        distanceMeters: num(enriched['summary.distance']),
        averageHeartRate: num(enriched['summary.heartrate']),
        detailLevel: enriched.detailLevel
      }
    });
    executions.push({
      id: String(activity.id),
      sessionId,
      localDate,
      startAt: activity.date,
      sportType: enriched.sportType || null,
      durationSeconds: num(enriched['summary.durationTotal'] || enriched['summary.duration'])
    });
  }

  return { configured: true, plans: plansInRange, activities: executions.length, detailed, executions };
}

async function loadExistingTredictExecutions(startDate, endDate) {
  const sql = await getSql();
  const rows = await sql`
    SELECT
      s.session_id,
      s.local_date::text AS local_date,
      s.actual_start_at,
      COALESCE(r.payload->>'sportType', s.sport_type) AS sport_type,
      r.source_record_id AS tredict_activity_id,
      COALESCE(
        NULLIF(r.payload#>>'{summary,durationTotal}','')::numeric,
        NULLIF(r.payload#>>'{summary,duration}','')::numeric,
        NULLIF(r.payload->>'summary.durationTotal','')::numeric,
        NULLIF(r.payload->>'summary.duration','')::numeric
      ) AS duration_seconds
    FROM fz_training_sessions s
    JOIN LATERAL (
      SELECT sr.source_record_id,sr.payload
      FROM fz_training_session_sources l
      JOIN fz_training_source_records sr ON sr.id=l.source_record_pk
      WHERE l.session_id=s.session_id
        AND l.relationship='EXECUTION'
        AND sr.source_key='tredict'
        AND sr.record_type='executed_activity'
      ORDER BY sr.ingested_at DESC,sr.id DESC
      LIMIT 1
    ) r ON true
    WHERE s.local_date BETWEEN ${startDate}::date AND ${endDate}::date
      AND s.actual_start_at IS NOT NULL
      AND s.status <> 'SUPERSEDED'
  `;
  return (rows||[]).map(row=>({
    id:String(row.tredict_activity_id||''),
    sessionId:row.session_id,
    localDate:String(row.local_date||'').slice(0,10),
    startAt:row.actual_start_at instanceof Date ? row.actual_start_at.toISOString() : String(row.actual_start_at||''),
    sportType:row.sport_type||null,
    durationSeconds:num(row.duration_seconds)
  })).filter(item=>item.id&&item.sessionId&&item.localDate&&item.startAt);
}

function mergeExecutionCandidates(...groups) {
  const bySession=new Map();
  for(const group of groups){
    for(const item of group||[]){
      if(!item?.sessionId)continue;
      bySession.set(item.sessionId,item);
    }
  }
  return [...bySession.values()];
}

async function ingestIntervalsActivities(startDate, endDate, tredictExecutions) {
  if (!intervalsIcuConfigured()) return { configured: false, activities: 0, matched: 0, unmatched: 0, superseded: 0, skipped: 0, warnings: [] };
  const records = await fetchIntervalsActivityRange({ oldest: startDate, newest: endDate });
  let matched = 0;
  let unmatched = 0;
  let superseded = 0;
  let skipped = 0;
  const warnings = [];

  for (const raw of records) {
    let activity;
    try {
      activity = normalizeIntervalsActivityRecord(raw);
    } catch (error) {
      skipped += 1;
      warnings.push(`Intervals.icu activity skipped: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const { id: sourceId, startAt, localDate, durationSeconds: duration, sportType: sport } = activity;
    if (!localDate || localDate < startDate || localDate > endDate) continue;

    const sourceRecord = await ingestTrainingSourceRecord({
      sourceKey: 'intervals-icu',
      recordType: 'executed_activity',
      sourceRecordId: sourceId,
      sourceUpdatedAt: activity.sourceUpdatedAt,
      localDate,
      payload: activity.payload
    });
    const previouslyLinkedSessions = await findSessionsBySourceRecord(sourceRecord.id);

    const startMs = new Date(startAt).getTime();
    const matches = tredictExecutions
      .map(candidate => candidateMatch(candidate, { localDate, startMs, duration, sport }))
      .filter(Boolean);
    const uniqueMatches = new Map();
    for (const match of matches) uniqueMatches.set(match.candidate.sessionId, match);
    const candidates = [...uniqueMatches.values()];

    let sessionId;
    let reconciliationState;
    let matchedCandidate = null;
    if (candidates.length === 1) {
      matchedCandidate = candidates[0];
      sessionId = matchedCandidate.candidate.sessionId;
      reconciliationState = 'MATCHED';
      matched += 1;
    } else {
      sessionId = `exec:intervals-icu:${sourceId}`;
      reconciliationState = candidates.length > 1 ? 'MATCH_REQUIRED' : 'UNMATCHED';
      unmatched += 1;
    }

    await upsertTrainingSession({
      sessionId,
      localDate,
      actualStartAt: startAt,
      title: activity.title,
      sportType: sport,
      sessionKind: sessionKind(activity.title, raw?.description || raw?.notes || ''),
      status: 'COMPLETED',
      reconciliationState
    });
    await linkTrainingSource({
      sessionId,
      sourceRecordPk: sourceRecord.id,
      relationship: 'EXECUTION',
      matchMethod: matchedCandidate?.method || 'SOURCE_NATIVE',
      matchConfidence: matchedCandidate?.confidence ?? null
    });
    await appendAthleteEvent({
      eventKey: `intervals-icu:activity:${sourceId}:EXECUTED`,
      sessionId,
      eventType: 'EXECUTED',
      occurredAt: startAt,
      localDate,
      actor: 'SYSTEM',
      sourceKey: 'intervals-icu',
      sourceRecordPk: sourceRecord.id,
      certainty: 'OBSERVED',
      summary: activity.title ? `Executed activity observed through Intervals.icu: ${activity.title}` : 'Executed activity observed through Intervals.icu',
      payload: {
        transport: 'INTERVALS_ICU',
        upstreamSource: activity.source || null,
        durationSeconds: duration,
        distanceMeters: activity.payload.distance_m ?? null,
        averageHeartRate: activity.payload.avg_hr ?? null,
        maxHeartRate: activity.payload.max_hr ?? null
      }
    });

    if (matchedCandidate) {
      const candidate = matchedCandidate.candidate;
      await setTrainingSessionState(sessionId, { reconciliationState: 'MATCHED' });

      for (const previous of previouslyLinkedSessions) {
        if (previous.session_id === sessionId || previous.status === 'SUPERSEDED') continue;
        await setTrainingSessionState(previous.session_id, {
          status: 'SUPERSEDED',
          reconciliationState: 'MATCHED',
          parentSessionId: sessionId
        });
        await appendAthleteEvent({
          eventKey: `supersede:intervals-icu:${sourceId}:${previous.session_id}:${sessionId}`,
          sessionId: previous.session_id,
          eventType: 'LINKED',
          occurredAt: new Date().toISOString(),
          localDate,
          actor: 'SYSTEM',
          sourceKey: 'fz',
          certainty: 'INFERRED',
          summary: 'Prior Intervals.icu-only session superseded by the reconciled canonical session',
          payload: { canonicalSessionId: sessionId, sourceRecordId: sourceId, method: matchedCandidate.method }
        });
        superseded += 1;
      }

      await appendAthleteEvent({
        eventKey: `reconcile:tredict:${candidate.id}:intervals-icu:${sourceId}`,
        sessionId,
        eventType: 'RECONCILED',
        occurredAt: new Date().toISOString(),
        localDate,
        actor: 'SYSTEM',
        sourceKey: 'fz',
        certainty: 'INFERRED',
        summary: matchedCandidate.method === 'AUTO_TIME_DURATION_CROSS_SPORT'
          ? 'Tredict and Intervals.icu execution records reconciled by near-identical start time and duration despite source sport-label differences'
          : 'Tredict and Intervals.icu execution records reconciled by start time, sport and duration',
        payload: {
          method: matchedCandidate.method,
          confidence: matchedCandidate.confidence,
          timeDeltaSeconds: Math.round(matchedCandidate.deltaMs / 1000),
          durationRatio: matchedCandidate.durationRatio,
          tredictActivityId: candidate.id,
          intervalsIcuActivityId: sourceId,
          intervalsIcuUpstreamSource: activity.source || null
        }
      });
    }
  }

  return { configured: true, activities: records.length - skipped, matched, unmatched, superseded, skipped, warnings };
}

async function ingestGarmin(startDate, endDate, tredictExecutions) {
  const result = await callFitnessAiTool('get_activities', { date_from: startDate, date_to: endDate, limit: 200, offset: 0 });
  const payload = parseFitnessAiToolResult(result);
  const activities = activityArray(payload);
  let matched = 0;
  let unmatched = 0;
  let superseded = 0;

  for (const activity of activities) {
    const sourceId = garminId(activity);
    const startAt = garminStart(activity);
    if (!sourceId || !startAt) continue;
    const localDate = localDateOf(startAt);
    if (!localDate || localDate < startDate || localDate > endDate) continue;
    const sourceRecord = await ingestTrainingSourceRecord({
      sourceKey: 'garmin',
      recordType: 'executed_activity',
      sourceRecordId: sourceId,
      sourceUpdatedAt: activity.manually_updated_at || null,
      localDate,
      payload: activity
    });
    const previouslyLinkedSessions = await findSessionsBySourceRecord(sourceRecord.id);

    const startMs = new Date(startAt).getTime();
    const duration = garminDuration(activity);
    const sport = garminSport(activity);
    const matches = tredictExecutions
      .map(candidate => candidateMatch(candidate, { localDate, startMs, duration, sport }))
      .filter(Boolean);

    const uniqueMatches = new Map();
    for (const match of matches) uniqueMatches.set(match.candidate.sessionId, match);
    const candidates = [...uniqueMatches.values()];

    let sessionId;
    let reconciliationState;
    let matchedCandidate = null;
    if (candidates.length === 1) {
      matchedCandidate = candidates[0];
      sessionId = matchedCandidate.candidate.sessionId;
      reconciliationState = 'MATCHED';
      matched += 1;
    } else {
      sessionId = `exec:garmin:${sourceId}`;
      reconciliationState = candidates.length > 1 ? 'MATCH_REQUIRED' : 'UNMATCHED';
      unmatched += 1;
    }

    await upsertTrainingSession({
      sessionId,
      localDate,
      actualStartAt: startAt,
      title: activity.name || activity.activity_name || null,
      sportType: sport || null,
      sessionKind: sessionKind(activity.name || activity.activity_name, activity.notes),
      status: 'COMPLETED',
      reconciliationState
    });
    await linkTrainingSource({
      sessionId,
      sourceRecordPk: sourceRecord.id,
      relationship: 'EXECUTION',
      matchMethod: matchedCandidate?.method || 'SOURCE_NATIVE',
      matchConfidence: matchedCandidate?.confidence ?? null
    });
    await appendAthleteEvent({
      eventKey: `garmin:activity:${sourceId}:EXECUTED`,
      sessionId,
      eventType: 'EXECUTED',
      occurredAt: startAt,
      localDate,
      actor: 'GARMIN',
      sourceKey: 'garmin',
      sourceRecordPk: sourceRecord.id,
      certainty: 'OBSERVED',
      summary: activity.name ? `Garmin recorded: ${activity.name}` : 'Executed activity observed by Garmin',
      payload: { device: activity.device || null, durationSeconds: duration, distance: activity.distance || activity.distance_m || null }
    });

    if (matchedCandidate) {
      const candidate = matchedCandidate.candidate;
      await setTrainingSessionState(sessionId, { reconciliationState: 'MATCHED' });

      for (const previous of previouslyLinkedSessions) {
        if (previous.session_id === sessionId || previous.status === 'SUPERSEDED') continue;
        await setTrainingSessionState(previous.session_id, {
          status: 'SUPERSEDED',
          reconciliationState: 'MATCHED',
          parentSessionId: sessionId
        });
        await appendAthleteEvent({
          eventKey: `supersede:garmin:${sourceId}:${previous.session_id}:${sessionId}`,
          sessionId: previous.session_id,
          eventType: 'LINKED',
          occurredAt: new Date().toISOString(),
          localDate,
          actor: 'SYSTEM',
          sourceKey: 'fz',
          certainty: 'INFERRED',
          summary: 'Prior Garmin-only session superseded by the reconciled canonical session',
          payload: { canonicalSessionId: sessionId, sourceRecordId: sourceId, method: matchedCandidate.method }
        });
        superseded += 1;
      }

      await appendAthleteEvent({
        eventKey: `reconcile:tredict:${candidate.id}:garmin:${sourceId}`,
        sessionId,
        eventType: 'RECONCILED',
        occurredAt: new Date().toISOString(),
        localDate,
        actor: 'SYSTEM',
        sourceKey: 'fz',
        certainty: 'INFERRED',
        summary: matchedCandidate.method === 'AUTO_TIME_DURATION_CROSS_SPORT'
          ? 'Tredict and Garmin execution records reconciled by near-identical start time and duration despite source sport-label differences'
          : 'Tredict and Garmin execution records reconciled by start time, sport and duration',
        payload: {
          method: matchedCandidate.method,
          confidence: matchedCandidate.confidence,
          timeDeltaSeconds: Math.round(matchedCandidate.deltaMs / 1000),
          durationRatio: matchedCandidate.durationRatio,
          tredictActivityId: candidate.id,
          garminActivityId: sourceId
        }
      });
    }
  }
  return { activities: activities.length, matched, unmatched, superseded };
}

export async function syncTrainingSources({ startDate, endDate }) {
  const warnings = [];
  let tredict = { configured: tredictConfigured(), plans: 0, activities: 0, detailed: 0, executions: [] };
  let intervalsIcu = { configured: intervalsIcuConfigured(), activities: 0, matched: 0, unmatched: 0, superseded: 0, skipped: 0 };
  let garmin = { activities: 0, matched: 0, unmatched: 0, superseded: 0, fallbackUsed: false };

  try {
    tredict = await ingestTredict(startDate, endDate);
    if (tredict.configured) {
      try { await markTredictSourceSynced(); }
      catch (statusError) { warnings.push(`Tredict source health: ${statusError instanceof Error ? statusError.message : String(statusError)}`); }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Tredict sync: ${message}`);
    try { await markTredictSourceError(message); }
    catch (statusError) { warnings.push(`Tredict source health: ${statusError instanceof Error ? statusError.message : String(statusError)}`); }
  }

  let canonicalExecutions = tredict.executions || [];
  try {
    canonicalExecutions = mergeExecutionCandidates(
      await loadExistingTredictExecutions(startDate, endDate),
      canonicalExecutions
    );
  } catch (error) {
    warnings.push(`Existing canonical execution lookup: ${error instanceof Error ? error.message : String(error)}`);
  }

  let intervalsHealthy = false;
  if (intervalsIcuConfigured()) {
    try {
      const result = await ingestIntervalsActivities(startDate, endDate, canonicalExecutions);
      intervalsIcu = { ...result };
      warnings.push(...(result.warnings || []));
      delete intervalsIcu.warnings;
      intervalsHealthy = true;
    } catch (error) {
      warnings.push(`Intervals.icu activity sync: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!intervalsHealthy) {
    try {
      garmin = { ...(await ingestGarmin(startDate, endDate, canonicalExecutions)), fallbackUsed: true };
    } catch (error) {
      warnings.push(`Garmin activity fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    startDate,
    endDate,
    syncedAt: new Date().toISOString(),
    tredict: { configured: tredict.configured, plans: tredict.plans, activities: tredict.activities, detailed: tredict.detailed || 0 },
    intervalsIcu,
    garmin,
    activityTransport: intervalsHealthy ? 'INTERVALS_ICU' : 'FITNESS_AI_FALLBACK',
    warnings
  };
}

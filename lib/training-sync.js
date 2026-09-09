import { callFitnessAiTool, parseFitnessAiToolResult } from './fitness-ai-client.js';
import { callTredictTool, parseTredictCsvResult, tredictConfigured } from './tredict-client.js';
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

  // Tredict may classify watch-recorded gym/mobility/HIIT sessions as generic
  // `misc` while Garmin retains the concrete activity type. Permit that mismatch
  // only when time and duration make the duplicate execution exceptionally clear.
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

async function ingestTredict(startDate, endDate) {
  if (!tredictConfigured()) return { configured: false, plans: 0, activities: 0, executions: [] };

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
  for (const activity of activities) {
    if (!activity.id || !activity.date) continue;
    const localDate = localDateOf(activity.date);
    if (!localDate || localDate < startDate || localDate > endDate) continue;
    const record = await ingestTrainingSourceRecord({
      sourceKey: 'tredict',
      recordType: 'executed_activity',
      sourceRecordId: String(activity.id),
      sourceUpdatedAt: activity.createdAt || null,
      localDate,
      payload: activity
    });
    const nativePlanSession = planByExecution.get(String(activity.id));
    const sessionId = nativePlanSession || `exec:tredict:${activity.id}`;
    await upsertTrainingSession({
      sessionId,
      localDate,
      actualStartAt: activity.date,
      title: activity.title || null,
      sportType: activity.sportType || null,
      sessionKind: sessionKind(activity.title, activity.notes),
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
      summary: activity.title ? `Executed activity in Tredict: ${activity.title}` : 'Executed activity observed in Tredict',
      payload: {
        durationSeconds: num(activity['summary.durationTotal'] || activity['summary.duration']),
        distanceMeters: num(activity['summary.distance']),
        averageHeartRate: num(activity['summary.heartrate'])
      }
    });
    executions.push({
      id: String(activity.id),
      sessionId,
      localDate,
      startAt: activity.date,
      sportType: activity.sportType || null,
      durationSeconds: num(activity['summary.durationTotal'] || activity['summary.duration'])
    });
  }

  return { configured: true, plans: plansInRange, activities: executions.length, executions };
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
  let tredict = { configured: tredictConfigured(), plans: 0, activities: 0, executions: [] };
  let garmin = { activities: 0, matched: 0, unmatched: 0, superseded: 0 };

  try {
    tredict = await ingestTredict(startDate, endDate);
  } catch (error) {
    warnings.push(`Tredict sync: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    garmin = await ingestGarmin(startDate, endDate, tredict.executions || []);
  } catch (error) {
    warnings.push(`Garmin activity sync: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    startDate,
    endDate,
    syncedAt: new Date().toISOString(),
    tredict: { configured: tredict.configured, plans: tredict.plans, activities: tredict.activities },
    garmin,
    warnings
  };
}

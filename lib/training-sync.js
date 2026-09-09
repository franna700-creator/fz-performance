import { callFitnessAiTool, parseFitnessAiToolResult } from './fitness-ai-client.js';
import { callTredictTool, parseTredictCsvResult, tredictConfigured } from './tredict-client.js';
import {
  appendAthleteEvent,
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

  for (const plan of plans) {
    if (!plan.id || !plan.date) continue;
    const localDate = localDateOf(plan.date);
    if (!localDate || localDate < startDate || localDate > endDate) continue;
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

  return { configured: true, plans: plans.length, activities: activities.length, executions };
}

async function ingestGarmin(startDate, endDate, tredictExecutions) {
  const result = await callFitnessAiTool('get_activities', { date_from: startDate, date_to: endDate, limit: 200, offset: 0 });
  const payload = parseFitnessAiToolResult(result);
  const activities = activityArray(payload);
  let matched = 0;
  let unmatched = 0;

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

    const startMs = new Date(startAt).getTime();
    const duration = garminDuration(activity);
    const sport = garminSport(activity);
    const candidates = tredictExecutions.filter(candidate => {
      if (candidate.localDate !== localDate || !sportCompatible(candidate.sportType, sport)) return false;
      const delta = Math.abs(new Date(candidate.startAt).getTime() - startMs);
      if (delta > 180000) return false;
      if (duration && candidate.durationSeconds) {
        const ratio = Math.abs(duration - candidate.durationSeconds) / Math.max(duration, candidate.durationSeconds);
        if (ratio > 0.2) return false;
      }
      return true;
    });

    let sessionId;
    let reconciliationState;
    if (candidates.length === 1) {
      sessionId = candidates[0].sessionId;
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
      matchMethod: candidates.length === 1 ? 'AUTO_TIME_SPORT_DURATION' : 'SOURCE_NATIVE',
      matchConfidence: candidates.length === 1 ? 0.95 : null
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
    if (candidates.length === 1) {
      await setTrainingSessionState(sessionId, { reconciliationState: 'MATCHED' });
      await appendAthleteEvent({
        eventKey: `reconcile:tredict:${candidates[0].id}:garmin:${sourceId}`,
        sessionId,
        eventType: 'RECONCILED',
        occurredAt: new Date().toISOString(),
        localDate,
        actor: 'SYSTEM',
        sourceKey: 'fz',
        certainty: 'INFERRED',
        summary: 'Tredict and Garmin execution records reconciled by start time, sport and duration',
        payload: { method: 'AUTO_TIME_SPORT_DURATION', confidence: 0.95, tredictActivityId: candidates[0].id, garminActivityId: sourceId }
      });
    }
  }
  return { activities: activities.length, matched, unmatched };
}

export async function syncTrainingSources({ startDate, endDate }) {
  const warnings = [];
  let tredict = { configured: tredictConfigured(), plans: 0, activities: 0, executions: [] };
  let garmin = { activities: 0, matched: 0, unmatched: 0 };

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

import { getSql } from './db.js';
import { recordAthleteMemory } from './athlete-memory-ingest.js';

export const EXERCISE_PROJECT_SCOPE = 'exercise-project';
export const FZ_ATHLETE_ID = 'francois';
export const SPEAKER_RESOLUTIONS = Object.freeze(['CONFIRMED', 'INFERRED_HIGH_CONFIDENCE']);

function text(value) { return String(value ?? '').trim(); }

function validDate(value, errorCode) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(errorCode);
  return date;
}

export function normalizeExerciseAthleteResponse(input = {}) {
  const projectScope = text(input.projectScope).toLowerCase();
  if (projectScope !== EXERCISE_PROJECT_SCOPE) throw new Error('exercise_project_scope_required');

  const athleteId = text(input.athleteId).toLowerCase();
  if (athleteId !== FZ_ATHLETE_ID) throw new Error('francois_speaker_required');

  const speakerResolution = text(input.speakerResolution).toUpperCase();
  if (!SPEAKER_RESOLUTIONS.includes(speakerResolution)) throw new Error('speaker_resolution_required');

  const reportedAt = input.reportedAt ? validDate(input.reportedAt, 'invalid_reported_at') : new Date();
  const occurredAt = input.occurredAt ? validDate(input.occurredAt, 'invalid_occurred_at') : reportedAt;
  const occurrencePrecision = text(input.occurrencePrecision || input.timestampPrecision || (input.occurredAt ? 'exact-or-athlete-supplied' : 'report-time'));

  return {
    ...input,
    projectScope: EXERCISE_PROJECT_SCOPE,
    athleteId: FZ_ATHLETE_ID,
    speakerResolution,
    reportedAt: reportedAt.toISOString(),
    occurredAt: occurredAt.toISOString(),
    timestampPrecision: occurrencePrecision,
    ingestSourceKey: text(input.ingestSourceKey) || 'conversation',
    payload: {
      ...(input.payload && typeof input.payload === 'object' ? input.payload : {}),
      captureScope: EXERCISE_PROJECT_SCOPE,
      athleteId: FZ_ATHLETE_ID,
      speakerResolution,
      reportedAt: reportedAt.toISOString(),
      occurredAt: occurredAt.toISOString(),
      occurrencePrecision
    }
  };
}

export async function recordExerciseAthleteResponse(input = {}) {
  const normalized = normalizeExerciseAthleteResponse(input);
  const result = await recordAthleteMemory(normalized);
  const sql = await getSql();
  await sql`
    UPDATE fz_athlete_events
    SET reported_at=COALESCE(reported_at, ${normalized.reportedAt})
    WHERE event_key=${result.eventKey}
  `;
  return {
    ...result,
    projectScope: EXERCISE_PROJECT_SCOPE,
    athleteId: FZ_ATHLETE_ID,
    speakerResolution: normalized.speakerResolution,
    reportedAt: normalized.reportedAt,
    occurredAt: normalized.occurredAt,
    occurrencePrecision: normalized.timestampPrecision
  };
}

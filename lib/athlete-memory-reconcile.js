import { getSql } from './db.js';
import { appendAthleteEvent, linkTrainingSource, setTrainingSessionState } from './training-store.js';
import { resolveLateAssociation } from './athlete-memory-association.js';

function statusForEvent(eventType) {
  if (eventType === 'STOPPED_EARLY') return 'STOPPED_EARLY';
  if (eventType === 'ABORTED') return 'ABORTED';
  if (eventType === 'ATHLETE_MODIFIED') return 'MODIFIED';
  return null;
}

export async function reconcileUnlinkedAthleteEvents({ startDate, endDate } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ''))) {
    throw new Error('late_link_date_range_required');
  }
  const sql = await getSql();
  const [events, sessions] = await Promise.all([
    sql`
      SELECT event_id,event_key,session_id,event_type,occurred_at,reported_at,local_date::text AS local_date,
             actor,source_key,source_record_pk,certainty,summary,payload
      FROM fz_athlete_events
      WHERE actor='ATHLETE' AND session_id IS NULL
        AND local_date BETWEEN ${startDate} AND ${endDate}
        AND (
          event_type IN ('POST_SESSION_FEEDBACK','STOPPED_EARLY','ABORTED','ATHLETE_MODIFIED','NEXT_DAY_RESPONSE')
          OR (event_type='CONTEXT' AND payload->'memoryCategories' ? 'SESSION')
        )
      ORDER BY occurred_at,event_id
    `,
    sql`
      SELECT session_id,local_date::text AS local_date,actual_start_at,title,sport_type,session_kind,status,reconciliation_state
      FROM fz_training_sessions
      WHERE local_date BETWEEN (${startDate}::date - INTERVAL '1 day')::date AND ${endDate}::date
        AND actual_start_at IS NOT NULL AND status <> 'SUPERSEDED'
      ORDER BY actual_start_at,session_id
    `
  ]);
  const output = { scanned: events.length, linked: 0, ambiguous: 0, noCandidate: 0, changes: [] };
  for (const event of events) {
    const resolution = resolveLateAssociation(event, sessions);
    if (!resolution.session) {
      if (resolution.method === 'LATE_AMBIGUOUS_CONTEXT') output.ambiguous += 1;
      else output.noCandidate += 1;
      continue;
    }
    const linkResolution = { method: resolution.method, confidence: resolution.confidence, reasons: resolution.reasons || [], linked: true, linkedAt: new Date().toISOString(), candidates: resolution.candidates || [] };
    const updated = await sql`
      UPDATE fz_athlete_events
      SET session_id=${resolution.session.session_id},
          payload=jsonb_set(COALESCE(payload,'{}'::jsonb), '{linkResolution}', ${JSON.stringify(linkResolution)}::jsonb, true)
      WHERE event_id=${event.event_id} AND session_id IS NULL
      RETURNING event_id
    `;
    if (!updated[0]) continue;
    if (event.source_record_pk) {
      await linkTrainingSource({ sessionId: resolution.session.session_id, sourceRecordPk: event.source_record_pk, relationship: 'EVIDENCE', matchMethod: resolution.method, matchConfidence: resolution.confidence });
    }
    const status = statusForEvent(String(event.event_type || '').toUpperCase());
    if (status) await setTrainingSessionState(resolution.session.session_id, { status });
    await appendAthleteEvent({
      eventKey: `late-link:${event.event_key}:${resolution.session.session_id}`,
      sessionId: resolution.session.session_id,
      eventType: 'LINKED',
      occurredAt: new Date().toISOString(),
      localDate: resolution.session.local_date,
      actor: 'SYSTEM',
      sourceKey: 'fz',
      certainty: 'INFERRED',
      summary: 'Athlete feedback linked automatically after canonical workout evidence became available',
      payload: { athleteEventKey: event.event_key, method: resolution.method, confidence: resolution.confidence, reasons: resolution.reasons || [] }
    });
    output.linked += 1;
    output.changes.push({ eventKey: event.event_key, sessionId: resolution.session.session_id, confidence: resolution.confidence });
  }
  return output;
}

import { getSql } from './db.js';
import { readConvergenceStatus } from './convergence-store.js';
import { readCurrentAthleteState } from './athlete-current-state.js';

function add(findings, code, severity, message, detail = null) { findings.push({ code, severity, message, detail }); }

export function runSystemicReconciliationSweep({ training = null, trends = null, objectives = null, eventIntelligence = null } = {}) {
  const findings = [];
  if (!training?.ok) add(findings,'TRAINING_UNAVAILABLE','ERROR','Canonical training contract is unavailable.');
  if (!trends?.ok) add(findings,'TRENDS_UNAVAILABLE','ERROR','Canonical Trends contract is unavailable.');

  if (training?.ok) {
    const integrity = training.integrity || {};
    const unresolved = Number(integrity.unlinkedSessionFeedback || 0);
    if (unresolved > 0) add(findings,'ATHLETE_MEMORY_UNRESOLVED','WARN',`${unresolved} session-related athlete event(s) remain unlinked after reconciliation.`,{ count:unresolved });
    const sessions = Array.isArray(training.sessions) ? training.sessions : [];
    for (const session of sessions) {
      if (session.status === 'COMPLETED' && !session.presentation?.displayTitle && !session.title && !session.sport_type) {
        add(findings,'SESSION_IDENTITY_MISSING','WARN','Completed session has no usable canonical identity.',{ sessionId:session.session_id, date:session.local_date });
      }
    }
  }

  if (trends?.ok) {
    const series = Array.isArray(trends?.load?.series) ? trends.load.series : [];
    for (const point of series) {
      if (Number(point.sessions || 0) > 0 && point.value === 0) add(findings,'FALSE_ZERO_LOAD','ERROR','Workout day is represented as zero NCL.',{ date:point.date, sessions:point.sessions });
      if (point.state === 'PENDING_DETAIL' && point.value !== null) add(findings,'PENDING_WITH_VALUE','ERROR','Pending-detail NCL point must not masquerade as final value.',{ date:point.date, value:point.value });
    }
    const policy = trends?.quality?.evidencePolicy;
    if (policy && policy !== 'MONOTONIC_BEST_AVAILABLE') add(findings,'EVIDENCE_POLICY_DRIFT','ERROR','Trends evidence policy drifted from monotonic best-available.',{ policy });
  }

  if (objectives) {
    if (!objectives.primaryEvent && Array.isArray(objectives.upcomingEvents) && objectives.upcomingEvents.some(event => event.role === 'PRIMARY')) {
      add(findings,'PRIMARY_OBJECTIVE_RESOLUTION','ERROR','Upcoming PRIMARY event exists but objective context did not resolve it.');
    }
    if (objectives.nextEvergreenCandidate && objectives.primaryEvent) add(findings,'EVERGREEN_PREMATURE','ERROR','Evergreen maintenance objective surfaced while a primary event is still active.');
  }

  if (eventIntelligence) {
    for (const event of eventIntelligence.eventKnowledge || []) {
      if (event.knowledgeStatus === 'PENDING_RESEARCH' && event.overlapToPrimary) add(findings,'UNQUALIFIED_EVENT_TRANSFER','ERROR','Unqualified event is contributing overlap before its structure is known.',{ eventId:event.eventId });
      if (event.knowledgeStatus === 'PENDING_RESEARCH') add(findings,'EVENT_RESEARCH_REQUIRED','WARN','Scheduled event cannot influence capability priorities until its demand profile is qualified.',{ eventId:event.eventId, eventName:event.eventName });
    }
    const qualifiedIds = new Set((eventIntelligence.eventKnowledge || []).filter(event => event.knowledgeStatus === 'QUALIFIED').map(event => event.eventId));
    for (const priority of eventIntelligence.capabilityPriorities || []) {
      for (const source of priority.events || []) {
        if (!qualifiedIds.has(source.eventId)) add(findings,'UNQUALIFIED_CAPABILITY_PRIORITY','ERROR','Capability priority contains an event whose format has not passed the knowledge gate.',{ capabilityId:priority.capabilityId, eventId:source.eventId });
      }
    }
  }

  const errors = findings.filter(item => item.severity === 'ERROR').length;
  const warnings = findings.filter(item => item.severity === 'WARN').length;
  return { ok: errors === 0, errors, warnings, findings, checkedAt: new Date().toISOString() };
}

export async function runLiveSystemicReconciliationSweep({now=new Date()}={}){
  const findings=[];
  const sql=await getSql();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

  const [constraintRows,reconciliationRows,stalePlanRows,duplicatePlanRows,unassessedRows,objectiveRows,choiceOutcomeRows,athleteStateRow,convergence]=await Promise.all([
    sql`
      SELECT pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      WHERE t.relname='fz_training_source_records' AND c.contype='c'
    `.catch(()=>[]),
    sql`
      SELECT s.session_id,s.local_date::text AS local_date,s.status,s.reconciliation_state,s.title
      FROM fz_training_sessions s
      WHERE s.reconciliation_state='UNMATCHED'
        AND EXISTS (SELECT 1 FROM fz_training_session_sources p WHERE p.session_id=s.session_id AND p.relationship='PLAN')
        AND EXISTS (SELECT 1 FROM fz_training_session_sources e WHERE e.session_id=s.session_id AND e.relationship='EXECUTION')
      ORDER BY s.local_date,s.session_id
    `,
    sql`
      SELECT s.session_id,s.local_date::text AS local_date,s.status,s.title
      FROM fz_training_sessions s
      WHERE s.local_date < ${date}::date
        AND s.status IN ('ACCEPTED','MODIFIED','PLANNED','RECOMMENDED')
        AND EXISTS (
          SELECT 1 FROM fz_training_session_sources l JOIN fz_training_source_records r ON r.id=l.source_record_pk
          WHERE l.session_id=s.session_id AND l.relationship='PLAN' AND r.source_key='fz-intelligence'
            AND r.record_type='planned_workout' AND r.payload->>'contextType'='FZ_PLANNED_INTENT'
        )
      ORDER BY s.local_date,s.session_id
    `,
    sql`
      SELECT s.local_date::text AS local_date,count(*)::int AS open_plans,array_agg(s.session_id ORDER BY s.created_at) AS session_ids
      FROM fz_training_sessions s
      WHERE s.status IN ('ACCEPTED','MODIFIED','PLANNED','RECOMMENDED')
        AND EXISTS (
          SELECT 1 FROM fz_training_session_sources l JOIN fz_training_source_records r ON r.id=l.source_record_pk
          WHERE l.session_id=s.session_id AND l.relationship='PLAN' AND r.source_key='fz-intelligence'
            AND r.record_type='planned_workout' AND r.payload->>'contextType'='FZ_PLANNED_INTENT'
        )
      GROUP BY s.local_date HAVING count(*)>1 ORDER BY s.local_date
    `,
    sql`
      SELECT count(*)::int AS count
      FROM fz_athlete_events e
      WHERE e.actor='ATHLETE' AND NOT EXISTS (
        SELECT 1 FROM fz_training_source_latest m
        WHERE m.source_key='fz-intelligence' AND m.record_type='event_context'
          AND m.payload->>'contextType'='MATERIALITY_ASSESSMENT' AND m.payload->>'evidenceKey'=e.event_key
      )
    `,
    sql`
      SELECT objective_id,role,state,starts_on::text AS starts_on,knowledge_status
      FROM fz_objectives WHERE state IN ('SCHEDULED','ACTIVE')
      ORDER BY CASE role WHEN 'PRIMARY' THEN 0 WHEN 'SECONDARY' THEN 1 WHEN 'VALIDATION' THEN 2 ELSE 3 END,starts_on NULLS LAST
    `.catch(()=>[]),
    sql`SELECT count(*)::int AS count FROM fz_training_source_records WHERE record_type='choice_outcome'`.catch(()=>[{count:0}]),
    readCurrentAthleteState().catch(()=>null),
    readConvergenceStatus().catch(()=>({status:'UNAVAILABLE',pending:true,failed:['UNAVAILABLE'],invalidated:[]}))
  ]);

  const constraintText=(constraintRows||[]).map(row=>String(row.definition||'')).join(' ');
  if(!constraintText.includes('choice_outcome'))add(findings,'LEDGER_SCHEMA_DRIFT','ERROR','Deployed training ledger does not admit choice_outcome records.');
  if(reconciliationRows.length)add(findings,'RECONCILIATION_STATE_CONTRADICTION','ERROR',`${reconciliationRows.length} execution(s) have both PLAN and EXECUTION links but remain UNMATCHED.`,{sessions:reconciliationRows});
  if(stalePlanRows.length)add(findings,'STALE_OPEN_FZ_PLAN','ERROR',`${stalePlanRows.length} past FZ planned intent(s) remain open.`,{plans:stalePlanRows});
  if(duplicatePlanRows.length)add(findings,'DUPLICATE_OPEN_FZ_PLAN','ERROR','Multiple open FZ athlete-choice plans exist for the same intended date.',{dates:duplicatePlanRows});
  const unassessed=Number(unassessedRows?.[0]?.count||0);
  if(unassessed>0)add(findings,'ATHLETE_EVENT_WITHOUT_MATERIALITY','ERROR',`${unassessed} Athlete Voice event(s) lack materiality assessment.`,{count:unassessed});
  const primary=(objectiveRows||[]).filter(row=>row.role==='PRIMARY');
  if(!primary.length)add(findings,'PRIMARY_OBJECTIVE_NOT_TRACKED','ERROR','No SCHEDULED/ACTIVE primary objective is present in the decision-driving objective graph.');
  if(primary.length>1)add(findings,'MULTIPLE_PRIMARY_OBJECTIVES','ERROR','More than one SCHEDULED/ACTIVE PRIMARY objective is present.',{objectives:primary});
  if(!athleteStateRow?.payload)add(findings,'CURRENT_ATHLETE_STATE_MISSING','ERROR','Canonical Current Athlete State has not been materialized.');
  if(convergence?.pending)add(findings,'INTELLIGENCE_NOT_CONVERGED','ERROR','Latest canonical revision has unresolved convergence nodes.',{revisionId:convergence?.revision?.revision_id||null,failed:convergence?.failed||[],invalidated:convergence?.invalidated||[]});

  const errors=findings.filter(item=>item.severity==='ERROR').length;
  const warnings=findings.filter(item=>item.severity==='WARN').length;
  return {
    ok:errors===0,errors,warnings,findings,checkedAt:new Date().toISOString(),
    invariants:{choiceOutcomeSchemaSupported:constraintText.includes('choice_outcome'),choiceOutcomeRecords:Number(choiceOutcomeRows?.[0]?.count||0),decisionObjectives:objectiveRows||[],currentAthleteStateFingerprint:athleteStateRow?.payload?.inputFingerprint||null,convergenceStatus:convergence?.status||null}
  };
}

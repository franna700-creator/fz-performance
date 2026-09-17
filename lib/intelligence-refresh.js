import { getSql } from './db.js';
import { readIntelligenceCurrent } from './intelligence-current-v5.js';
import { syncTrainingSources } from './training-sync-runtime.js';
import { syncWellnessToday } from './wellness-sync.js';
import { evaluateMateriality, MATERIALITY_ENGINE_VERSION } from './materiality-engine.js';
import { persistMaterialityAssessment } from './materiality-store.js';
import { propagateCanonicalChangeSafely } from './canonical-propagation.js';
import { repairOrphanedEmbeddedAthleteContext } from './athlete-context-integrity.js';

const TZ = 'Africa/Johannesburg';

function todayLocal(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function epoch(value) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function neutralDecisionInputMateriality(reason='NON_EVENT_DECISION_INPUT_REVISION') {
  return {
    engineVersion: MATERIALITY_ENGINE_VERSION,
    level: 'RECORD_ONLY',rank: 0,sourceType: 'SYSTEM_RECONCILIATION',
    reasonCodes: [reason],affectedDomains: [],shouldUpdateState: false,
    shouldRecomputeRecommendation: false,blocksExistingRecommendation: false,certainty: 'OBSERVED',signals: {}
  };
}

async function repairUnassessedAthleteMateriality({ limit = 50 } = {}) {
  const sql = await getSql();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const rows = await sql`
    SELECT e.event_id,e.event_key,e.session_id,e.event_type,e.occurred_at,e.reported_at,
           e.local_date::text AS local_date,e.source_key,e.source_record_pk,e.certainty,e.summary,e.payload
    FROM fz_athlete_events e
    WHERE e.actor='ATHLETE'
      AND NOT EXISTS (
        SELECT 1 FROM fz_training_source_latest m
        WHERE m.source_key='fz-intelligence' AND m.record_type='event_context'
          AND m.payload->>'contextType'='MATERIALITY_ASSESSMENT'
          AND m.payload->>'evidenceKey'=e.event_key
      )
    ORDER BY e.event_id ASC
    LIMIT ${safeLimit}
  `;
  const repaired = [];
  for (const event of rows || []) {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
    const categories = Array.isArray(payload.memoryCategories) ? payload.memoryCategories : [];
    const assessment = evaluateMateriality({
      sourceType: 'ATHLETE_FEEDBACK',eventType: event.event_type,certainty: event.certainty,categories,
      summary: event.summary || '',rawText: payload.rawText || '',occurredAt: event.occurred_at,reportedAt: event.reported_at,
      signals: payload.materialitySignals || {},payload
    });
    const persisted = await persistMaterialityAssessment({
      evidenceKey: event.event_key,sourceType: 'ATHLETE_FEEDBACK',sourceKey: event.source_key || 'conversation',
      sourceRecordPk: event.source_record_pk || null,athleteEventId: event.event_id,occurredAt: event.occurred_at,
      summary: event.summary || '',assessment
    });
    repaired.push({ eventId: Number(event.event_id), eventKey: event.event_key, assessment, materialityRecordPk: persisted?.id || null });
  }
  return { scanned: rows?.length || 0, repaired };
}

async function readLatestDecisionMateriality() {
  const sql = await getSql();
  const rows = await sql`
    SELECT id,source_updated_at,ingested_at,payload
    FROM fz_training_source_latest
    WHERE source_key='fz-intelligence' AND record_type='event_context'
      AND payload->>'contextType'='MATERIALITY_ASSESSMENT'
      AND payload->'materiality'->>'shouldRecomputeRecommendation'='true'
    ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
  `;
  return rows?.[0] || null;
}
function causalMaterialityFor(current, decisionRow) {
  if (!decisionRow?.payload?.materiality) return neutralDecisionInputMateriality();
  const decisionAt = epoch(decisionRow.ingested_at || decisionRow.source_updated_at);
  const runtimeAt = epoch(current?.markers?.runtime?.updatedAt);
  const objectiveAt = epoch(current?.markers?.objective?.updatedAt);
  return decisionAt >= Math.max(runtimeAt, objectiveAt) ? decisionRow.payload.materiality : neutralDecisionInputMateriality();
}

export async function refreshIntelligence({ refreshSources = false, forceWellness = false, now = new Date() } = {}) {
  const startedAt = new Date().toISOString();
  const date = todayLocal(now);
  const warnings = [];
  const steps = {
    sourceSync: { requested: refreshSources, training: null, wellness: null },
    athleteContextIntegrity: null,athleteMaterialityRepair: null,bootstrapPropagation: null,temporalPropagation: null,
    readinessPropagation: null,propagation: null
  };

  const before = await readIntelligenceCurrent({now});

  if (refreshSources) {
    try {
      steps.sourceSync.training = await syncTrainingSources({
        startDate: addDays(date, -45),endDate: addDays(date, 14),recomputeRecommendation: false
      });
      warnings.push(...(steps.sourceSync.training?.warnings || []));
    } catch (error) { warnings.push(`Training source refresh: ${error instanceof Error ? error.message : String(error)}`); }
    try {
      steps.sourceSync.wellness = await syncWellnessToday({ force: forceWellness, date });
      if (steps.sourceSync.wellness?.warning) warnings.push(steps.sourceSync.wellness.warning);
    } catch (error) { warnings.push(`Wellness source refresh: ${error instanceof Error ? error.message : String(error)}`); }
  }

  try {
    steps.athleteContextIntegrity = await repairOrphanedEmbeddedAthleteContext({ limit: 20 });
    for (const item of steps.athleteContextIntegrity?.errors || []) warnings.push(`Athlete context integrity ${item.sourceRecordPk}: ${item.error}`);
  } catch (error) { warnings.push(`Athlete context integrity: ${error instanceof Error ? error.message : String(error)}`); }
  try { steps.athleteMaterialityRepair = await repairUnassessedAthleteMateriality({ limit: 50 }); }
  catch (error) { warnings.push(`Athlete materiality repair: ${error instanceof Error ? error.message : String(error)}`); }

  let current = await readIntelligenceCurrent({now});

  if (current.convergence?.status === 'NO_REVISION') {
    const materiality=neutralDecisionInputMateriality('CONVERGENCE_LEDGER_BOOTSTRAP');
    steps.bootstrapPropagation=await propagateCanonicalChangeSafely({
      changedNodes:['source.system.reconciliation'],materiality,forceRecommendationRecompute:true,
      trigger:{type:'SYSTEM_RECONCILIATION_BOOTSTRAP',beforeRevision:before.revision},now
    });
    warnings.push(...(steps.bootstrapPropagation?.warnings||[]));
    current=await readIntelligenceCurrent({now});
  }

  if (current.pending?.temporal) {
    const localDayChanged=current.temporal?.shadowLocalDate!==current.temporal?.localDate;
    const changedNode=localDayChanged?'clock.local_day':'clock.decision_window';
    const materiality=neutralDecisionInputMateriality(localDayChanged?'LOCAL_DAY_ADVANCED':'DECISION_WINDOW_ADVANCED');
    steps.temporalPropagation=await propagateCanonicalChangeSafely({
      changedNodes:[changedNode],materiality,
      trigger:{type:'TEMPORAL_INVALIDATION',temporalInvalidation:true,localDayChanged,decisionWindowKey:current.temporal?.decisionWindowKey||null,beforeRevision:before.revision},
      now
    });
    warnings.push(...(steps.temporalPropagation?.warnings||[]));
    current=await readIntelligenceCurrent({now});
  }

  if (current.pending?.readiness) {
    const decisionRow = await readLatestDecisionMateriality().catch(() => null);
    const materiality = causalMaterialityFor(current, decisionRow);
    steps.readinessPropagation = await propagateCanonicalChangeSafely({
      changedNodes:['wellness.current','recovery.current','athlete.memory','materiality.current'],materiality,forceRecommendationRecompute:true,
      trigger:{type:'INTELLIGENCE_REFRESH_READINESS',evidenceKey:decisionRow?.payload?.evidenceKey||null,materialityLevel:materiality.level,reasonCodes:materiality.reasonCodes,beforeRevision:before.revision},
      now
    });
    warnings.push(...(steps.readinessPropagation?.warnings||[]));
    current = await readIntelligenceCurrent({now});
  }

  if (current.pending?.shadowRecommendation) {
    const decisionRow = await readLatestDecisionMateriality().catch(() => null);
    const materiality = causalMaterialityFor(current, decisionRow);
    steps.propagation = await propagateCanonicalChangeSafely({
      changedNodes:['source.fz.runtime.publish','objective.graph','materiality.current','adaptive.context'],materiality,forceRecommendationRecompute:true,
      trigger:{type:'INTELLIGENCE_REFRESH',evidenceKey:decisionRow?.payload?.evidenceKey||null,materialityLevel:materiality.level,reasonCodes:materiality.reasonCodes,beforeRevision:before.revision},
      now
    });
    warnings.push(...(steps.propagation?.warnings||[]));
    current = await readIntelligenceCurrent({now});
  } else if (current.pending?.activeRecommendation) {
    steps.propagation = await propagateCanonicalChangeSafely({
      changedNodes:['recommendation.shadow'],trigger:{type:'INTELLIGENCE_REFRESH_ACTIVE_PROJECTION',beforeRevision:before.revision},now
    });
    warnings.push(...(steps.propagation?.warnings||[]));
    current = await readIntelligenceCurrent({now});
  }

  const completedAt = new Date().toISOString();
  return {
    ok: !current.convergence?.failed?.length,
    startedAt,completedAt,beforeRevision: before.revision,afterRevision: current.revision,
    revisionChanged: before.revision !== current.revision,pendingPropagation: current.pendingPropagation,pending: current.pending,
    convergence:current.convergence,temporal:current.temporal,
    affectedSurfaces: steps.bootstrapPropagation?.affectedSurfaces||steps.temporalPropagation?.affectedSurfaces||steps.readinessPropagation?.affectedSurfaces||steps.propagation?.affectedSurfaces||current.affectedSurfaces,
    currentAthleteState:current.currentAthleteState,currentReadiness: current.currentReadiness,activeRecommendation: current.activeRecommendation,
    steps,warnings
  };
}

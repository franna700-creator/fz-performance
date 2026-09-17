import crypto from 'node:crypto';
import { mergeEvidenceRows } from './training-evidence.js';
import { SESSION_PROTOCOL_FAMILIES } from './session-protocol-family-registry.js';

export const MEASUREMENT_EVIDENCE_VERSION = '1.0.0';
export const MEASUREMENT_LOOKBACK_DAYS = 45;
const unique = values => [...new Set(values.filter(Boolean))];
const number = value => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const positive = value => number(value) !== null && number(value) > 0;
const round = value => Math.round(value * 1000) / 1000;
const withinWindow = (date,asOf) => !asOf || (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.slice(0,10)) && date.slice(0,10)<=asOf && (Date.parse(asOf)-Date.parse(date.slice(0,10)))/86400000<MEASUREMENT_LOOKBACK_DAYS);
const nonempty = value => value !== null && value !== undefined && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0) && (typeof value !== 'object' || Object.keys(value).length > 0);

// Bind semantics explicitly. Declaring a capture in a prescription is never evidence
// that the capture was made. New families must have a reviewed binding or an explicit gap.
export const PROTOCOL_MEASUREMENT_BINDINGS = Object.freeze({
  COMPROMISED_RUNNING_REPEATABILITY: [
    {key:'RUN_WORK_INTERVAL_SPLITS',metrics:['runSplit'],capture:['roundRunSplit','preFatigueOutput'],capabilities:['compromised_running','mixed_modality_repeatability']},
    {key:'RUN_SPLIT_DECAY',metrics:['runSplitDegradation'],capture:['roundRunSplit','preFatigueOutput'],capabilities:['compromised_running','race_pacing']}
  ],
  STEADY_AEROBIC_EFFICIENCY: [{key:'CONTROLLED_STEADY_RUN',metrics:['paceOrPower','avgHeartRate'],capture:['duration','distanceOrWork'],capabilities:['running_economy']}],
  MATCHED_RUN_AET: [], // The existing matched-AET classifier owns match qualification.
  HYBRID_TRANSITION_ECONOMY: [{key:'RUN_TO_STATION_TRANSITION',metrics:['transitionTime'],capture:['transitionTimeWhenMeasured'],capabilities:['transition_efficiency']}],
  ERG_EFFICIENCY: [{key:'ERG_AET',metrics:['splitOrPower','heartRateCost'],capture:['ergType','repSplitOrPower'],capabilities:['aerobic_durability']}],
  WALL_BALL_TOLERANCE: [{key:'WALL_BALL_AET',metrics:['completionQuality','repRateOrSplit','heartRateCost'],capture:['completionQuality'],capabilities:['station_strength_endurance']}],
  STATION_WORK_RATE: [{key:'STANDARDISED_STATION_SPLIT',metrics:['stationSplit'],capture:['stationIdentity','load','workUnit','movementQuality'],capabilities:['station_strength_endurance']}],
  STRENGTH_ENDURANCE_REPEATABILITY: [{key:'REPEATED_STATION_BLOCKS',metrics:['repCompletion','qualityDegradation'],capture:['exercise','load','reps','sets','rest'],capabilities:['station_strength_endurance','mixed_modality_repeatability']}],
  STRENGTH_RESERVE_MAINTENANCE: [], // General strength is not evidence of race-load sled/carry ability.
  TARGETED_QUALITY_TRAINING_ONLY: []
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])]));
}
export function measurementEvidenceFingerprint(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(evidence))).digest('hex');
}
function bySession(rows,id) { return rows.filter(row => row.session_id === id); }
function hasValue(value) {
  if (!nonempty(value)) return false;
  if (Array.isArray(value)) return value.every(hasValue);
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}
const positiveMetrics=new Set(['runSplit','roundRunSplit','paceOrPower','avgHeartRate','heartRateCost','duration','distanceOrWork','splitOrPower','repSplitOrPower','repRateOrSplit','stationSplit','load','reps','sets','rest']);
function validCapture(name,value) {
  if (!hasValue(value)) return false;
  if (positiveMetrics.has(name)) return Array.isArray(value)?value.length>0&&value.every(positive):positive(value);
  if (['transitionTime','transitionTimeWhenMeasured'].includes(name)) return number(value)!==null&&number(value)>=0;
  if(name==='repCompletion')return Array.isArray(value)&&value.length>=2&&value.every(positive);
  if(name==='qualityDegradation')return number(value)!==null;
  return true;
}
function observationRefs(rows) { return unique(rows.map(row => row.source_record_pk ? `source:${row.source_record_pk}` : row.event_key ? `event:${row.event_key}` : null)).sort(); }

export function deriveMeasurementEvidence({range={},trends=null,asOf=null}={}) {
  const evidence = {}, executions = [], diagnostics = [];
  const sources = range.sources || [], events = range.events || [];
  function add(key,observation) {
    const bucket = evidence[key] ||= {status:'VALID',observations:[]};
    if (!bucket.observations.some(item => item.sessionId === observation.sessionId && item.kind === observation.kind)) bucket.observations.push(observation);
  }
  for (const session of [...(range.sessions || [])].sort((a,b)=>String(a.session_id).localeCompare(String(b.session_id)))) {
    if (!['COMPLETED','STOPPED_EARLY'].includes(session.status) || !session.actual_start_at || !withinWindow(String(session.local_date),asOf)) continue;
    const linked = bySession(sources,session.session_id);
    const plans = linked.filter(row => row.relationship === 'PLAN' && row.record_type === 'planned_workout' && row.payload?.contextType === 'FZ_PLANNED_INTENT');
    const families = unique(plans.map(row => row.payload?.protocolFamilyId || row.payload?.prescription?.protocolFamilyId));
    if (families.length !== 1) {
      if(families.length>1)diagnostics.push({sessionId:session.session_id,reason:'AMBIGUOUS_PROTOCOL_FAMILY'});
      continue;
    }
    const familyId = families[0], family = SESSION_PROTOCOL_FAMILIES[familyId];
    if (!family) { diagnostics.push({sessionId:session.session_id,reason:'UNSUPPORTED_PROTOCOL_FAMILY',familyId}); continue; }
    const plan = mergeEvidenceRows(plans).payload;
    const version=plan.protocolVersion || plan.prescription?.protocolVersion || family.protocolVersion;
    if (version!==family.protocolVersion && familyId!=='MATCHED_RUN_AET') {
      diagnostics.push({sessionId:session.session_id,reason:'UNSUPPORTED_PROTOCOL_VERSION',familyId,version});continue;
    }
    if (session.reconciliation_state==='MATCH_REQUIRED') {
      diagnostics.push({sessionId:session.session_id,reason:'SESSION_RECONCILIATION_PENDING'});continue;
    }
    const actualRows = linked.filter(row => row.relationship === 'EXECUTION' && row.record_type === 'executed_activity');
    if (!actualRows.length) continue;
    const actual = mergeEvidenceRows(actualRows).payload;
    const feedbackRows = linked.filter(row => row.relationship === 'EVIDENCE' && row.record_type === 'athlete_feedback');
    const sessionEvents = bySession(events,session.session_id).filter(row => row.actor === 'ATHLETE');
    const feedback = mergeEvidenceRows([...feedbackRows,...sessionEvents.map(row=>({...row,ingested_at:row.created_at}))]).payload;
    const comparisonClass = feedback.comparisonClass || plan.comparisonClass || plan.prescription?.comparisonClass || 'TRAINING_ONLY';
    // Named captures are supported only when supplied in execution/feedback, never copied from PLAN.
    const observed = {...actual,...feedback};
    const metrics = {};
    for (const name of unique([...family.comparisonMetrics,...family.requiredCapture])) if (validCapture(name,observed[name])) metrics[name]=observed[name];
    delete metrics.preFatigueOutput;
    delete metrics.runSplit; delete metrics.roundRunSplit; delete metrics.runSplitDegradation;
    const laps = actual.runLaps;
    const validLaps = Array.isArray(laps) && laps.length >= 2 && laps.every(lap=>positive(lap.durationSeconds)&&positive(lap.distanceMeters)&&positive(lap.round)) && new Set(laps.map(lap=>Number(lap.round))).size===laps.length;
    if (validLaps) {
      const ordered = [...laps].sort((a,b)=>a.round-b.round);
      const equalDistance = ordered.every(lap=>Math.abs(Number(lap.distanceMeters)-Number(ordered[0].distanceMeters))<1);
      if (equalDistance) {
        const splits = ordered.map(lap=>Number(lap.durationSeconds));
        metrics.runSplit = splits;
        metrics.roundRunSplit = splits;
        metrics.runSplitDegradation = {firstToLastPct:round((splits.at(-1)/splits[0]-1)*100),worstVsFirstPct:round((Math.max(...splits)/splits[0]-1)*100),definition:'(split / first split - 1) × 100; equal-distance ordered bouts',distanceMeters:Number(ordered[0].distanceMeters)};
        if(ordered.every(lap=>positive(lap.averageHeartRate))) metrics.heartRateCost=ordered.map(lap=>Number(lap.averageHeartRate));
        if(ordered.every(lap=>positive(lap.cadenceSpm))) metrics.cadenceWhenReliable=ordered.map(lap=>Number(lap.cadenceSpm));
        if(ordered.every(lap=>positive(lap.groundContactTimeMs))) metrics.gctWhenReliable=ordered.map(lap=>Number(lap.groundContactTimeMs));
      } else diagnostics.push({sessionId:session.session_id,reason:'UNEQUAL_RUN_DISTANCE'});
    }
    // Recovery interval average HR is context, not a timed HR-recovery delta.
    const recoveryContext = Array.isArray(actual.recoveryHeartRateAvg) ? actual.recoveryHeartRateAvg : null;
    const pm5 = feedback.pm5Evidence;
    if (pm5?.directlyObservedIntervals?.length && pm5.directlyObservedIntervals.every(row=>positive(row.round)&&positive(row.durationSeconds)&&positive(row.averagePowerW))) {
      const direct=pm5.directlyObservedIntervals;
      const derived=pm5.derivedFifthInterval;
      const intervals=[...direct,...(derived&&positive(derived.round)&&positive(derived.durationSeconds)&&positive(derived.averagePowerWApprox)?[derived]:[])];
      if (validLaps && laps.every(lap=>intervals.some(item=>Number(item.round)===Number(lap.round)))) metrics.preFatigueOutput={direct,derived:derived || null};
    }
    const refs = observationRefs([...plans,...actualRows,...feedbackRows,...sessionEvents]);
    const observation = {
      sessionId:session.session_id,observedOn:String(session.local_date).slice(0,10),protocolFamilyId:familyId,
      protocolVersion:plan.protocolVersion || plan.prescription?.protocolVersion || family.protocolVersion,
      comparisonClass,executionStatus:session.status,benchmarkExact:false,sourceRefs:refs,
      reportedLimitations:feedback.benchmarkLimitations || [],
      limitations:['Measurement availability does not establish benchmark fidelity or objective attainment.'],
      metrics,recoveryContext,kind:'PROTOCOL_EXECUTION'
    };
    executions.push(observation);
    if (!['BENCHMARK_EXACT','FAMILY_COMPARABLE'].includes(comparisonClass)) continue;
    for (const binding of PROTOCOL_MEASUREMENT_BINDINGS[familyId] || []) {
      if (!binding.metrics.every(metric=>family.comparisonMetrics.includes(metric) && hasValue(metrics[metric])) || !binding.capture.every(name=>hasValue(metrics[name]))) continue;
      // A generic steady aerobic session may be cycling, so require actual running evidence.
      if(binding.key==='CONTROLLED_STEADY_RUN' && !/^run(?:ning)?$/i.test(actual.sportType || session.sport_type || '')) continue;
      add(binding.key,observation);
      for (const capability of binding.capabilities) add(`CAPABILITY:${capability}`,{...observation,kind:`TRANSFER:${binding.key}`,transfer:'CAPABILITY_EVIDENCE_NOT_EVENT_EQUIVALENCE'});
    }
    const hybrid = ['COMPROMISED_RUNNING_REPEATABILITY','HYBRID_TRANSITION_ECONOMY','WALL_BALL_TOLERANCE','STATION_WORK_RATE','STRENGTH_ENDURANCE_REPEATABILITY'].includes(familyId);
    if (hybrid) {
      for (const event of sessionEvents) {
        if (event.event_type === 'NEXT_DAY_RESPONSE' && (event.summary || nonempty(event.payload))) add('NEXT_DAY_RESPONSE',{...observation,kind:'LINKED_NEXT_DAY_RESPONSE',sourceRefs:observationRefs([event])});
      }
    }
  }
  // Use the existing matched protocol derivation rather than matching a session title.
  for (const row of trends?.performance?.matchedAet || []) {
    const observedOn = row.date || row.localDate;
    if (!withinWindow(observedOn,asOf) || !row.sessionId || !positive(row.powerHr) || !['MATCHED','MATCHED_CAVEAT'].includes(row.comparison)) continue;
    const observation={kind:'MATCHED_AET',sessionId:row.sessionId || row.date,observedOn:observedOn || null,sourceRefs:[`matched-aet:${row.sessionId || row.date}`],metrics:row};
    add('MATCHED_RUN_AET',observation);
    add('CAPABILITY:running_economy',observation);
  }
  return {version:MEASUREMENT_EVIDENCE_VERSION,evidence,fingerprint:measurementEvidenceFingerprint(evidence),executions,diagnostics,coverage:{sourceStatus:range.unavailable?'UNAVAILABLE':'AVAILABLE',lookbackDays:MEASUREMENT_LOOKBACK_DAYS,asOf,unmappedFamilies:Object.entries(PROTOCOL_MEASUREMENT_BINDINGS).filter(([,rules])=>!rules.length).map(([id])=>id)}};
}

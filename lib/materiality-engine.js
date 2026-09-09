export const MATERIALITY_ENGINE_VERSION = '4.1.0';
export const MATERIALITY_LEVELS = Object.freeze([
  'RECORD_ONLY',
  'UPDATE_STATE',
  'RECOMPUTE_RECOMMENDATION',
  'SAFETY_OVERRIDE'
]);
export const MATERIALITY_SOURCE_TYPES = Object.freeze([
  'ATHLETE_FEEDBACK',
  'TRAINING_EXECUTION',
  'WELLNESS_OBSERVATION',
  'SYSTEM_RECONCILIATION'
]);

const LEVEL_RANK = Object.freeze({
  RECORD_ONLY: 0,
  UPDATE_STATE: 1,
  RECOMPUTE_RECOMMENDATION: 2,
  SAFETY_OVERRIDE: 3
});

function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }
function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function hasAny(haystack, expressions) { return expressions.some(expression => expression.test(haystack)); }
function arrays(value) { return Array.isArray(value) ? value : []; }

function symptomRating(haystack, labels) {
  const joined = labels.join('|');
  const after = new RegExp(`(?:${joined})[^0-9]{0,18}(10|[0-9](?:\\.[0-9])?)\\s*\\/\\s*10`, 'i').exec(haystack);
  if (after) return Number(after[1]);
  const before = new RegExp(`(10|[0-9](?:\\.[0-9])?)\\s*\\/\\s*10[^a-z]{0,8}(?:${joined})`, 'i').exec(haystack);
  return before ? Number(before[1]) : null;
}

function normalizeSignals(input, haystack) {
  const supplied = input.signals && typeof input.signals === 'object' ? input.signals : {};
  const painScore = number(supplied.painScore) ?? symptomRating(haystack, ['pain', 'knee', 'hand', 'finger', 'hamstring', 'calf', 'ankle', 'shoulder', 'back']);
  const domsScore = number(supplied.domsScore) ?? symptomRating(haystack, ['doms', 'soreness', 'sore', 'quads', 'legs']);
  const rpe = number(supplied.rpe);
  return {
    safetyFlag: supplied.safetyFlag === true,
    recommendationConflict: supplied.recommendationConflict === true,
    painScore,
    domsScore,
    rpe,
    hrvDeltaPct: number(supplied.hrvDeltaPct),
    rhrDeltaBpm: number(supplied.rhrDeltaBpm),
    sleepScoreDelta: number(supplied.sleepScoreDelta),
    bodyBatteryDelta: number(supplied.bodyBatteryDelta),
    loadDeltaPct: number(supplied.loadDeltaPct),
    expectedness: upper(supplied.expectedness),
    constraintSeverity: upper(supplied.constraintSeverity),
    illnessSeverity: upper(supplied.illnessSeverity),
    giSeverity: upper(supplied.giSeverity)
  };
}

function domainsFromCategories(categories) {
  const domains = new Set();
  for (const category of categories) {
    if (category === 'STATE') domains.add('CURRENT_STATE');
    if (category === 'SESSION') domains.add('TRAINING_RESPONSE');
    if (category === 'COST') { domains.add('RECOVERY'); domains.add('LOAD'); }
    if (category === 'RECOVERY') { domains.add('RECOVERY'); domains.add('CURRENT_STATE'); }
    if (category === 'FUELING') domains.add('FUELING');
    if (category === 'CONSTRAINT') domains.add('CONSTRAINTS');
    if (category === 'HYPOTHESIS') domains.add('LEARNING');
  }
  return domains;
}

export function evaluateMateriality(input = {}) {
  const sourceType = upper(input.sourceType || 'ATHLETE_FEEDBACK');
  if (!MATERIALITY_SOURCE_TYPES.includes(sourceType)) throw new Error(`invalid_materiality_source_type:${sourceType}`);
  const eventType = upper(input.eventType);
  const certainty = upper(input.certainty || 'OBSERVED');
  const categories = arrays(input.categories).map(upper).filter(Boolean);
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const haystack = `${text(input.summary)} ${text(input.rawText)} ${JSON.stringify(payload)}`.toLowerCase();
  const signals = normalizeSignals(input, haystack);
  const reasons = new Set();
  const domains = domainsFromCategories(categories);
  let level = 'RECORD_ONLY';

  function escalate(nextLevel, reason, extraDomains = []) {
    if (LEVEL_RANK[nextLevel] > LEVEL_RANK[level]) level = nextLevel;
    if (reason) reasons.add(reason);
    for (const domain of extraDomains) domains.add(domain);
  }

  const hypothesisOnly = certainty === 'HYPOTHESIS' && categories.every(category => ['HYPOTHESIS','FUELING'].includes(category));
  if (hypothesisOnly) {
    reasons.add('HYPOTHESIS_NOT_PROMOTED');
    domains.add('LEARNING');
    return result();
  }
  if (certainty === 'HYPOTHESIS') reasons.add('HYPOTHESIS_NOT_PROMOTED');

  const safetyText = hasAny(haystack, [
    /\bchest pain\b/,
    /\b(loss of consciousness|fainted|fainting)\b/,
    /\b(can(?:not|'t) bear weight)\b/,
    /\b(sudden|severe) sharp pain\b/,
    /\bunable to continue because of pain\b/
  ]);
  if (signals.safetyFlag || safetyText || (signals.painScore !== null && signals.painScore >= 8)) {
    escalate('SAFETY_OVERRIDE', 'SAFETY_RED_FLAG', ['CONSTRAINTS','NEXT_SESSION']);
  }

  if (signals.recommendationConflict) {
    escalate('RECOMPUTE_RECOMMENDATION', 'RECOMMENDATION_CONFLICT', ['NEXT_SESSION']);
  }

  if (['STOPPED_EARLY','ABORTED','SKIPPED'].includes(eventType)) {
    const code = eventType === 'STOPPED_EARLY' ? 'SESSION_STOPPED_EARLY' : eventType === 'ABORTED' ? 'SESSION_ABORTED' : 'SESSION_SKIPPED';
    escalate('RECOMPUTE_RECOMMENDATION', code, ['TRAINING_RESPONSE','RECOVERY','NEXT_SESSION']);
  }
  if (eventType === 'ATHLETE_MODIFIED') {
    escalate('RECOMPUTE_RECOMMENDATION', 'SESSION_MATERIALLY_MODIFIED', ['TRAINING_RESPONSE','NEXT_SESSION']);
  }
  if (['EXECUTED','COMPLETED'].includes(eventType) || sourceType === 'TRAINING_EXECUTION') {
    escalate('UPDATE_STATE', 'SESSION_EXECUTION_OBSERVED', ['TRAINING_RESPONSE','LOAD']);
  }

  const currentStateEvent = ['CONTEXT','NEXT_DAY_RESPONSE'].includes(eventType) || categories.some(category => ['STATE','RECOVERY','CONSTRAINT','COST'].includes(category));
  if (sourceType === 'ATHLETE_FEEDBACK' && currentStateEvent) {
    escalate('UPDATE_STATE', 'ATHLETE_CURRENT_STATE_RELEVANT', ['CURRENT_STATE']);
  }

  const materialNegative = hasAny(haystack, [
    /\bmuch (worse|harder) than expected\b/,
    /\bunusually hard\b/,
    /\bfelt (?:pretty |really |very )?hard\b/,
    /\bnot fully recovered\b/,
    /\bheavy legs\b/,
    /\bexhausted\b/,
    /\bsevere (?:stomach |abdominal )?cramps?\b/,
    /\bmassive stomach cramps?\b/
  ]);
  const materialPositive = hasAny(haystack, [
    /\bmuch better than expected\b/,
    /\bsurprisingly fresh\b/,
    /\bexceptionally good\b/,
    /\bfar easier than expected\b/,
    /\b100% fresh\b/,
    /\bfully recovered\b/
  ]) || ['MUCH_EASIER','MUCH_BETTER'].includes(signals.expectedness);

  if (materialNegative || ['MUCH_HARDER','MUCH_WORSE'].includes(signals.expectedness)) {
    if (eventType === 'POST_SESSION_FEEDBACK' || eventType === 'NEXT_DAY_RESPONSE' || categories.includes('RECOVERY')) {
      escalate('RECOMPUTE_RECOMMENDATION', 'ATHLETE_RESPONSE_MATERIAL_NEGATIVE', ['RECOVERY','NEXT_SESSION']);
    } else {
      escalate('UPDATE_STATE', 'ATHLETE_STATE_MATERIAL_NEGATIVE', ['CURRENT_STATE','RECOVERY']);
    }
  }
  if (materialPositive) {
    if (eventType === 'NEXT_DAY_RESPONSE') {
      escalate('RECOMPUTE_RECOMMENDATION', 'ATHLETE_RESPONSE_MATERIAL_POSITIVE', ['RECOVERY','NEXT_SESSION']);
    } else {
      escalate('UPDATE_STATE', 'ATHLETE_STATE_MATERIAL_POSITIVE', ['CURRENT_STATE','RECOVERY']);
    }
  }

  const resolvedConstraint = hasAny(haystack, [
    /\bno gi issues?\b/,
    /\bno pain\b/,
    /\bpain[- ]?free\b/,
    /\b(?:symptom|issue|constraint) (?:has )?resolved\b/,
    /\bhand (?:is )?completely fine\b/
  ]);
  if (resolvedConstraint) {
    escalate('UPDATE_STATE', 'CONSTRAINT_REPORTED_RESOLVED', ['CONSTRAINTS','CURRENT_STATE']);
  }

  if (signals.painScore !== null) {
    domains.add('CONSTRAINTS');
    if (signals.painScore >= 7) escalate('RECOMPUTE_RECOMMENDATION', 'PAIN_HIGH', ['NEXT_SESSION']);
    else if (signals.painScore >= 3) escalate('UPDATE_STATE', 'PAIN_MODERATE');
  }
  if (signals.domsScore !== null) {
    domains.add('RECOVERY');
    if (signals.domsScore >= 7) escalate('RECOMPUTE_RECOMMENDATION', 'DOMS_HIGH', ['NEXT_SESSION']);
    else if (signals.domsScore >= 3) escalate('UPDATE_STATE', 'DOMS_MODERATE');
  }
  if (signals.rpe !== null && signals.rpe >= 9) {
    escalate('RECOMPUTE_RECOMMENDATION', 'SESSION_RPE_VERY_HIGH', ['RECOVERY','NEXT_SESSION']);
  }
  if (['SEVERE','HIGH'].includes(signals.constraintSeverity) || ['SEVERE','HIGH'].includes(signals.illnessSeverity)) {
    escalate('RECOMPUTE_RECOMMENDATION', 'CURRENT_CONSTRAINT_HIGH', ['CONSTRAINTS','NEXT_SESSION']);
  }
  if (['SEVERE','HIGH'].includes(signals.giSeverity)) {
    escalate('RECOMPUTE_RECOMMENDATION', 'GI_LIMITER_HIGH', ['CONSTRAINTS','RECOVERY','NEXT_SESSION']);
  }
  if (signals.loadDeltaPct !== null && Math.abs(signals.loadDeltaPct) >= 30) {
    escalate('RECOMPUTE_RECOMMENDATION', 'TRAINING_LOAD_MATERIAL_DELTA', ['LOAD','NEXT_SESSION']);
  }

  if (sourceType === 'WELLNESS_OBSERVATION') {
    domains.add('RECOVERY');
    domains.add('CURRENT_STATE');
    const adverse = [
      signals.hrvDeltaPct !== null && signals.hrvDeltaPct <= -15,
      signals.rhrDeltaBpm !== null && signals.rhrDeltaBpm >= 7,
      signals.sleepScoreDelta !== null && signals.sleepScoreDelta <= -15,
      signals.bodyBatteryDelta !== null && signals.bodyBatteryDelta <= -20
    ].filter(Boolean).length;
    const positive = [
      signals.hrvDeltaPct !== null && signals.hrvDeltaPct >= 15,
      signals.rhrDeltaBpm !== null && signals.rhrDeltaBpm <= -5,
      signals.sleepScoreDelta !== null && signals.sleepScoreDelta >= 15,
      signals.bodyBatteryDelta !== null && signals.bodyBatteryDelta >= 20
    ].filter(Boolean).length;
    if (adverse >= 2) escalate('RECOMPUTE_RECOMMENDATION', 'WELLNESS_MULTI_SIGNAL_DETERIORATION', ['NEXT_SESSION']);
    else if (adverse === 1) escalate('UPDATE_STATE', 'WELLNESS_SINGLE_SIGNAL_CHANGE');
    if (positive >= 2) escalate('RECOMPUTE_RECOMMENDATION', 'WELLNESS_MULTI_SIGNAL_IMPROVEMENT', ['NEXT_SESSION']);
    else if (positive === 1) escalate('UPDATE_STATE', 'WELLNESS_SINGLE_SIGNAL_CHANGE');
    if (adverse === 0 && positive === 0 && level === 'RECORD_ONLY') reasons.add('WELLNESS_CHANGE_BELOW_MATERIAL_THRESHOLD');
  }

  if (!reasons.size) reasons.add('NO_MATERIAL_CHANGE_DETECTED');
  return result();

  function result() {
    const shouldUpdateState = LEVEL_RANK[level] >= LEVEL_RANK.UPDATE_STATE;
    const shouldRecomputeRecommendation = LEVEL_RANK[level] >= LEVEL_RANK.RECOMPUTE_RECOMMENDATION;
    return {
      engineVersion: MATERIALITY_ENGINE_VERSION,
      level,
      rank: LEVEL_RANK[level],
      sourceType,
      reasonCodes: [...reasons],
      affectedDomains: [...domains],
      shouldUpdateState,
      shouldRecomputeRecommendation,
      blocksExistingRecommendation: level === 'SAFETY_OVERRIDE',
      certainty,
      signals
    };
  }
}

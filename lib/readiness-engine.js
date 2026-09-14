export const READINESS_ENGINE_VERSION = '5.0.0-readiness.1';
export const READINESS_STATE_CONTEXT = 'READINESS_STATE';
export const READINESS_BANDS = Object.freeze([
  { min: 85, max: 100, label: 'PROCEED' },
  { min: 70, max: 84, label: 'PROCEED WITH CONTROL' },
  { min: 55, max: 69, label: 'MODIFY' },
  { min: 40, max: 54, label: 'FALL BACK' },
  { min: 0, max: 39, label: 'RECOVER' }
]);

const COMPONENTS = Object.freeze({
  hrv: { key: 'hrvLastNight', weight: 0.25, direction: 1, label: 'HRV' },
  rhr: { key: 'restingHeartRate', weight: 0.20, direction: -1, label: 'Resting HR' },
  sleepHours: { key: 'sleepHours', weight: 0.20, direction: 1, label: 'Sleep duration' },
  sleepScore: { key: 'sleepScore', weight: 0.20, direction: 1, label: 'Sleep score' },
  bodyBatteryHigh: { key: 'bodyBatteryHigh', weight: 0.15, direction: 1, label: 'Body Battery high' }
});

function n(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value, places = 1) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
function mean(values = []) {
  const xs = values.map(n).filter(value => value !== null);
  return xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
}
function sampleSd(values = []) {
  const xs = values.map(n).filter(value => value !== null);
  if (xs.length < 2) return null;
  const avg = mean(xs);
  return Math.sqrt(xs.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (xs.length - 1));
}
function bandForScore(score) {
  if (!Number.isFinite(score)) return null;
  return READINESS_BANDS.find(band => score >= band.min && score <= band.max)?.label || null;
}
function words(value) { return Array.isArray(value) ? value.map(x => String(x || '').toUpperCase()).filter(Boolean) : []; }

export function buildReadinessBaselines(history = []) {
  const baselines = {};
  for (const [id, definition] of Object.entries(COMPONENTS)) {
    const values = (history || []).map(row => n(row?.[definition.key]));
    const valid = values.filter(value => value !== null);
    baselines[id] = {
      label: definition.label,
      validN: valid.length,
      mean: round(mean(valid), 3),
      sd: round(sampleSd(valid), 3)
    };
  }
  return baselines;
}

function componentScore(value, baseline, direction) {
  const x = n(value);
  const avg = n(baseline?.mean);
  const sd = n(baseline?.sd);
  if (x === null || avg === null || sd === null || sd <= 0 || Number(baseline?.validN || 0) < 5) return null;
  const z = clamp(direction * ((x - avg) / sd), -2.5, 2.5);
  return { z: round(z, 2), score: round(clamp(75 + (10 * z), 50, 100), 1) };
}

function acuteAdverseFlags(current = {}, components = {}) {
  const flags = [];
  const sleepHours = n(current.sleepHours), sleepScore = n(current.sleepScore), battery = n(current.bodyBatteryHigh);
  if (sleepHours !== null && sleepHours < 5) flags.push('SLEEP_DURATION_VERY_LOW');
  if (sleepScore !== null && sleepScore < 50) flags.push('SLEEP_SCORE_VERY_LOW');
  if (battery !== null && battery < 45) flags.push('BODY_BATTERY_HIGH_VERY_LOW');
  for (const [id, component] of Object.entries(components)) if (n(component?.z) !== null && component.z <= -1.75) flags.push(`${id.toUpperCase()}_ADVERSE_DEVIATION`);
  return [...new Set(flags)];
}

export function readinessModifierFromAthleteContext({ athleteEvent = null, materiality = null } = {}) {
  const categories = words(athleteEvent?.payload?.memoryCategories);
  const reasons = words(materiality?.reasonCodes || materiality?.materiality?.reasonCodes);
  const level = String(materiality?.level || materiality?.materiality?.level || '').toUpperCase();
  const summary = String(athleteEvent?.summary || '').toLowerCase();
  const relevant = categories.some(category => ['STATE','RECOVERY','CONSTRAINT','COST'].includes(category));
  if (!athleteEvent || !relevant) {
    return { type: 'NONE', adjustment: 0, cap: null, confidenceEffect: 'MISSING_LOCAL_CONTEXT', evidence: [] };
  }

  if (level === 'SAFETY_OVERRIDE' || reasons.includes('SAFETY_RED_FLAG')) {
    return { type: 'SAFETY_OVERRIDE', adjustment: 0, cap: 39, confidenceEffect: 'DIRECT_CONSTRAINT', evidence: reasons };
  }
  if (reasons.some(code => ['PAIN_HIGH','DOMS_HIGH','GI_LIMITER_HIGH','CURRENT_CONSTRAINT_HIGH','ATHLETE_RESPONSE_MATERIAL_NEGATIVE'].includes(code))) {
    return { type: 'HIGH_CONSTRAINT', adjustment: -8, cap: 54, confidenceEffect: 'DIRECT_CONSTRAINT', evidence: reasons };
  }
  if (reasons.some(code => ['PAIN_MODERATE','DOMS_MODERATE','ATHLETE_STATE_MATERIAL_NEGATIVE'].includes(code))) {
    return { type: 'MODERATE_CONSTRAINT', adjustment: -5, cap: 69, confidenceEffect: 'DIRECT_CONSTRAINT', evidence: reasons };
  }
  if (reasons.some(code => ['CONSTRAINT_REPORTED_RESOLVED','ATHLETE_RESPONSE_MATERIAL_POSITIVE','ATHLETE_STATE_MATERIAL_POSITIVE'].includes(code)) || /\b(fresh|fully recovered|no pain|no gi issues?|feeling (?:really )?good)\b/.test(summary)) {
    return { type: 'POSITIVE_CURRENT_STATE', adjustment: 3, cap: 95, confidenceEffect: 'DIRECT_CURRENT_STATE', evidence: reasons };
  }
  return { type: 'CURRENT_STATE_REPORTED', adjustment: 0, cap: null, confidenceEffect: 'DIRECT_CURRENT_STATE', evidence: reasons };
}

function systemicNarrative(score, flags = []) {
  if (score === null) return 'Current systemic readiness cannot be scored reliably from the available canonical evidence.';
  if (flags.length >= 3) return 'Current systemic recovery is materially constrained by several concordant recovery signals.';
  if (score >= 85) return 'Current systemic recovery is strong and broadly supportive.';
  if (score >= 70) return 'Current systemic recovery is supportive, with some restraint still appropriate.';
  if (score >= 55) return 'Current systemic recovery is mixed; recovery cost should stay controlled.';
  if (score >= 40) return 'Current systemic recovery is weak enough to favour a lower-cost fallback.';
  return 'Current systemic recovery is poor and favours recovery over training stress.';
}

function localNarrative(modifier) {
  if (modifier.type === 'SAFETY_OVERRIDE') return 'Current Athlete Voice contains a safety-level constraint that overrides otherwise favourable physiology.';
  if (modifier.type === 'HIGH_CONSTRAINT') return 'Current Athlete Voice contains a high local/recovery constraint that materially limits readiness.';
  if (modifier.type === 'MODERATE_CONSTRAINT') return 'Current Athlete Voice contains a moderate local/recovery constraint that tempers readiness.';
  if (modifier.type === 'POSITIVE_CURRENT_STATE') return 'Current Athlete Voice supports normal function and resolves or improves a previously relevant constraint.';
  if (modifier.type === 'CURRENT_STATE_REPORTED') return 'Current Athlete Voice is available and does not add a material readiness constraint.';
  return 'No current athlete-reported local/function state is captured; local readiness remains unconfirmed rather than inferred from wearable data.';
}

export function evaluateReadiness({ localDate, current = {}, history = [], athleteEvent = null, materiality = null } = {}) {
  const baselines = buildReadinessBaselines(history);
  const components = {};
  let weighted = 0, weight = 0;
  for (const [id, definition] of Object.entries(COMPONENTS)) {
    const value = n(current?.[definition.key]);
    const result = componentScore(value, baselines[id], definition.direction);
    components[id] = {
      label: definition.label,
      value,
      weight: definition.weight,
      baseline: baselines[id],
      z: result?.z ?? null,
      score: result?.score ?? null
    };
    if (result) { weighted += result.score * definition.weight; weight += definition.weight; }
  }

  const available = Object.values(components).filter(component => component.score !== null);
  const hasAutonomic = components.hrv.score !== null || components.rhr.score !== null;
  const hasSleep = components.sleepHours.score !== null || components.sleepScore.score !== null;
  const sufficient = available.length >= 3 && hasAutonomic && hasSleep;
  let systemicScore = sufficient ? weighted / weight : null;
  const adverseFlags = acuteAdverseFlags(current, components);
  if (systemicScore !== null) {
    if (adverseFlags.length >= 4) systemicScore -= 12;
    else if (adverseFlags.length >= 3) systemicScore -= 7;
    systemicScore = clamp(systemicScore, 0, 100);
  }

  const modifier = readinessModifierFromAthleteContext({ athleteEvent, materiality });
  let finalScore = systemicScore;
  if (finalScore !== null) {
    finalScore += modifier.adjustment;
    if (modifier.cap !== null) finalScore = Math.min(finalScore, modifier.cap);
    finalScore = Math.round(clamp(finalScore, 0, 100));
  }

  const baselineN = Math.min(...Object.values(baselines).filter(item => item.validN > 0).map(item => item.validN));
  const missingComponents = Object.entries(components).filter(([, value]) => value.score === null).map(([id]) => id);
  let confidence = 'LOW';
  if (sufficient && baselineN >= 14) confidence = modifier.confidenceEffect === 'MISSING_LOCAL_CONTEXT' ? 'MODERATE' : 'HIGH';
  else if (sufficient) confidence = 'MODERATE';

  return {
    schemaVersion: '1.0',
    contextType: READINESS_STATE_CONTEXT,
    engineVersion: READINESS_ENGINE_VERSION,
    localDate: localDate || null,
    status: finalScore === null ? 'WITHHELD' : 'READY',
    score: finalScore,
    band: bandForScore(finalScore),
    systemicScore: systemicScore === null ? null : round(systemicScore, 1),
    confidence,
    systemicState: systemicNarrative(finalScore, adverseFlags),
    localTissueState: localNarrative(modifier),
    components,
    modifier,
    adverseFlags,
    uncertainty: {
      missingComponents,
      localStateMissing: modifier.confidenceEffect === 'MISSING_LOCAL_CONTEXT',
      baselineMaturity: baselineN >= 28 ? 'MATURE' : baselineN >= 14 ? 'ESTABLISHED' : baselineN >= 5 ? 'PROVISIONAL' : 'INSUFFICIENT',
      baselineValidN: Number.isFinite(baselineN) ? baselineN : 0
    },
    rules: {
      personalBaselineRelative: true,
      athleteVoiceCanOverrideSystemicSignals: true,
      missingSubjectiveStateIsNotAssumedNormal: true,
      scoreDoesNotReplaceRecommendationLane: true,
      staticRuntimeReadinessIsNotCanonicalCurrentTruth: true
    }
  };
}

export function mergeCanonicalReadinessIntoContext(context = {}, readiness = null) {
  if (!readiness || readiness.contextType !== READINESS_STATE_CONTEXT) return context;
  const recovery = {
    ...(context.recovery || {}),
    readinessScore: readiness.status === 'READY' ? n(readiness.score) : null,
    status: readiness.band || (readiness.status === 'WITHHELD' ? 'CURRENT READINESS WITHHELD' : context.recovery?.status || null),
    systemicState: readiness.systemicState || context.recovery?.systemicState || null,
    localConstraint: readiness.localTissueState || context.recovery?.localConstraint || null,
    readinessEngineVersion: readiness.engineVersion,
    readinessInputFingerprint: readiness.inputFingerprint || null,
    readinessConfidence: readiness.confidence || null,
    readinessLocalDate: readiness.localDate || null,
    runtimeReadinessFresh: false,
    runtimeReadinessDate: context.recovery?.runtimeReadinessDate || null
  };
  const missing = new Set(context.uncertainty?.missing || []);
  if (readiness.status === 'READY' && readiness.score !== null) missing.delete('current readiness score');
  else missing.add('current readiness score');
  return {
    ...context,
    recovery,
    uncertainty: { ...(context.uncertainty || {}), missing: [...missing] },
    evidence: [
      ...(context.evidence || []).filter(item => !String(item?.ref || '').startsWith('runtime:') || !/readiness/i.test(String(item?.ref || ''))),
      ...(readiness.status === 'READY' ? [{
        ref: `readiness:${readiness.engineVersion}:${readiness.localDate}`,
        fact: `Current canonical FZ Readiness is ${readiness.score} (${readiness.band}) with ${String(readiness.confidence || '').toLowerCase()} confidence.`,
        provenance: 'FZ canonical readiness engine',
        quality: 'DERIVED'
      }] : [])
    ],
    provenance: { ...(context.provenance || {}), readinessSource: readiness.status === 'READY' ? 'FZ_CANONICAL_READINESS' : 'FZ_READINESS_WITHHELD' }
  };
}

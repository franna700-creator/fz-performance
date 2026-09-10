const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const round = value => Math.round(clamp(value) * 1000) / 1000;
const uniq = values => [...new Set(values.filter(Boolean))];
const TRANSITION = { NONE:0, LOW:0.25, MODERATE:0.5, HIGH:0.75, VERY_HIGH:1 };

function movements(profile = {}) { return (profile.stations || []).map(row => String(row.movement || '').toUpperCase()); }
function tags(profile = {}) { return (profile.stations || []).flatMap(row => row.tags || []).map(x => String(x).toLowerCase()); }
function totalRun(profile = {}) { return Number(profile?.format?.totalRunMeters ?? profile?.format?.continuousRunMeters ?? 0) || 0; }
function runBouts(profile = {}) { return Number(profile?.format?.runSegments ?? (profile?.format?.continuousRunMeters ? 1 : 0)) || 0; }
function stationCount(profile = {}) { return Number(profile?.format?.stationCount ?? profile?.stations?.length ?? 0) || 0; }
function hasAny(values, patterns) { return values.some(value => patterns.some(pattern => value.includes(pattern))); }
function ratio(count, total, scale = 1) { return total ? round(Math.min(1, (count / total) * scale)) : 0; }

export function validateEventDemandTaxonomy(registry = {}) {
  const errors = [];
  if (registry.version !== '1.0') errors.push('taxonomy version must be 1.0');
  const ids = new Set();
  for (const dim of registry.dimensions || []) {
    if (!dim?.id || ids.has(dim.id)) errors.push(`duplicate/missing dimension ${dim?.id || 'missing'}`);
    ids.add(dim?.id);
    if (!dim.domain || !dim.type || !dim.description) errors.push(`${dim?.id} missing contract fields`);
    if (dim.type === 'SCORE' && JSON.stringify(dim.range) !== '[0,1]') errors.push(`${dim.id} score range must be [0,1]`);
  }
  return { ok: errors.length === 0, errors, dimensionCount: ids.size };
}

export function buildEventDemandTaxonomyProfile(profile = {}) {
  const format = profile.format || {};
  const stationTotal = stationCount(profile);
  const runTotal = totalRun(profile);
  const bouts = runBouts(profile);
  const mv = movements(profile);
  const tg = tags(profile);
  const transition = TRANSITION[format.transitionDensity] ?? (stationTotal ? 0.5 : 0);
  const hybrid = runTotal > 0 && stationTotal > 0;
  const loaded = (profile.stations || []).filter(row => row.load && row.load.implement !== 'BODYWEIGHT').length;
  const locomotion = mv.filter(x => /BURPEE|CRAWL|CARRY|LUNGE/.test(x)).length;
  const carry = mv.filter(x => x.includes('CARRY')).length;
  const squatLunge = mv.filter(x => /SQUAT|LUNGE/.test(x)).length;
  const hinge = mv.filter(x => /HINGE/.test(x)).length;
  const pushPull = mv.filter(x => /PUSH|PULL|SLED/.test(x)).length;
  const overhead = mv.filter(x => /OVERHEAD/.test(x)).length + tg.filter(x => x.includes('overhead')).length;
  const erg = mv.filter(x => x === 'ERG').length;
  const sled = mv.filter(x => x === 'SLED').length;
  const stationDensity = stationTotal ? clamp(stationTotal / Math.max(1, runTotal / 1000 || stationTotal)) : 0;
  const longContinuous = !hybrid && runTotal >= 18000;
  const runEconomy = runTotal >= 18000 ? 1 : runTotal >= 8000 ? 0.85 : runTotal >= 4500 ? 0.7 : runTotal > 0 ? 0.5 : 0;
  const aerobic = longContinuous ? 1 : hybrid && runTotal >= 7500 ? 0.9 : hybrid ? 0.75 : runTotal > 0 ? 0.65 : 0;
  const threshold = longContinuous ? 0.72 : hybrid ? 0.78 : runTotal > 0 ? 0.58 : 0;
  const muscular = stationTotal ? clamp(0.45 + ratio(loaded, stationTotal) * 0.35 + Math.min(0.2, stationTotal * 0.015)) : 0;
  const glycolytic = hybrid ? clamp(0.5 + transition * 0.25 + muscular * 0.2) : longContinuous ? 0.35 : runTotal > 0 ? 0.45 : 0;
  const tissue = stationTotal ? clamp(0.45 + ratio(loaded, stationTotal) * 0.32 + transition * 0.15) : runTotal >= 18000 ? 0.82 : runTotal > 0 ? 0.58 : 0;
  const scores = {
    'running.compromised': round(hybrid ? 0.68 + transition * 0.28 : 0),
    'running.economy': round(runEconomy),
    'running.aerobic_durability': round(aerobic),
    'running.threshold_aerobic_power': round(threshold),
    'work.station_density': round(stationDensity),
    'sequencing.mixed_modality_repeatability': round(hybrid ? 0.58 + transition * 0.32 : 0),
    'movement.locomotion': ratio(locomotion, stationTotal, 1.8),
    'movement.carry_grip': round(Math.max(ratio(carry, stationTotal, 2.5), hasAny(tg,['grip_endurance']) ? 0.65 : 0)),
    'movement.squat_lunge': ratio(squatLunge, stationTotal, 2.6),
    'movement.hinge_posterior_chain': round(Math.max(ratio(hinge, stationTotal, 2.5), hasAny(tg,['posterior_chain']) ? 0.6 : 0)),
    'movement.push_pull': ratio(pushPull, stationTotal, 2.5),
    'movement.overhead': round(Math.min(1, stationTotal ? overhead / stationTotal * 1.8 : 0)),
    'modality.erg': ratio(erg, stationTotal, 3.2),
    'modality.sled': ratio(sled, stationTotal, 3.5),
    'physiology.glycolytic_burden': round(glycolytic),
    'physiology.muscular_endurance': round(muscular),
    'pacing.interrupted': round(hybrid ? 0.7 + transition * 0.25 : 0),
    'tissue.local_cost': round(tissue)
  };
  return {
    taxonomyVersion:'1.0',
    profileId:profile.id || null,
    eventFamily:profile.eventFamily || null,
    eventSpecific:{variant:profile.variant || null, sourceAuthority:profile.sourceAuthority || null, dominantDemands:uniq(profile.dominantDemands || [])},
    structure:{
      'running.mode':runTotal ? (hybrid ? 'INTERRUPTED' : 'CONTINUOUS') : 'NONE',
      'running.total_distance_m':runTotal || null,
      'running.bout_count':bouts || null,
      'running.typical_bout_m':Number(format.runSegmentMeters ?? (bouts === 1 ? runTotal : 0)) || null,
      'work.station_count':stationTotal,
      'transition.frequency':format.transitionDensity || (stationTotal ? 'MODERATE' : 'NONE')
    },
    scores
  };
}

export function compareTaxonomyProfiles(from, target) {
  const a = from?.scores || {}, b = target?.scores || {};
  const rows = [];
  for (const [dimensionId, targetDemand] of Object.entries(b)) {
    if (targetDemand <= 0.15) continue;
    const fromDemand = Number(a[dimensionId] || 0);
    rows.push({dimensionId, from:round(fromDemand), target:round(targetDemand), coverage:round(Math.min(1, fromDemand / targetDemand))});
  }
  rows.sort((x,y)=>y.target-x.target || y.coverage-x.coverage);
  return {
    diagnosticOnly:true,
    authoritativeTransferScore:false,
    shared:rows.filter(x=>x.coverage>=0.5),
    gaps:rows.filter(x=>x.coverage<0.5),
    interchangeable:from?.profileId === target?.profileId,
    rule:'EVENT_INTELLIGENCE_OWNS_DIRECTIONAL_TRANSFER_SCORE'
  };
}

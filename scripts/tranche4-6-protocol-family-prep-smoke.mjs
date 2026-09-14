import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MEASUREMENT_PRIORITY_BY_LANE,
  SESSION_PROTOCOL_FAMILIES,
  protocolFamilyForOption,
  laneRequiresProtocolFamily
} from '../lib/session-protocol-family-registry.js';

assert.equal(MEASUREMENT_PRIORITY_BY_LANE.ABSORB,'LOW');
assert.equal(MEASUREMENT_PRIORITY_BY_LANE.MAINTAIN,'HIGH');
assert.equal(MEASUREMENT_PRIORITY_BY_LANE.ADAPT,'VERY_HIGH');
assert.equal(laneRequiresProtocolFamily('ABSORB'),false);
assert.equal(laneRequiresProtocolFamily('MAINTAIN'),true);
assert.equal(laneRequiresProtocolFamily('ADAPT'),true);

const maintainKeys=['steady-aerobic','strength-maintenance','hybrid-technique'];
for(const key of maintainKeys){
  const family=protocolFamilyForOption({lane:'MAINTAIN',optionKey:key,targetedGaps:[]});
  assert(family,`MAINTAIN option ${key} must have protocol family coverage`);
  assert.equal(family.lane,'MAINTAIN');
  assert.notEqual(family.defaultComparisonClass,'TRAINING_ONLY',`${key} should retain longitudinal value`);
}

const adaptCases=[
  ['compromised-repeatability',['running.compromised_repeatability'],'COMPROMISED_RUNNING_REPEATABILITY'],
  ['matched-run-aet',['running.controlled_efficiency'],'MATCHED_RUN_AET'],
  ['wall-ball-tolerance',['station.wall_ball_tolerance'],'WALL_BALL_TOLERANCE'],
  ['erg-efficiency',['station.erg_efficiency'],'ERG_EFFICIENCY'],
  ['station-work-rate',['station.sled_capability'],'STATION_WORK_RATE'],
  ['station-work-rate',['strength_endurance.repeatability'],'STRENGTH_ENDURANCE_REPEATABILITY'],
  ['targeted-quality',[],'TARGETED_QUALITY_TRAINING_ONLY']
];
for(const [optionKey,targetedGaps,expected] of adaptCases){
  const family=protocolFamilyForOption({lane:'ADAPT',optionKey,targetedGaps});
  assert(family,`ADAPT option ${optionKey} must resolve to an explicit family or training-only fallback`);
  assert.equal(family.protocolFamilyId,expected);
  assert.equal(family.lane,'ADAPT');
}
assert.equal(SESSION_PROTOCOL_FAMILIES.TARGETED_QUALITY_TRAINING_ONLY.defaultComparisonClass,'TRAINING_ONLY','generic ADAPT fallback must never masquerade as benchmark-comparable');

const composer=fs.readFileSync('lib/session-option-composer.js','utf8');
for(const key of [...maintainKeys,'compromised-repeatability','matched-run-aet','wall-ball-tolerance','erg-efficiency','station-work-rate','targeted-quality']){
  assert(composer.includes(`'${key}'`),`prep coverage key ${key} must still correspond to a current 4.4 composer option`);
}

console.log('PASS Tranche 4.6 protocol-family prep: ABSORB low measurement pressure; MAINTAIN/ADAPT explicit longitudinal coverage');

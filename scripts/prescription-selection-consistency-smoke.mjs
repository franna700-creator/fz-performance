import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIntelligenceCurrent } from '../lib/intelligence-current.js';
import { SESSION_OPTION_COMPOSER_VERSION } from '../lib/session-option-composer.js';
import { attachSessionPrescriptions, SESSION_PRESCRIPTION_COMPOSER_VERSION } from '../lib/session-prescription-resolver.js';
import { CURRENT_RECOVERY_FRESHNESS_POLICY } from '../lib/current-state-contract.js';

const shadow={
  id:1,
  source_updated_at:'2026-09-14T10:00:00.000Z',
  payload:{
    contextType:'RECOMMENDATION_SHADOW',
    recommendationId:'shadow:test',
    contextFingerprint:'ctx:test',
    status:'READY',
    lane:'MAINTAIN',
    contextSummary:{recovery:{freshnessPolicyVersion:CURRENT_RECOVERY_FRESHNESS_POLICY}}
  }
};

const staleActive={
  id:2,
  source_updated_at:'2026-09-14T10:01:00.000Z',
  payload:{
    contextType:'ACTIVE_RECOMMENDATION',
    shadowRecommendationId:'shadow:test',
    contextFingerprint:'ctx:test',
    status:'READY',
    fzRecommendedLane:'MAINTAIN',
    sessionOptionComposerVersion:SESSION_OPTION_COMPOSER_VERSION,
    lanes:{ABSORB:[],MAINTAIN:[{optionId:'option:test:maintain:steady-aerobic:legacy',title:'Controlled steady aerobic'}],ADAPT:[]}
  }
};

const stale=buildIntelligenceCurrent({shadowRecommendation:shadow,activeRecommendation:staleActive});
assert.equal(stale.pending.activeRecommendation,true,'pre-4.6 active recommendation without prescription version must invalidate');
assert.equal(stale.dependencyState.sessionPrescriptionComposerCurrent,false,'missing prescription projection must be exposed as stale');
assert.equal(stale.markers.sessionPrescriptionComposerVersion,SESSION_PRESCRIPTION_COMPOSER_VERSION,'current intelligence must expose prescription composer version');

const steadyOption={
  optionId:`option:${SESSION_OPTION_COMPOSER_VERSION}:maintain:steady-aerobic:test`,
  title:'Controlled steady aerobic',
  objective:'Preserve aerobic and running capability without adding a material new recovery burden.',
  dose:'40–60 min controlled steady work · RPE 3–4 · no threshold finish',
  expectedCost:'LOW_TO_MODERATE',
  targetedGaps:[]
};
const lanes=attachSessionPrescriptions({ABSORB:[],MAINTAIN:[steadyOption],ADAPT:[]},shadow.payload);
const prescription=lanes.MAINTAIN[0].prescription;
assert.equal(prescription.protocolFamilyId,'STEADY_AEROBIC_EFFICIENCY','controlled steady aerobic must resolve to its existing 4.6 protocol family');
assert.equal(prescription.selectionReady,true,'controlled steady aerobic prescription must be execution-ready');
assert.equal(prescription.composerVersion,SESSION_PRESCRIPTION_COMPOSER_VERSION,'resolved prescription must use current composer version');
assert.ok(prescription.prescriptionFingerprint,'resolved prescription must be fingerprinted');

const freshActive={
  ...staleActive,
  id:3,
  source_updated_at:'2026-09-14T10:02:00.000Z',
  payload:{
    ...staleActive.payload,
    sessionPrescriptionComposerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION,
    lanes
  }
};
const fresh=buildIntelligenceCurrent({shadowRecommendation:shadow,activeRecommendation:freshActive});
assert.equal(fresh.pending.activeRecommendation,false,'current fingerprinted prescription projection must satisfy the active recommendation contract');
assert.equal(fresh.dependencyState.sessionPrescriptionComposerCurrent,true,'current prescription projection must be exposed as current');

const ui=fs.readFileSync('src/adaptive-choice.js','utf8');
assert.match(ui,/function selectionReady\(option,lane\)/,'browser must have an explicit prescription readiness guard');
assert.match(ui,/p\.selectionReady!==true\|\|!p\.prescriptionFingerprint/,'browser must fail closed for missing/non-ready prescriptions');
assert.match(ui,/\['MAINTAIN','ADAPT'\]\.includes\(lane\)&&!p\.protocolFamilyId/,'Maintain/Adapt selection must require a protocol family');
assert.match(ui,/FZ is reconciling this option to the current prescription version/,'stale projection must show a human-facing disabled state');
assert.match(ui,/choiceErrorMessage\(error\)/,'server prescription errors must not leak raw internal codes to the athlete');

console.log('PASS 4.6 prescription selection consistency: stale projection invalidates, steady aerobic resolves, browser fails closed');

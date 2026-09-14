import crypto from 'node:crypto';
import { protocolFamilyForOption, MEASUREMENT_PRIORITY_BY_LANE } from './session-protocol-family-registry.js';

export const SESSION_PRESCRIPTION_COMPOSER_VERSION='4.6.0-prescription.1';

function stable(value){if(Array.isArray(value))return value.map(stable);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function optionKey(option={}){const parts=String(option.optionId||'').split(':');return parts.length>=5?parts[3]:String(option.optionKey||'').trim();}
function block(label,instructions,target=null){return {label,instructions,target};}
function prescriptionBase({lane,option,family,comparisonClass,selectionReady=true,releaseStatus='READY',releaseReason=null,declaredVariantChanges=[]}={}){
  return {
    schemaVersion:'1.0',composerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION,
    lane,optionKey:optionKey(option),title:option.title,
    protocolFamilyId:family?.protocolFamilyId||null,protocolVersion:family?.protocolVersion||null,
    prescriptionLevel:family?.prescriptionLevel||(lane==='ABSORB'?'SIMPLE':'STRUCTURED'),
    measurementPriority:family?.measurementPriority||MEASUREMENT_PRIORITY_BY_LANE[lane]||'LOW',
    comparisonClass:comparisonClass||family?.defaultComparisonClass||'TRAINING_ONLY',
    capabilityQuestion:family?.capabilityQuestion||option.objective||null,
    benchmarkInvariants:[...(family?.benchmarkInvariants||[])],declaredVariantChanges:[...declaredVariantChanges],
    comparisonMetrics:[...(family?.comparisonMetrics||[])],requiredCapture:[...(family?.requiredCapture||[])],
    selectionReady,releaseStatus,releaseReason,
    intent:{purpose:option.objective,notIntendedToBecome:'Do not turn the session into an unplanned maximal test or add extra work after the prescribed finish.',expectedCost:option.expectedCost},
    preSessionGate:[],equipment:[],warmup:[],mainSet:[],decisionRules:[],successCriteria:[],coolDown:[],postSessionReport:[]
  };
}
function finalise(p){const copy={...p};delete copy.prescriptionFingerprint;return {...p,prescriptionFingerprint:hash(copy)};}

function absorbPrescription({lane,option}){
  const key=optionKey(option),p=prescriptionBase({lane,option,comparisonClass:'TRAINING_ONLY'});
  p.intent.notIntendedToBecome='This is recovery-supportive work. Do not convert it into a hidden quality session.';
  p.preSessionGate=[block('Start only if','No new pain, fever/illness signal, dizziness, severe GI symptoms or rapidly worsening local symptom is present.')];
  if(key==='mobility-reset'){
    p.equipment=['Floor space','Optional light band'];
    p.warmup=[block('5 min','Easy walk or very light bike/elliptical', 'RPE 1–2')];
    p.mainSet=[block('15–20 min','Move through ankle, calf, hip, thoracic and shoulder mobility. Use 45–60 s per position; no loaded end-range work and no painful stretching.','Comfortable range only')];
  }else{
    p.equipment=[key==='easy-run'?'Flat route or treadmill':'Elliptical, Assault Bike or stationary bike'];
    p.warmup=[block('5 min','Very easy progressive movement','RPE 1–2')];
    p.mainSet=[block('Continuous aerobic',option.dose,'RPE 2–3; conversational breathing throughout')];
  }
  p.decisionRules=['If effort rises above RPE 3 for more than 3 minutes at the same output, reduce output.','Stop for new pain, dizziness, severe GI symptoms or a clear worsening of the active constraint.'];
  p.successCriteria=['Finish feeling at least as good as you started.','No late-session intensity surge.'];
  p.coolDown=[block('5 min','Very easy movement followed by normal walking','RPE 1')];
  p.postSessionReport=['Session RPE','Any pain/local symptoms','Whether the session improved, worsened or did not change how you felt'];
  return finalise(p);
}

function steadyAerobic({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'FAMILY_COMPARABLE'});
  p.equipment=['Flat repeatable outdoor route OR treadmill. Record which one was used.','Garmin HR recording.'];
  p.preSessionGate=[block('Proceed if','No current running pain/limiter and the first 5 min of easy running feels mechanically normal.')];
  p.warmup=[block('10 min','Easy running, gradually settling into normal mechanics. Do not chase pace.','RPE 2–3')];
  p.mainSet=[block('30–40 min steady','Hold one continuous effort with no surges or threshold finish. Use the same route/treadmill context when comparison is intended.','RPE 3–4; full-sentence talk test should remain possible')];
  p.decisionRules=['If RPE reaches 5 at unchanged output before the final 10 min, reduce pace until RPE returns to 3–4.','If pain changes gait or increases progressively, stop the run rather than completing the clock.'];
  p.successCriteria=['Steady effort throughout with no deliberate fast finish.','Pace/output and HR relationship remains broadly stable; any drift is recorded rather than corrected with a surge.'];
  p.coolDown=[block('5–10 min','Very easy jog or walk','RPE 1–2')];
  p.postSessionReport=['Session RPE','Route/treadmill context','Any pace drift or unusual HR cost','Any pain/local limiter'];
  return finalise(p);
}

function strengthMaintenance({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'FAMILY_COMPARABLE'});
  p.equipment=['Rack or squat setup','Dumbbells/bench','Chest-supported row or machine row','Calf-raise setup'];
  p.preSessionGate=[block('Proceed if','No active hand/grip or lower-limb constraint makes the listed movement unsafe or technically altered. If it does, choose another released option; do not improvise substitutions inside this protocol.')];
  p.warmup=[block('8–10 min','5 min easy cardio, then 2 progressive warm-up sets for the first two loaded movements.','No warm-up set above RPE 5')];
  p.mainSet=[
    block('Back squat','3 × 5','~3 reps in reserve; 2:00 rest'),
    block('Dumbbell bench press','3 × 8','~3 reps in reserve; 2:00 rest'),
    block('Chest-supported row','3 × 8','~3 reps in reserve; 2:00 rest'),
    block('Reverse lunge','2 × 8 each side','~3 reps in reserve; 90 s rest'),
    block('Calf raise','2 × 12','Controlled full range; 60–90 s rest')
  ];
  p.decisionRules=['If a working set reaches ≤2 RIR, reduce load 5–10% for the next set.','If technique changes before the target rep count, end the set; do not grind the final reps.','No extra sets and no failure work.'];
  p.successCriteria=['Every working set finishes with about 3 RIR.','Movement quality is unchanged from the first to final set.'];
  p.coolDown=[block('5 min','Easy walk or bike; no additional loaded work','RPE 1–2')];
  p.postSessionReport=['Loads and reps for every working set','Estimated RIR final set of each movement','Any pain or technical deviation'];
  return finalise(p);
}

function hybridTechnique({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'FAMILY_COMPARABLE',selectionReady:false,releaseStatus:'OBJECTIVE_LOAD_REQUIRED',releaseReason:'Event-qualified wall-ball/load settings must be resolved from the objective registry before this option becomes selectable.'});
  p.equipment=['SkiErg','500 m repeatable run route/treadmill','Wall-ball target and event-qualified ball load from objective registry'];
  p.warmup=[block('10 min','5 min easy run + 3 min easy SkiErg + 2 × 5 controlled wall balls once event load is resolved.','RPE ≤4')];
  p.mainSet=[block('3 rounds','500 m SkiErg → transition ≤30 s → 500 m run → 10 wall balls → 2:00 easy walk/rest.','SkiErg RPE 5; run RPE 3–4; wall balls smooth and unbroken if possible, never near failure')];
  p.decisionRules=['If a station rises above RPE 6, reduce output on the next round.','If transition mechanics deteriorate or pain appears, stop the protocol rather than forcing technical volume.'];
  p.successCriteria=['Three technically consistent rounds with no station taken near failure.','Transition quality remains stable.'];
  p.coolDown=[block('5–8 min','Easy walk/jog','RPE 1–2')];
  p.postSessionReport=['Round times','Transition issues','Wall-ball quality','Session RPE'];
  return finalise(p);
}

function compromisedRunning({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'FAMILY_COMPARABLE',declaredVariantChanges:['Initial 4.6 exposure establishes the individual SkiErg control output; BENCHMARK_EXACT begins once that output is frozen for the family/version.']});
  p.equipment=['SkiErg with the same damper/drag setting recorded each time','Flat 1 km route or treadmill setup used consistently','Garmin recording HR, cadence and GCT when available'];
  p.preSessionGate=[block('Proceed if','No running pain/limiter, no active grip/hand constraint that changes SkiErg mechanics, and easy warm-up running feels normal.')];
  p.warmup=[
    block('8 min','Easy run','RPE 2–3'),
    block('3 min','Easy SkiErg','RPE 3'),
    block('2 × 20 s','Run strides with 40 s easy jog between','RPE 5–6, relaxed not sprinted'),
    block('2 min','Easy walk/rest before Round 1','Fully controlled')
  ];
  p.mainSet=[block('4 rounds','2:00 SkiErg → transition to run within 30 s → 1.00 km run → 3:00 recovery from run finish to next SkiErg start. Recovery is walk/stand only.','SkiErg Round 1 at RPE 6 and record average watts; Rounds 2–4 hold average watts within ±5%. Run 1 at RPE 6–7; Runs 2–4 aim to stay within ±3% of Run 1 split without sprinting the first 300 m.')];
  p.decisionRules=['If SkiErg output falls >5% despite RPE ≥7, stop after that completed round and record the limiter.','If a run split is >5% slower than Run 1 and RPE is rising, complete the current kilometre only if mechanics remain normal, then stop; do not chase the lost time.','Stop immediately for new pain, gait change, severe GI symptoms, dizziness or safety concern.'];
  p.successCriteria=['All completed rounds use the prescribed 2:00 SkiErg / ≤30 s transition / 1 km run / 3:00 recovery structure.','Run-split degradation is measured, not hidden by changing the pre-fatigue dose or recovery.','SkiErg output stays within ±5% of Round 1.'];
  p.coolDown=[block('8–10 min','Easy walk/jog until breathing is normal','RPE 1–2')];
  p.postSessionReport=['Each SkiErg average watts','Each transition time if available','Each 1 km split','HR by round','Cadence/GCT when available','Session RPE','Primary limiter: breathing / legs / grip / GI / pain / other','Any execution deviation'];
  return finalise(p);
}

function referenceProtocol({lane,option,family,label}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'BENCHMARK_EXACT',selectionReady:false,releaseStatus:'HISTORICAL_PROTOCOL_REQUIRED',releaseReason:`The exact established ${label} structure must be recovered from canonical historical evidence before 4.6 can present it as an execution-ready benchmark.`});
  p.preSessionGate=[block('Do not execute yet','This protocol is intentionally withheld until the historical benchmark definition has been reconstructed exactly. FZ must not invent work/rest details.')];
  p.successCriteria=['Release only after the historical structure, environment assumptions and capture fields are reconstructed and fingerprinted.'];
  p.postSessionReport=[...(family?.requiredCapture||[])];
  return finalise(p);
}

function ergEfficiency({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'FAMILY_COMPARABLE',declaredVariantChanges:['Initial exposure establishes a repeatable SkiErg control output; future benchmark repeats freeze erg type and target output.']});
  p.equipment=['SkiErg only for this family/version','Record drag/damper setting and keep it unchanged on later benchmark repeats'];
  p.warmup=[block('8 min','Easy progressive SkiErg including 3 × 10 hard-but-controlled strokes separated by 50 s easy.','Overall RPE ≤4')];
  p.mainSet=[block('3 × 1000 m SkiErg','Complete 1000 m, then exactly 3:00 easy/passive recovery before the next start.','Rep 1 RPE 6; Reps 2–3 keep average split/power within ±3% of Rep 1 without exceeding RPE 8')];
  p.decisionRules=['If Rep 2 is >5% slower than Rep 1 at equal/higher RPE, complete recovery and stop before Rep 3.','Do not change drag/damper to rescue output.'];
  p.successCriteria=['Same erg and machine setting for all reps.','Three rep outputs within ±3% when completed.'];
  p.coolDown=[block('5 min','Very easy SkiErg or walk','RPE 1–2')];
  p.postSessionReport=['Each 1000 m split and average power','HR peak per rep','HR after 60 s recovery when available','Session RPE','Machine setting'];
  return finalise(p);
}

function stationWorkRate({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'TRAINING_ONLY',selectionReady:false,releaseStatus:'STATION_DEFINITION_REQUIRED',releaseReason:'A station-specific movement, qualified load, work unit and movement standard must be resolved before this can become an executable measurable protocol.'});
  p.preSessionGate=[block('Do not execute from this generic card','Select or generate a named station family first (for example sled push, sled pull or another qualified station) so FZ can freeze the load and movement standard.')];
  p.successCriteria=['No generic station session may be labelled benchmark-comparable.'];
  return finalise(p);
}

function targetedQuality({lane,option,family}){
  const p=prescriptionBase({lane,option,family,comparisonClass:'TRAINING_ONLY',selectionReady:false,releaseStatus:'PROTOCOL_FAMILY_REQUIRED',releaseReason:'The current gap has not yet resolved to a named repeatable protocol family. FZ should not release an arbitrary quality workout as if it were longitudinal evidence.'});
  p.preSessionGate=[block('Withheld','Resolve the measurement target into a named family before athlete selection.')];
  return finalise(p);
}

export function composeSessionPrescription({lane,option,shadow=null}={}){
  const key=optionKey(option),family=protocolFamilyForOption({lane,optionKey:key,targetedGaps:option?.targetedGaps||[]});
  if(lane==='ABSORB')return absorbPrescription({lane,option,shadow});
  if(key==='steady-aerobic')return steadyAerobic({lane,option,family,shadow});
  if(key==='strength-maintenance')return strengthMaintenance({lane,option,family,shadow});
  if(key==='hybrid-technique')return hybridTechnique({lane,option,family,shadow});
  if(key==='compromised-repeatability')return compromisedRunning({lane,option,family,shadow});
  if(key==='matched-run-aet')return referenceProtocol({lane,option,family,label:'Matched Run AET'});
  if(key==='wall-ball-tolerance')return referenceProtocol({lane,option,family,label:'Wall Ball AET'});
  if(key==='erg-efficiency')return ergEfficiency({lane,option,family,shadow});
  if(key==='station-work-rate')return stationWorkRate({lane,option,family,shadow});
  if(key==='targeted-quality')return targetedQuality({lane,option,family,shadow});
  return finalise(prescriptionBase({lane,option,family,comparisonClass:'TRAINING_ONLY',selectionReady:false,releaseStatus:'PRESCRIPTION_REQUIRED',releaseReason:'No execution-grade prescription is defined for this option.'}));
}

export function attachSessionPrescriptions(lanes={},shadow=null){
  return Object.fromEntries(Object.entries(lanes).map(([lane,options])=>[lane,(options||[]).map(option=>({...option,prescription:composeSessionPrescription({lane,option,shadow}),sessionPrescriptionComposerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION}))]));
}

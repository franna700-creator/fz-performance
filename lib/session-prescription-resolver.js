import crypto from 'node:crypto';
import { attachSessionPrescriptions as attachBaseSessionPrescriptions, SESSION_PRESCRIPTION_COMPOSER_VERSION as BASE_COMPOSER_VERSION } from './session-prescription-composer.js';

export const SESSION_PRESCRIPTION_COMPOSER_VERSION='4.6.0-prescription.2';

function stable(value){if(Array.isArray(value))return value.map(stable);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));}
function fingerprint(value){const copy={...value};delete copy.prescriptionFingerprint;return crypto.createHash('sha256').update(JSON.stringify(stable(copy))).digest('hex');}
function optionKey(option={}){const parts=String(option.optionId||'').split(':');return parts.length>=5?parts[3]:String(option.optionKey||'').trim();}
function block(label,instructions,target=null){return {label,instructions,target};}
function finalise(prescription){const next={...prescription,composerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION};return {...next,prescriptionFingerprint:fingerprint(next)};}

const MH11_WARMUP=[
  block('Couch stretch','45 s left + 45 s right'),
  block('T-spine can opener','45 s'),
  block('Passive to active hang','30 s'),
  block('Elbow side plank','45 s left + 45 s right'),
  block('Hip piriformis stretch','45 s left + 45 s right'),
  block('Hip hitch','45 s left + 45 s right'),
  block('Hip banded abduction','45 s'),
  block('Transitions','Use the short transitions from the established MH1.1 sequence so the recurring mobility/activation block totals about 9 minutes.')
];

function matchedRunAet(base){
  const p={...base,
    protocolVersion:'1.1',
    comparisonClass:'FAMILY_COMPARABLE',
    selectionReady:true,releaseStatus:'READY',releaseReason:null,
    declaredVariantChanges:[
      'The historical matched series used the same 30:15 x13 x3 / 4:00 structure but terrain and footwear varied; Power/HR and set-to-set durability therefore remain stronger comparison anchors than raw pace alone.'
    ],
    equipment:['Running route or treadmill; record terrain/ascent and footwear because historical matched sessions were not route-identical.','Garmin HR recording; use the same HR device where practical.'],
    warmup:[...MH11_WARMUP,block('Running-specific preparation','Progressive easy running/accelerations until approximately 75% of measured maximum HR; do not begin the AET cold.')],
    mainSet:[block('3 sets × 13 rounds','30 s running work / 15 s recovery for 13 rounds. Complete 3 sets total.','Manage the work intervals at 85–88% of measured maximum HR; adjust speed rather than chasing pace.'),block('Between sets','Exactly 4:00 controlled recovery between Set 1→2 and Set 2→3.','Recover enough to repeat output; do not add extra recovery to rescue a fading set.')],
    decisionRules:['Keep the work/recovery structure unchanged.','If HR rises above the intended range, reduce running speed rather than lengthening recovery.','Stop for new pain, gait change, severe GI symptoms, dizziness or another safety concern.'],
    successCriteria:['Complete the prescribed 3 × 13 structure with controlled HR.','Preserve external output from Set 1 to Set 3 without a meaningful late-session collapse.','Treat terrain/footwear changes as context; do not claim raw-pace improvement from unlike conditions.'],
    coolDown:[block('5–10 min','Easy walk/jog until HR and breathing settle.','RPE 1–2')],
    postSessionReport:['Output/distance for each set','Average and peak HR for each set','Whole-session pace/power and Power/HR','Cadence and GCT when available','Terrain/ascent and footwear','Session RPE','Any execution deviation or limiter'],
    benchmarkInvariants:['MH1.1 warm-up','3 sets','13 rounds per set','30 s work','15 s recovery','4:00 between sets','75% HR warm-up anchor','85–88% max-HR work control'],
    comparisonMetrics:['setOutput','set1ToSet3Degradation','powerHr','avgPower','avgHeartRate','cadenceWhenReliable','gctWhenReliable','sessionRpe'],
    requiredCapture:['setOutput','setHeartRate','wholeSessionPowerHr','cadenceWhenAvailable','gctWhenAvailable','terrainOrTreadmillContext','footwear','sessionRpe','executionDeviation'],
    sourceKnowledge:[
      {type:'ATHLETE_HISTORICAL_PROTOCOL',label:'Matched Run AET series',asOf:'2026-08-30'},
      {type:'FZ_TRAINING_GUIDE',label:'AET Hyrox 1.1',structure:'30 s work / 15 s recovery ×13 rounds ×3 sets; 4 min between sets; warm to 75% max HR; work at 85–88% max HR'}
    ]
  };
  return finalise(p);
}

function wallBallTolerance(base){
  const p={...base,
    protocolVersion:'2.0',
    comparisonClass:'BENCHMARK_EXACT',
    selectionReady:true,releaseStatus:'READY',releaseReason:null,
    declaredVariantChanges:[
      'Version 2.0 fixes the ball at the HYROX Open Men 6 kg race load. The 2 Sep baseline began with a 14 lb ball and reduced to 5 kg late in Set 3, so that historical exposure remains FAMILY_COMPARABLE rather than BENCHMARK_EXACT against v2.0.'
    ],
    equipment:['6 kg wall ball','Official-height wall-ball target used consistently','Garmin HR recording; chest strap preferred if available and practical.'],
    warmup:[...MH11_WARMUP,block('Wall-ball preparation','Progress through easy squat-to-press and wall-ball repetitions, then settle near 75% of measured maximum HR before the first work interval.','No fatigue-building warm-up volume')],
    mainSet:[block('3 sets × 13 rounds','30 s wall-ball work / 15 s recovery for 13 rounds. Complete 3 sets total with the 6 kg ball.','Control cadence to work predominantly at 85–88% of measured maximum HR; do not sprint the early rounds.'),block('Between sets','Exactly 4:00 recovery between sets.','Stand/walk and prepare to repeat the same movement standard; do not change ball load.')],
    decisionRules:['Keep the 6 kg load fixed for benchmark validity.','If cadence must fall to preserve movement standard, record the output drop rather than changing load.','Stop for failed movement standard, new pain, dizziness, severe GI symptoms or another safety concern.'],
    successCriteria:['No failed wall-ball reps and no load change.','Cadence remains deliberately controlled rather than front-loaded.','Set output and local fatigue response are captured so the cost of the protocol can be compared over time.'],
    coolDown:[block('5–10 min','Easy walk and normal breathing recovery. No added rower-capacity block inside this benchmark version.','RPE 1–2')],
    postSessionReport:['Total wall balls per set','Round-level reps when practical','Average/peak HR by set','Session RPE','Primary local limiter','Next-day quad/shoulder/trap response','48 h local response','Any execution deviation'],
    benchmarkInvariants:['MH1.1 warm-up','6 kg ball','same target height','3 sets','13 rounds per set','30 s work','15 s recovery','4:00 between sets','85–88% max-HR control','no post-AET capacity block'],
    comparisonMetrics:['setRepTotal','set1ToSet3RepDegradation','heartRateCost','sessionRpe','nextDayLocalResponse','fortyEightHourLocalResponse','executionFidelity'],
    requiredCapture:['setRepTotal','setHeartRate','sessionRpe','localSymptomsNextDay','localSymptoms48h','executionDeviation'],
    sourceKnowledge:[
      {type:'ATHLETE_HISTORICAL_EXECUTION',label:'2 Sep 2026 first Wall Ball AET baseline',note:'3 × 13 × 30:15 / 4:00; 14 lb reduced to 5 kg in Round 9 of Set 3'},
      {type:'OFFICIAL_EVENT_PROFILE',label:'HYROX Open Men',wallBallLoadKg:6,reps:100},
      {type:'FZ_TRAINING_GUIDE',label:'AET Hyrox 1.5',structure:'30 s work / 15 s recovery ×13 rounds ×3 sets; 4 min between sets; cadence/load managed at 85–88% max HR'}
    ]
  };
  return finalise(p);
}

function releaseHistoricalProtocols(lanes){
  return Object.fromEntries(Object.entries(lanes).map(([lane,options])=>[lane,(options||[]).map(option=>{
    const key=optionKey(option),base=option.prescription||{};
    if(key==='matched-run-aet')return {...option,prescription:matchedRunAet(base),sessionPrescriptionComposerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION};
    if(key==='wall-ball-tolerance')return {...option,prescription:wallBallTolerance(base),sessionPrescriptionComposerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION};
    return {...option,prescription:finalise(base),sessionPrescriptionComposerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION};
  })]));
}

export function attachSessionPrescriptions(lanes={},shadow=null){
  return releaseHistoricalProtocols(attachBaseSessionPrescriptions(lanes,shadow));
}

export const SESSION_PRESCRIPTION_BASE_VERSION=BASE_COMPOSER_VERSION;

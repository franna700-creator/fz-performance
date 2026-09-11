import crypto from 'node:crypto';
import { ADAPTIVE_LANES, ADAPTIVE_LANE_DEFINITIONS } from './adaptive-lanes.js';

export const SESSION_OPTION_COMPOSER_VERSION = '4.4.0-composer.1';

const COST = Object.freeze({ ABSORB:'LOW', MAINTAIN:'LOW_TO_MODERATE', ADAPT:'MODERATE_TO_HIGH' });
const CONFIDENCE = new Set(['LOW','MODERATE','HIGH']);

function text(value){return String(value ?? '').trim();}
function upper(value){return text(value).toUpperCase();}
function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(!value || typeof value!=='object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function unique(values){return [...new Set((values||[]).filter(Boolean))];}
function confidence(shadow){const value=upper(shadow?.confidence);return CONFIDENCE.has(value)?value:'LOW';}
function constraints(shadow){
  const recovery=shadow?.contextSummary?.recovery||{};
  return `${recovery.status||''} ${recovery.systemicState||''} ${recovery.localConstraint||''} ${recovery.constraintSeverity||''}`.toLowerCase();
}
function highConstraint(shadow){
  const recovery=shadow?.contextSummary?.recovery||{};
  return ['HIGH','SEVERE'].includes(upper(recovery.constraintSeverity)) || /recovery-only|post[-\s]?session absorption|not fully recovered|current high-severity|severe|unable/.test(constraints(shadow));
}
function nearEventDays(shadow){
  const runway=Number(shadow?.contextSummary?.primaryObjective?.runwayDays);
  return Number.isFinite(runway)?runway:null;
}
function gaps(shadow){return Array.isArray(shadow?.contextSummary?.topMeasurementGaps)?shadow.contextSummary.topMeasurementGaps:[];}
function gapIds(shadow){return gaps(shadow).map(item=>text(item?.measurementId)).filter(Boolean);}
function primaryGap(shadow){return gapIds(shadow)[0]||null;}
function optionId(shadow,lane,key){
  const seed={version:SESSION_OPTION_COMPOSER_VERSION,recommendationId:shadow?.recommendationId||null,lane,key};
  return `option:${SESSION_OPTION_COMPOSER_VERSION}:${lane.toLowerCase()}:${key}:${hash(seed).slice(0,12)}`;
}
function makeOption(shadow,lane,key,{title,modality,objective,dose,whyNow,successCondition,stopCondition,targetedGaps=[],confidence:optionConfidence=null,sessionKind=null,matchHints={},evidenceBasis=[]}={}){
  return {
    optionId:optionId(shadow,lane,key),
    rank:0,
    title,
    modality,
    sessionKind,
    objective,
    dose,
    expectedCost:COST[lane],
    whyNow,
    successCondition:successCondition||'Complete the intended dose without materially worsening the next valuable training opportunity.',
    stopCondition:stopCondition||'Modify or stop if new pain, illness, GI, local-tissue or recovery evidence materially changes tolerance.',
    targetedGaps:unique(targetedGaps),
    confidence:optionConfidence||confidence(shadow),
    matchHints:{modality,...matchHints},
    evidenceBasis:unique(evidenceBasis),
    composerVersion:SESSION_OPTION_COMPOSER_VERSION
  };
}
function rank(options){return options.slice(0,3).map((option,index)=>({...option,rank:index+1}));}

function absorbOptions(shadow){
  const constrained=highConstraint(shadow);
  const basis=['Current active recommendation context','Low-cost work preserves future training value'];
  const out=[
    makeOption(shadow,'ABSORB','low-aerobic',{
      title:'Low-impact aerobic recovery',modality:'ELLIPTICAL',sessionKind:'RECOVERY',
      objective:'Preserve aerobic continuity while keeping recovery cost deliberately low.',
      dose:constrained?'25–40 min easy continuous work · RPE 2–3 · predominantly low HR':'35–55 min easy continuous work · RPE 2–3 · predominantly low HR',
      whyNow:constrained?'Current recovery/constraint context favours useful movement without turning recovery into a hidden quality session.':'This preserves aerobic continuity at low cost while leaving room for the next higher-value exposure.',
      matchHints:{alternates:['CYCLING','ASSAULT_BIKE','ELLIPTICAL'],titleTerms:['easy aerobic','recovery','zone 2','elliptical','bike']},evidenceBasis:basis
    }),
    makeOption(shadow,'ABSORB','mobility-reset',{
      title:'Mobility + movement reset',modality:'MOBILITY',sessionKind:'RECOVERY',
      objective:'Reduce local stiffness and preserve movement quality without meaningful systemic load.',
      dose:'20–30 min mobility and easy movement · no loaded work to failure',
      whyNow:'This is the lowest-cost option when the priority is absorption rather than adding training stress.',
      matchHints:{titleTerms:['mobility','stretching','reset']},evidenceBasis:basis
    })
  ];
  if(!/hand|finger|grip/.test(constraints(shadow))){
    out.push(makeOption(shadow,'ABSORB','easy-run',{
      title:'Easy running continuity',modality:'RUNNING',sessionKind:'RECOVERY',
      objective:'Keep running frequency and mechanics without creating a quality-session cost.',
      dose:constrained?'25–35 min conversational running · flat route · RPE 2–3':'30–45 min conversational running · flat/controlled route · RPE 2–3',
      whyNow:'Running-specific continuity is useful when local function allows it, but the session remains intentionally easy.',
      matchHints:{titleTerms:['easy run','recovery run','running']},evidenceBasis:basis
    }));
  }
  return rank(out);
}

function maintainOptions(shadow){
  const out=[
    makeOption(shadow,'MAINTAIN','steady-aerobic',{
      title:'Controlled steady aerobic',modality:'RUNNING',sessionKind:'STEADY',
      objective:'Preserve aerobic and running capability without adding a material new recovery burden.',
      dose:'40–60 min controlled steady work · RPE 3–4 · no threshold finish',
      whyNow:'Useful continuity is available without needing the cost of a deliberate adaptation session.',
      matchHints:{alternates:['RUNNING','CYCLING','ELLIPTICAL'],titleTerms:['steady','aerobic','running']},evidenceBasis:['Current active recommendation context','Maintenance lane preserves capability']
    }),
    makeOption(shadow,'MAINTAIN','strength-maintenance',{
      title:'Strength maintenance',modality:'STRENGTH',sessionKind:'STRENGTH',
      objective:'Retain useful strength reserve without stealing recovery from higher-priority running/hybrid work.',
      dose:'35–45 min · 4–6 movements · 2–3 working sets each · leave ~3 reps in reserve · no failure',
      whyNow:'Strength remains supportive, but the purpose is maintenance rather than chasing fatigue or volume.',
      matchHints:{titleTerms:['strength','gym','lifting']},evidenceBasis:['Current active recommendation context','Strength is support capacity rather than the primary objective']
    }),
    makeOption(shadow,'MAINTAIN','hybrid-technique',{
      title:'Controlled hybrid technique',modality:'HYROX_MIXED',sessionKind:'HYROX',
      objective:'Preserve movement sequencing and transition familiarity at controlled cost.',
      dose:'30–45 min mixed technique · submaximal stations · easy running/erg transitions · stop well before failure',
      whyNow:'This keeps race-specific movement familiarity without pretending a low-cost day is a simulation.',
      matchHints:{titleTerms:['hyrox','mixed','hybrid','technique']},evidenceBasis:['Current active recommendation context','Primary objective specificity']
    })
  ];
  if(/hand|finger|grip/.test(constraints(shadow))) return rank(out.filter(option=>option.modality!=='STRENGTH'&&option.modality!=='HYROX_MIXED'));
  return rank(out);
}

function adaptForGap(shadow,gap){
  const ids=gapIds(shadow);
  const targeted=gap?[gap]:ids.slice(0,2);
  const basis=['Primary-objective measurement hierarchy','Measurement gap is treated as unknown, not weakness'];
  if(['running.compromised_repeatability','running.fade'].includes(gap)){
    return makeOption(shadow,'ADAPT','compromised-repeatability',{
      title:'Compromised running repeatability',modality:'HYROX_MIXED',sessionKind:'HYROX',
      objective:'Measure and develop the ability to restore running output repeatedly after controlled work.',
      dose:'4 rounds · 2 min controlled non-limiting station/erg work + 1 km run · fixed recovery · record each run split, HR and RPE',
      whyNow:'This directly addresses the highest-priority unresolved HYROX running question without treating the gap as proven weakness.',
      targetedGaps:targeted,matchHints:{titleTerms:['hyrox','mixed','run','interval']},evidenceBasis:basis
    });
  }
  if(gap==='running.controlled_efficiency'){
    return makeOption(shadow,'ADAPT','matched-run-aet',{
      title:'Matched Run AET',modality:'RUNNING',sessionKind:'AET',
      objective:'Extend the standardized running-efficiency series using the established matched protocol.',
      dose:'Use the existing matched Run AET protocol unchanged; do not alter work/recovery structure for convenience.',
      whyNow:'The value comes from comparability with prior matched AETs, not simply from running hard.',
      targetedGaps:targeted,matchHints:{titleTerms:['aet','run workout','running']},evidenceBasis:[...basis,'Existing matched AET protocol']
    });
  }
  if(gap==='station.wall_ball_tolerance'){
    return makeOption(shadow,'ADAPT','wall-ball-tolerance',{
      title:'Standardised Wall Ball tolerance',modality:'WALL_BALL',sessionKind:'AET',
      objective:'Measure repeatable wall-ball output and its local recovery cost.',
      dose:'Repeat the established Wall Ball/AET protocol unchanged; record completion quality, HR/RPE and next-day/48 h local response.',
      whyNow:'A matched repeat is more informative than adding an unrelated wall-ball volume session.',
      targetedGaps:targeted,matchHints:{titleTerms:['wall ball','aet']},evidenceBasis:[...basis,'Existing standardized Wall Ball exposure']
    });
  }
  if(gap==='station.erg_efficiency'){
    return makeOption(shadow,'ADAPT','erg-efficiency',{
      title:'Standardised erg efficiency',modality:'SKI_ERG',sessionKind:'INTERVAL',
      objective:'Measure repeatable erg output at a controlled internal cost and preserve downstream running quality.',
      dose:'3 × 1000 m SkiErg or RowErg · fixed recovery · record split, HR/RPE and post-rep recovery',
      whyNow:'This creates direct standardized evidence for the unresolved erg-efficiency question.',
      targetedGaps:targeted,matchHints:{alternates:['SKI_ERG','ROWING'],titleTerms:['ski','row','erg','1000']},evidenceBasis:basis
    });
  }
  if(['station.work_rate','station.sled_capability','strength_endurance.repeatability'].includes(gap)){
    return makeOption(shadow,'ADAPT','station-work-rate',{
      title:'Standardised station work-rate',modality:'HYROX_MIXED',sessionKind:'HYROX',
      objective:'Produce repeatable race-relevant station output with measurable downstream cost.',
      dose:'3–5 matched station repeats at qualified event-relevant load/format · fixed recovery · record split and quality; do not invent unsupported race loads.',
      whyNow:'A fixed repeatable station protocol creates evidence that can actually update the primary-objective capability model.',
      targetedGaps:targeted,matchHints:{titleTerms:['hyrox','station','sled','strength endurance']},evidenceBasis:basis
    });
  }
  return makeOption(shadow,'ADAPT','targeted-quality',{
    title:'Targeted quality exposure',modality:'HYROX_MIXED',sessionKind:'QUALITY',
    objective:'Create a deliberate, measurable stimulus against the highest-priority unresolved primary-objective capability.',
    dose:'One fixed protocol with repeatable work/rest structure · record external output, HR/RPE and recovery response',
    whyNow:gap?`The current highest-priority unresolved measurement is ${gap}; the session should create comparable evidence rather than generic fatigue.`:'Current recovery and load context allow a deliberate adaptation stimulus, but the exact measurement target remains explicit.',
    targetedGaps:targeted,matchHints:{titleTerms:['quality','hyrox','interval']},evidenceBasis:basis
  });
}

function adaptOptions(shadow){
  const ids=gapIds(shadow);
  const out=[];
  for(const gap of ids){
    const option=adaptForGap(shadow,gap);
    if(!out.some(item=>item.title===option.title)) out.push(option);
    if(out.length>=3) break;
  }
  if(!out.length) out.push(adaptForGap(shadow,null));
  return rank(out);
}

export function composeSessionOptions(shadow={}){
  const empty={ABSORB:[],MAINTAIN:[],ADAPT:[]};
  if(shadow?.contextType!=='RECOMMENDATION_SHADOW' || shadow?.status!=='READY') return empty;
  const recommended=upper(shadow.lane);
  if(!ADAPTIVE_LANES.includes(recommended)) return empty;
  const safety=shadow?.rules?.safetyOverridesLaneScoring===true && shadow?.explanation?.safety?.override===true;
  const laneOptions={
    ABSORB:absorbOptions(shadow),
    MAINTAIN:maintainOptions(shadow),
    ADAPT:adaptOptions(shadow)
  };
  if(safety){laneOptions.MAINTAIN=[];laneOptions.ADAPT=[];}
  const eventDays=nearEventDays(shadow);
  if(eventDays!==null && eventDays<=3) laneOptions.ADAPT=[];
  if(highConstraint(shadow) && recommended==='ABSORB') laneOptions.ADAPT=[];
  return laneOptions;
}

export function sessionOptionComposerSummary(shadow={}){
  const lanes=composeSessionOptions(shadow);
  return {
    version:SESSION_OPTION_COMPOSER_VERSION,
    primaryGap:primaryGap(shadow),
    recommendedLane:shadow?.lane||null,
    counts:Object.fromEntries(ADAPTIVE_LANES.map(lane=>[lane,lanes[lane].length])),
    principle:shadow?.lane?ADAPTIVE_LANE_DEFINITIONS[shadow.lane]?.principle||null:null
  };
}

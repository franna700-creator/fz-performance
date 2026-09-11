import { evidenceSummary, heartRateIntensitySeconds } from './training-evidence.js';

function number(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function firstNumber(...values){
  for(const value of values){const n=number(value);if(n!==null)return n;}
  return null;
}
function text(value){const valueText=String(value??'').trim();return valueText||null;}
function distribution(value){
  if(Array.isArray(value)&&value.length>=3){const parsed=value.slice(0,3).map(number);return parsed.every(item=>item!==null)?parsed:null;}
  if(value&&typeof value==='object'){
    const parsed=[number(value[0]??value['0']),number(value[1]??value['1']),number(value[2]??value['2'])];
    return parsed.every(item=>item!==null)?parsed:null;
  }
  return null;
}
function shares(values){
  if(!Array.isArray(values))return null;
  const total=values.reduce((sum,value)=>sum+Number(value||0),0);
  if(total<=0)return null;
  return {low:Number(values[0]||0)/total,moderate:Number(values[1]||0)/total,high:Number(values[2]||0)/total};
}
function normalizeSets(payload={}){
  if(!Array.isArray(payload.sets))return [];
  return payload.sets.map((set,index)=>({
    set:firstNumber(set?.set,index+1),
    exerciseLabel:text(set?.exercise_label??set?.exerciseLabel),
    reps:number(set?.reps),
    weightKg:number(set?.weight_kg??set?.weightKg),
    durationSeconds:number(set?.duration_s??set?.durationSeconds)
  }));
}
function hasAny(object={}){return Object.values(object).some(value=>value!==null&&value!==undefined);}

export function deriveTrainingWorkoutDetail(payload={}){
  const summary=evidenceSummary(payload);
  const hrIntensitySeconds=heartRateIntensitySeconds(payload);
  const hrShares=shares(hrIntensitySeconds);
  const cadenceIntensitySeconds=distribution(summary?.intensityDistribution?.cadence??summary?.zonesDistribution?.cadence);
  const cadenceShares=shares(cadenceIntensitySeconds);

  const physiology={
    heartRateEffort:firstNumber(summary?.effort?.heartrate,payload.hrEffort),
    hrIntensitySeconds,
    hrIntensityShares:hrShares,
    cadenceIntensitySeconds,
    cadenceIntensityShares:cadenceShares,
    temperatureC:firstNumber(summary.temperature,payload.temperature,payload.temperature_c)
  };

  const running={
    runningEffectiveness:firstNumber(summary.runningEffectiveness,payload.runningEffectiveness),
    groundContactTimeMs:firstNumber(summary.groundContactTime,payload.groundContactTimeMs),
    flightTimeMs:firstNumber(summary.flightTime,payload.flightTimeMs),
    stepLengthCm:firstNumber(summary.stepLength,payload.stepLengthCm),
    walkingDurationSeconds:firstNumber(summary.walkingDuration,payload.walkingDurationSeconds),
    avgPowerWatts:firstNumber(summary.power,payload.avg_power,payload.averagePower,payload.avgPower),
    maxPowerWatts:firstNumber(summary.powerMax,payload.max_power,payload.maxPower),
    avgCadence:firstNumber(summary.cadence,payload.cadence,payload.avg_cadence,payload.averageCadence),
    maxCadence:firstNumber(summary.cadenceMax,payload.max_cadence,payload.maxCadence)
  };
  const runningSpecific=running.runningEffectiveness!==null||running.groundContactTimeMs!==null||running.flightTimeMs!==null||running.stepLengthCm!==null||running.walkingDurationSeconds!==null;

  const sets=normalizeSets(payload);
  const notes=payload?.interpretation_notes&&typeof payload.interpretation_notes==='object'?payload.interpretation_notes:{};
  const strength=sets.length?{
    setCount:firstNumber(payload.set_count,payload.setCount,sets.length),
    sets,
    sourceArtifact:text(payload.source_artifact??payload.sourceArtifact),
    providerActivityId:text(payload.garmin_activity_id??payload.activity_id??payload.id),
    labelSemantics:text(notes.exercise_label_semantics),
    weightSemantics:text(notes.weight_semantics),
    conflicts:Array.isArray(notes.conflicts)?notes.conflicts.map(text).filter(Boolean):[]
  }:null;

  const physiologyHasDetail=hasAny({
    heartRateEffort:physiology.heartRateEffort,
    hrIntensitySeconds:physiology.hrIntensitySeconds,
    cadenceIntensitySeconds:physiology.cadenceIntensitySeconds,
    temperatureC:physiology.temperatureC
  });

  return {
    hasDetail:Boolean(strength||runningSpecific||physiologyHasDetail),
    physiology:physiologyHasDetail?physiology:null,
    running:runningSpecific?running:null,
    strength
  };
}

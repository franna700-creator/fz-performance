function isObject(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function isMissing(value){if(value===null||value===undefined||value==='')return true;if(Array.isArray(value))return value.length===0;if(isObject(value))return Object.keys(value).length===0;return false;}
function clone(value){if(Array.isArray(value))return value.map(clone);if(isObject(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clone(item)]));return value;}
export function fillEvidenceGaps(primary,fallback){if(isMissing(primary))return clone(fallback);if(Array.isArray(primary))return primary.length?clone(primary):clone(fallback);if(isObject(primary)&&isObject(fallback)){const out=clone(primary);for(const [key,value] of Object.entries(fallback))out[key]=key in out?fillEvidenceGaps(out[key],value):clone(value);return out;}return clone(primary);}
function rowTime(row){const raw=row?.ingested_at||row?.ingestedAt||row?.source_updated_at||row?.sourceUpdatedAt||0;const ms=new Date(raw).getTime();return Number.isFinite(ms)?ms:0;}
export function mergeEvidenceRows(rows=[]){const ordered=[...rows].filter(row=>row?.payload&&typeof row.payload==='object').sort((a,b)=>rowTime(b)-rowTime(a));if(!ordered.length)return {payload:{},versions:0,newestAt:null,enrichedFromHistory:false};const newest=clone(ordered[0].payload);let merged=newest;for(const row of ordered.slice(1))merged=fillEvidenceGaps(merged,row.payload);return {payload:merged,versions:ordered.length,newestAt:ordered[0].ingested_at||ordered[0].ingestedAt||ordered[0].source_updated_at||ordered[0].sourceUpdatedAt||null,enrichedFromHistory:JSON.stringify(merged)!==JSON.stringify(newest)};}
export function evidenceSummary(payload={}){return payload?.summary&&typeof payload.summary==='object'?payload.summary:{};}
function number(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function firstNumber(...values){for(const value of values){const n=number(value);if(n!==null)return n;}return null;}
export function heartRateIntensitySeconds(payload={}){const summary=evidenceSummary(payload);const distribution=summary?.intensityDistribution?.heartrate;if(distribution&&typeof distribution==='object'){const values=[number(distribution[0]??distribution['0']),number(distribution[1]??distribution['1']),number(distribution[2]??distribution['2'])];if(values.every(value=>value!==null))return values;}const zones=summary?.zonesDistribution?.heartrate;if(Array.isArray(zones)&&zones.length>=3){const values=zones.slice(0,3).map(number);if(values.every(value=>value!==null))return values;}return null;}
export function deriveNcl(payload={}){const distribution=heartRateIntensitySeconds(payload);if(!distribution)return null;const [low,moderate,high]=distribution;return Math.round(((low+(2*moderate)+(4*high))/60)*10000)/10000;}

export function deriveTrainingMetrics(payload={}){
  const summary=evidenceSummary(payload);
  const durationSeconds=firstNumber(summary.durationTotal,summary.duration,payload['summary.durationTotal'],payload['summary.duration'],payload.duration_s,payload.durationSeconds,payload.duration);
  const avgHeartRate=firstNumber(summary.heartrate,payload['summary.heartrate'],payload.avg_hr,payload.averageHeartRate,payload.avgHeartRate);
  const maxHeartRate=firstNumber(summary.heartrateMax,payload.max_hr,payload.maxHeartRate,payload.maximumHeartRate);
  const directDistance=firstNumber(summary.distance,payload['summary.distance'],payload.distance_m,payload.distanceMeters);
  const distanceKm=firstNumber(payload.distance_km,payload.distanceKm);
  const distanceMeters=directDistance!==null?directDistance:(distanceKm!==null?distanceKm*1000:null);
  const calories=firstNumber(summary.calories,payload.calories,payload.activeCalories);
  const avgPowerWatts=firstNumber(summary.power,payload.avg_power,payload.averagePower,payload.avgPower);
  const maxPowerWatts=firstNumber(summary.powerMax,payload.max_power,payload.maxPower);
  const paceSecPerKm=firstNumber(summary.pace,payload.pace_sec_per_km,payload.paceSecPerKm,payload.averagePace);
  const cadence=firstNumber(summary.cadence,payload.cadence,payload.avg_cadence,payload.averageCadence);
  const maxCadence=firstNumber(summary.cadenceMax,payload.max_cadence,payload.maxCadence);
  const elevationGainMeters=firstNumber(summary?.altitude?.ascent,payload.elevation_gain_m,payload.elevationGainMeters,payload.totalAscent);
  const temperatureC=firstNumber(summary.temperature,payload.temperature,payload.temperature_c);
  const heartRateEffort=firstNumber(summary?.effort?.heartrate,payload.hrEffort);
  const hrIntensitySeconds=heartRateIntensitySeconds(payload);
  const hrIntensityTotal=Array.isArray(hrIntensitySeconds)?hrIntensitySeconds.reduce((sum,value)=>sum+Number(value||0),0):0;
  const lowHrShare=hrIntensityTotal>0?Number(hrIntensitySeconds[0]||0)/hrIntensityTotal:null;
  return {
    durationSeconds,
    avgHeartRate,
    maxHeartRate,
    distanceMeters,
    calories,
    avgPowerWatts,
    maxPowerWatts,
    paceSecPerKm,
    cadence,
    maxCadence,
    elevationGainMeters,
    temperatureC,
    heartRateEffort,
    hrIntensitySeconds,
    lowHrShare
  };
}

export function evidenceCoverage(payload={}){const summary=evidenceSummary(payload);const checks={duration:number(summary.durationTotal??summary.duration??payload['summary.durationTotal']??payload['summary.duration'])!==null,heartRate:number(summary.heartrate??payload['summary.heartrate'])!==null,power:number(summary.power)!==null,pace:number(summary.pace)!==null,hrDistribution:Boolean(heartRateIntensitySeconds(payload)),activityDetail:payload.detailLevel==='activity-detail'};return {...checks,score:Object.values(checks).filter(Boolean).length};}

import { syncTrainingSources as syncRawTrainingSources } from './training-sync.js';
import { reconcileUnlinkedAthleteEvents } from './athlete-memory-reconcile.js';
import { recomputeRecommendationShadowSafely } from './recommendation-shadow-orchestrator.js';
import { getSql } from './db.js';

async function latestTrainingSourceVersion(){
  try{
    const sql=await getSql();
    const rows=await sql`SELECT COALESCE(MAX(id),0) AS max_id FROM fz_training_source_records`;
    return Number(rows?.[0]?.max_id||0);
  }catch{return null;}
}

export async function syncTrainingSources({ startDate, endDate }) {
  const sourceVersionBefore=await latestTrainingSourceVersion();
  const source = await syncRawTrainingSources({ startDate, endDate });
  let athleteMemory = { scanned: 0, linked: 0, ambiguous: 0, noCandidate: 0, changes: [] };
  const warnings = [...(source.warnings || [])];
  try {
    athleteMemory = await reconcileUnlinkedAthleteEvents({ startDate, endDate });
  } catch (error) {
    warnings.push(`Athlete Memory late-link: ${error instanceof Error ? error.message : String(error)}`);
  }
  const sourceVersionAfter=await latestTrainingSourceVersion();
  const sourceVersionMarkerUnavailable=sourceVersionBefore===null||sourceVersionAfter===null;
  const sourceVersionChanged=!sourceVersionMarkerUnavailable&&sourceVersionAfter>sourceVersionBefore;
  const sourceActivityObserved=(source?.tredict?.activities||0)>0||(source?.garmin?.activities||0)>0||(source?.tredict?.plans||0)>0;
  const meaningfulChange=sourceVersionChanged || (sourceVersionMarkerUnavailable&&sourceActivityObserved) || (athleteMemory.linked||0)>0;
  let recommendationShadow=null;
  if(meaningfulChange){
    recommendationShadow=await recomputeRecommendationShadowSafely({
      trigger:{type:'TRAINING_SYNC',sourceVersionBefore,sourceVersionAfter,sourceVersionChanged,sourceVersionMarkerUnavailable,athleteMemoryLinked:athleteMemory.linked||0,startDate,endDate},
      now:new Date(),
      persist:true
    });
  }
  return { ...source, athleteMemory, sourceVersion:{before:sourceVersionBefore,after:sourceVersionAfter,changed:sourceVersionChanged,markerUnavailable:sourceVersionMarkerUnavailable}, recommendationShadow, warnings };
}

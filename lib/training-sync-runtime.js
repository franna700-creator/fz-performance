import { syncTrainingSources as syncRawTrainingSources } from './training-sync.js';
import { reconcileUnlinkedAthleteEvents } from './athlete-memory-reconcile.js';
import { assessTrainingSourceChanges } from './source-materiality.js';
import { evaluateMateriality } from './materiality-engine.js';
import { persistMaterialityAssessment } from './materiality-store.js';
import { propagateCanonicalChangeSafely } from './canonical-propagation.js';
import { getSql } from './db.js';

async function latestTrainingSourceVersion(){
  try{
    const sql=await getSql();
    const rows=await sql`
      SELECT COALESCE(MAX(id),0) AS max_id
      FROM fz_training_source_records
      WHERE source_key <> 'fz-intelligence'
        AND record_type IN ('planned_workout','executed_activity')
    `;
    return Number(rows?.[0]?.max_id||0);
  }catch{return null;}
}

function combineMateriality(items=[]){
  const eligible=items.filter(item=>item?.shouldRecomputeRecommendation);
  if(!eligible.length)return null;
  const highest=eligible.slice().sort((a,b)=>Number(b.rank||0)-Number(a.rank||0))[0];
  return {
    ...highest,
    sourceType:'SYSTEM_RECONCILIATION',
    reasonCodes:[...new Set(eligible.flatMap(item=>item.reasonCodes||[]))],
    affectedDomains:[...new Set(eligible.flatMap(item=>item.affectedDomains||[]))],
    blocksExistingRecommendation:eligible.some(item=>item.blocksExistingRecommendation===true),
    shouldUpdateState:true,
    shouldRecomputeRecommendation:true
  };
}

async function assessLateLinks(changes=[]){
  const results=[];
  for(const change of changes||[]){
    const assessment=evaluateMateriality({
      sourceType:'SYSTEM_RECONCILIATION',
      eventType:'CONTEXT',
      certainty:'OBSERVED',
      summary:'Late Athlete Memory association changed canonical workout context.',
      signals:{sequencingChanged:true},
      payload:{athleteEventKey:change.eventKey,sessionId:change.sessionId,confidence:change.confidence}
    });
    const evidenceKey=`reconciliation:late-link:${change.eventKey}:${change.sessionId}`;
    const persisted=await persistMaterialityAssessment({
      evidenceKey,
      sourceType:'SYSTEM_RECONCILIATION',
      sourceKey:'fz',
      occurredAt:new Date().toISOString(),
      summary:'Late Athlete Memory association changed canonical workout context.',
      assessment
    });
    results.push({evidenceKey,assessment,materialityRecordPk:persisted?.id||null});
  }
  return results;
}

function changedDependencyNodes(source, athleteMemory, recommendationMateriality){
  const nodes=[];
  if((source?.tredict?.activities||0)>0||(source?.tredict?.plans||0)>0)nodes.push('source.tredict.activity');
  if((source?.garmin?.activities||0)>0)nodes.push('source.garmin.activity');
  if((athleteMemory?.linked||0)>0)nodes.push('process.reconcileAthleteMemory','athlete.memory');
  if(recommendationMateriality)nodes.push('materiality.current');
  return [...new Set(nodes)];
}

export async function syncTrainingSources({ startDate, endDate, recomputeRecommendation = true } = {}) {
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

  let sourceMateriality={scanned:0,assessments:[],recommendationMateriality:null};
  if(sourceVersionChanged){
    try{
      sourceMateriality=await assessTrainingSourceChanges({afterId:sourceVersionBefore});
    }catch(error){
      warnings.push(`Training materiality: ${error instanceof Error?error.message:String(error)}`);
    }
  }else if(sourceVersionMarkerUnavailable&&sourceActivityObserved){
    warnings.push('Training materiality source-version marker unavailable; recommendation propagation was not guessed.');
  }

  let lateLinkMateriality=[];
  if((athleteMemory.linked||0)>0){
    try{lateLinkMateriality=await assessLateLinks(athleteMemory.changes||[]);}
    catch(error){warnings.push(`Late-link materiality: ${error instanceof Error?error.message:String(error)}`);}
  }

  const recommendationMateriality=combineMateriality([
    sourceMateriality.recommendationMateriality,
    ...lateLinkMateriality.map(item=>item.assessment)
  ]);
  const meaningfulChange=sourceVersionChanged || (sourceVersionMarkerUnavailable&&sourceActivityObserved) || (athleteMemory.linked||0)>0;
  const changedNodes=changedDependencyNodes(source,athleteMemory,recommendationMateriality);
  let propagation=null;
  if(recomputeRecommendation&&meaningfulChange&&changedNodes.length){
    propagation=await propagateCanonicalChangeSafely({
      changedNodes,
      materiality:recommendationMateriality,
      trigger:{
        type:'TRAINING_SYNC',
        sourceVersionBefore,
        sourceVersionAfter,
        sourceVersionChanged,
        sourceVersionMarkerUnavailable,
        athleteMemoryLinked:athleteMemory.linked||0,
        materialityLevel:recommendationMateriality?.level||null,
        reasonCodes:recommendationMateriality?.reasonCodes||[],
        startDate,endDate
      },
      now:new Date()
    });
    warnings.push(...(propagation?.warnings||[]));
  }

  return {
    ...source,
    athleteMemory,
    sourceVersion:{before:sourceVersionBefore,after:sourceVersionAfter,changed:sourceVersionChanged,markerUnavailable:sourceVersionMarkerUnavailable},
    materiality:{training:sourceMateriality,lateLinks:lateLinkMateriality,recommendation:recommendationMateriality},
    meaningfulChange,
    propagation,
    recommendationShadow:propagation?.shadow||null,
    activeRecommendation:propagation?.activeRecommendation||null,
    warnings
  };
}

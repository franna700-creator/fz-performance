import crypto from 'node:crypto';
import measurementRegistry from '../config/measurement-hierarchies.json' with { type: 'json' };
import { getSql } from './db.js';

function number(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function date(value){if(!value)return null;if(typeof value==='string')return value.slice(0,10);return new Date(value).toISOString().slice(0,10);}
function iso(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}
function stable(value){if(Array.isArray(value))return value.map(stable);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,16);}
function byKey(rows,key){const out=new Map();for(const row of rows||[]){const value=row?.[key];if(value==null)continue;if(!out.has(value))out.set(value,[]);out.get(value).push(row);}return out;}
function evidenceRef(row){return {id:Number(row.source_evidence_id),sourceType:row.source_type,sourceRef:row.source_ref||null,observedAt:iso(row.observed_at),confidence:number(row.confidence),payload:row.payload||{}};}

export function transferAssessmentIsCurrent(row,{profileTokens=new Map(),profileUpdatedAt=new Map()}={}){
  if(!row?.source_profile_id||!row?.target_profile_id||number(row.transfer_score)===null)return false;
  const assessmentAt=Date.parse(iso(row.effective_at)||'');
  const sourceUpdated=Date.parse(profileUpdatedAt.get(row.source_profile_id)||'');
  const targetUpdated=Date.parse(profileUpdatedAt.get(row.target_profile_id)||'');
  if(Number.isFinite(sourceUpdated)&&Number.isFinite(assessmentAt)&&assessmentAt<sourceUpdated)return false;
  if(Number.isFinite(targetUpdated)&&Number.isFinite(assessmentAt)&&assessmentAt<targetUpdated)return false;
  const payload=row.assessment||{};
  if(payload.sourceProfileVersionToken&&payload.sourceProfileVersionToken!==profileTokens.get(row.source_profile_id))return false;
  if(payload.targetProfileVersionToken&&payload.targetProfileVersionToken!==profileTokens.get(row.target_profile_id))return false;
  return true;
}

export async function loadMeasurementRegistry(){return measurementRegistry;}

export async function loadObjectiveRuntimeGraph(){
  const sql=await getSql();
  const [capabilities,profiles,objectives,demands,evidenceRows,transferRows]=await Promise.all([
    sql`SELECT capability_id,name,category,description,created_at,updated_at FROM fz_capabilities ORDER BY capability_id`,
    sql`SELECT profile_id,event_family,variant,knowledge_status,source_authority,profile,verified_at,created_at,updated_at FROM fz_event_format_profiles ORDER BY profile_id`,
    sql`SELECT o.objective_id,o.objective_type,o.name,o.state,o.role,o.strategic_weight,o.starts_on,o.ends_on,o.format_profile_id,o.knowledge_status,o.target,o.metadata,o.created_at,o.updated_at,
               COALESCE((SELECT MAX(r.revision_id) FROM fz_objective_revisions r WHERE r.objective_id=o.objective_id),0) AS latest_revision_id
        FROM fz_objectives o ORDER BY o.objective_id`,
    sql`SELECT objective_id,capability_id,demand_weight,transfer_weight,specificity,provenance FROM fz_objective_capabilities ORDER BY objective_id,capability_id`,
    sql`SELECT source_evidence_id,objective_id,profile_id,source_type,source_ref,observed_at,confidence,payload
        FROM fz_event_source_evidence ORDER BY observed_at DESC,source_evidence_id DESC`,
    sql`SELECT DISTINCT ON (source_objective_id,target_objective_id)
          assessment_id,source_objective_id,target_objective_id,source_profile_id,target_profile_id,transfer_score,transfer_class,net_training_value_resolved,assessment,effective_at,created_at
        FROM fz_event_transfer_assessments
        ORDER BY source_objective_id,target_objective_id,effective_at DESC,assessment_id DESC`
  ]);

  const evidenceByObjective=byKey(evidenceRows,'objective_id');
  const evidenceByProfile=byKey(evidenceRows,'profile_id');
  const demandByObjective=new Map();
  for(const row of demands){if(!demandByObjective.has(row.objective_id))demandByObjective.set(row.objective_id,[]);demandByObjective.get(row.objective_id).push({capabilityId:row.capability_id,weight:number(row.demand_weight),transferWeight:number(row.transfer_weight),specificity:row.specificity,provenance:row.provenance||{}});}

  const profileTokens=new Map();
  const profileUpdatedAt=new Map();
  const runtimeProfiles=profiles.map(row=>{
    const sourceEvidence=(evidenceByProfile.get(row.profile_id)||[]).map(evidenceRef);
    const sourceRefs=[...new Set([...(row.profile?.sourceRefs||[]),...sourceEvidence.map(x=>x.sourceRef).filter(Boolean)])];
    const profileSignature=digest({eventFamily:row.event_family,variant:row.variant,knowledgeStatus:row.knowledge_status,sourceAuthority:row.source_authority,profile:row.profile||{}});
    const versionToken=`${row.profile_id}:${profileSignature}`;
    profileTokens.set(row.profile_id,versionToken);
    profileUpdatedAt.set(row.profile_id,iso(row.updated_at)||iso(row.verified_at));
    return {...(row.profile||{}),id:row.profile_id,eventFamily:row.event_family,variant:row.variant,sourceAuthority:row.source_authority,knowledgeStatus:row.knowledge_status,verifiedAt:iso(row.verified_at),updatedAt:iso(row.updated_at),versionToken,sourceRefs,sourceEvidence};
  });

  const objectiveRegistry={
    version:'1.0',asOf:new Date().toISOString().slice(0,10),
    capabilities:capabilities.map(row=>({id:row.capability_id,name:row.name,category:row.category,description:row.description,updatedAt:iso(row.updated_at)})),
    events:objectives.filter(row=>row.objective_type==='EVENT').map(row=>{
      const startsOn=date(row.starts_on),endsOn=date(row.ends_on),exactDate=startsOn&&endsOn&&startsOn===endsOn?startsOn:null;
      const latestRevisionId=Number(row.latest_revision_id||0);
      const sourceEvidence=(evidenceByObjective.get(row.objective_id)||[]).map(evidenceRef);
      const profileVersionToken=row.format_profile_id?profileTokens.get(row.format_profile_id)||null:null;
      const demandsNow=demandByObjective.get(row.objective_id)||[];
      const objectiveSignature=digest({name:row.name,state:row.state,role:row.role,strategicWeight:number(row.strategic_weight),startsOn,endsOn,formatProfileId:row.format_profile_id,knowledgeStatus:row.knowledge_status,target:row.target||{},metadata:row.metadata||{},demands:demandsNow});
      const versionToken=`${row.objective_id}:r${latestRevisionId}:${objectiveSignature}:${profileVersionToken||'no-profile'}`;
      return {
        id:row.objective_id,name:row.name,date:exactDate,startsOn,endsOn,status:row.state,role:row.role,strategicWeight:number(row.strategic_weight),objective:row.target||{},demands:demandsNow,formatProfileId:row.format_profile_id,knowledgeStatus:row.knowledge_status,metadata:row.metadata||{},
        participationStatus:row.metadata?.participationStatus||null,datePrecision:row.metadata?.datePrecision||(exactDate?'EXACT':startsOn||endsOn?'WINDOW':'UNKNOWN'),latestRevisionId,updatedAt:iso(row.updated_at),versionToken,profileVersionToken,sourceEvidence
      };
    }),
    evergreenObjectives:objectives.filter(row=>row.objective_type==='EVERGREEN').map(row=>({id:row.objective_id,name:row.name,status:row.state,role:row.role,strategicWeight:number(row.strategic_weight),latestRevisionId:Number(row.latest_revision_id||0),updatedAt:iso(row.updated_at),...(row.metadata||{})}))
  };

  const transferRules=transferRows.filter(row=>transferAssessmentIsCurrent(row,{profileTokens,profileUpdatedAt})).map(row=>({
    from:row.source_profile_id,to:row.target_profile_id,transfer:number(row.transfer_score),class:row.transfer_class||null,
    assessmentId:Number(row.assessment_id),effectiveAt:iso(row.effective_at),source:'NEON_EVENT_TRANSFER_ASSESSMENT',assessment:row.assessment||{},netTrainingValueResolved:row.net_training_value_resolved===true,
    sourceProfileVersionToken:profileTokens.get(row.source_profile_id)||null,targetProfileVersionToken:profileTokens.get(row.target_profile_id)||null
  }));
  const formatRegistry={version:'1.0',asOf:new Date().toISOString().slice(0,10),profiles:runtimeProfiles,transferRules,nonTransferableOrLowTransfer:[]};

  if(!objectives.length){
    return {source:'NEON_OBJECTIVE_GRAPH_EMPTY',objectiveRegistry,formatRegistry,warnings:['Runtime objective graph is empty. Static event seeds are not used as a live fallback; shadow recommendation must remain withheld until runtime event/objective data exists.']};
  }
  return {source:'NEON_OBJECTIVE_GRAPH',objectiveRegistry,formatRegistry,warnings:[]};
}

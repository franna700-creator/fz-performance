import fs from 'node:fs/promises';
import { getSql } from './db.js';

async function json(relative){return JSON.parse(await fs.readFile(new URL(relative,import.meta.url),'utf8'));}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function date(value){if(!value)return null;if(typeof value==='string')return value.slice(0,10);return new Date(value).toISOString().slice(0,10);}

export async function loadMeasurementRegistry(){return json('../config/measurement-hierarchies.json');}

export async function loadObjectiveRuntimeGraph(){
  const sql=await getSql();
  const [capabilities,profiles,objectives,demands]=await Promise.all([
    sql`SELECT capability_id,name,category,description FROM fz_capabilities ORDER BY capability_id`,
    sql`SELECT profile_id,event_family,variant,knowledge_status,source_authority,profile,verified_at FROM fz_event_format_profiles ORDER BY profile_id`,
    sql`SELECT objective_id,objective_type,name,state,role,strategic_weight,starts_on,ends_on,format_profile_id,knowledge_status,target,metadata FROM fz_objectives ORDER BY objective_id`,
    sql`SELECT objective_id,capability_id,demand_weight,transfer_weight,specificity,provenance FROM fz_objective_capabilities ORDER BY objective_id,capability_id`
  ]);
  if(!objectives.length){
    return {source:'CONFIG_SEED_FALLBACK',objectiveRegistry:await json('../config/objective-seed.json'),formatRegistry:await json('../config/event-format-profiles.json'),warnings:['Runtime objective graph is empty; using versioned config seed for shadow-only evaluation.']};
  }
  const demandByObjective=new Map();
  for(const row of demands){if(!demandByObjective.has(row.objective_id))demandByObjective.set(row.objective_id,[]);demandByObjective.get(row.objective_id).push({capabilityId:row.capability_id,weight:number(row.demand_weight),transferWeight:number(row.transfer_weight),specificity:row.specificity,provenance:row.provenance||{}});}
  const objectiveRegistry={
    version:'1.0',asOf:new Date().toISOString().slice(0,10),
    capabilities:capabilities.map(row=>({id:row.capability_id,name:row.name,category:row.category,description:row.description})),
    events:objectives.filter(row=>row.objective_type==='EVENT').map(row=>({
      id:row.objective_id,name:row.name,date:date(row.starts_on||row.ends_on),status:row.state,role:row.role,strategicWeight:number(row.strategic_weight),objective:row.target||{},demands:demandByObjective.get(row.objective_id)||[],formatProfileId:row.format_profile_id,knowledgeStatus:row.knowledge_status,metadata:row.metadata||{}
    })),
    evergreenObjectives:objectives.filter(row=>row.objective_type==='EVERGREEN').map(row=>({id:row.objective_id,name:row.name,status:row.state,role:row.role,strategicWeight:number(row.strategic_weight),...(row.metadata||{})}))
  };
  const reference=await json('../config/event-format-profiles.json');
  const formatRegistry={
    version:'1.0',asOf:new Date().toISOString().slice(0,10),
    profiles:profiles.map(row=>({...(row.profile||{}),id:row.profile_id,eventFamily:row.event_family,variant:row.variant,sourceAuthority:row.source_authority,knowledgeStatus:row.knowledge_status,verifiedAt:row.verified_at||null})),
    transferRules:reference.transferRules||[],
    nonTransferableOrLowTransfer:reference.nonTransferableOrLowTransfer||[]
  };
  return {source:'NEON_OBJECTIVE_GRAPH',objectiveRegistry,formatRegistry,warnings:[]};
}

function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}
function n(value,fallback=0){const x=Number(value);return Number.isFinite(x)?x:fallback;}
function safeId(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'unknown';}

export function validateMeasurementRegistry(registry = {}) {
  const errors=[];
  if(registry.version!=='1.0') errors.push('measurement registry version must be 1.0');
  const hierarchyIds=new Set();
  for(const hierarchy of registry.hierarchies||[]){
    if(!hierarchy.id||hierarchyIds.has(hierarchy.id)) errors.push(`duplicate/missing hierarchy ${hierarchy.id||'missing'}`);
    hierarchyIds.add(hierarchy.id);
    if(!(hierarchy.eventFamilies||[]).length) errors.push(`${hierarchy.id} missing eventFamilies`);
    const measurementIds=new Set();
    for(const m of hierarchy.measurements||[]){
      if(!m.id||measurementIds.has(m.id)) errors.push(`${hierarchy.id} duplicate/missing measurement ${m.id||'missing'}`);
      measurementIds.add(m.id);
      if(!(Number(m.priority)>0&&Number(m.priority)<=1)) errors.push(`${hierarchy.id}/${m.id} invalid priority`);
      if(!['PRIMARY','SECONDARY','SUPPORTING'].includes(m.tier)) errors.push(`${hierarchy.id}/${m.id} invalid tier`);
      if(!(m.capabilities||[]).length||!m.question) errors.push(`${hierarchy.id}/${m.id} incomplete measurement contract`);
    }
  }
  return {ok:errors.length===0,errors};
}

export function hierarchyForEvent(registry, eventProfile = {}) {
  const family=eventProfile.eventFamily;
  const variant=eventProfile.variant;
  if(!family) return null;
  const exact=(registry?.hierarchies||[]).find(h => (h.eventFamilies||[]).includes(family) && variant && (h.variants||[]).includes(variant));
  if(exact) return exact;
  return (registry?.hierarchies||[]).find(h => (h.eventFamilies||[]).includes(family) && (!(h.variants||[]).length || h.allowFamilyFallback===true)) || null;
}

function evidenceStatus(measurement, evidence = {}) {
  const records = [...(measurement.preferredEvidence||[]), ...(measurement.proxyEvidence||[])];
  const observed=records.filter(key=>evidence[key]!=null);
  if(!observed.length) return {status:'UNKNOWN',quality:'NONE',evidenceKeys:[]};
  const preferred=(measurement.preferredEvidence||[]).filter(key=>evidence[key]!=null);
  return {status:'MEASURED',quality:preferred.length?'DIRECT_OR_PREFERRED':'PROXY',evidenceKeys:observed};
}

function resolveMeasurements(hierarchy,evidence={}){
  const measurements=(hierarchy.measurements||[]).map(m=>({...m,evidence:evidenceStatus(m,evidence)})).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  return {
    status:'READY',hierarchyId:hierarchy.id,eventFamily:hierarchy.eventFamily||null,variant:hierarchy.variant||null,
    hierarchySource:hierarchy.hierarchySource||'SPECIALISED_REGISTRY',measurements,
    gaps:measurements.filter(m=>m.evidence.status==='UNKNOWN').map(m=>({measurementId:m.id,priority:m.priority,tier:m.tier,capabilities:m.capabilities,meaning:'UNMEASURED_NOT_WEAK'})),
    rules:{missingEvidenceIsUnknownNotWeakness:true,measurementPriorityIsNotSessionPrescription:true,directEventEvidenceOutranksProxyEvidence:true,runtimeDemandFallbackAllowed:true}
  };
}

export function resolveMeasurementHierarchy({registry,eventProfile,evidence={}}={}) {
  const hierarchy=hierarchyForEvent(registry,eventProfile||{});
  if(!hierarchy) return {status:'NO_HIERARCHY',hierarchyId:null,eventFamily:eventProfile?.eventFamily||null,measurements:[],gaps:[]};
  return resolveMeasurements({...hierarchy,eventFamily:eventProfile?.eventFamily||null,variant:eventProfile?.variant||null,hierarchySource:'SPECIALISED_REGISTRY'},evidence);
}

export function deriveRuntimeDemandMeasurementHierarchy({primaryEvent,eventProfile,objectiveRegistry,evidence={}}={}){
  const demands=(primaryEvent?.demands||[]).filter(d=>n(d?.weight,0)>0).slice().sort((a,b)=>n(b.weight)-n(a.weight)||String(a.capabilityId||'').localeCompare(String(b.capabilityId||'')));
  if(!primaryEvent||!eventProfile||!demands.length) return {status:'NO_HIERARCHY',hierarchyId:null,eventFamily:eventProfile?.eventFamily||null,measurements:[],gaps:[]};
  const capabilities=new Map((objectiveRegistry?.capabilities||[]).map(cap=>[cap.id,cap]));
  const measurements=demands.map(d=>{
    const priority=clamp(n(d.weight),0.05,1);
    const cap=capabilities.get(d.capabilityId)||{};
    return {
      id:`capability.${safeId(d.capabilityId)}`,
      priority,
      tier:priority>=0.8?'PRIMARY':priority>=0.5?'SECONDARY':'SUPPORTING',
      capabilities:[d.capabilityId],
      preferredEvidence:[`CAPABILITY:${d.capabilityId}`],
      proxyEvidence:[],
      question:`What current event-relevant evidence do we have for ${cap.name||d.capabilityId}?`,
      source:'RUNTIME_PRIMARY_EVENT_DEMAND'
    };
  });
  const hierarchy={
    id:`runtime-demand:${safeId(primaryEvent.id)}:${safeId(primaryEvent.versionToken||primaryEvent.profileVersionToken||'current')}`,
    eventFamily:eventProfile.eventFamily||null,
    variant:eventProfile.variant||null,
    hierarchySource:'RUNTIME_PRIMARY_EVENT_DEMAND',
    measurements
  };
  return resolveMeasurements(hierarchy,evidence);
}

export function resolvePrimaryObjectiveMeasurementHierarchy({objectiveContext,formatRegistry,measurementRegistry,objectiveRegistry,evidence={}}={}) {
  const primary=objectiveContext?.primaryEvent||null;
  if(!primary) return {status:'NO_PRIMARY_OBJECTIVE',primaryEvent:null,measurements:[],gaps:[]};
  const profile=(formatRegistry?.profiles||[]).find(p=>p.id===primary.formatProfileId)||null;
  if(!profile) return {status:'PRIMARY_EVENT_STRUCTURE_PENDING',primaryEvent:primary,measurements:[],gaps:[]};
  const specialised=hierarchyForEvent(measurementRegistry,profile);
  const resolved=specialised
    ? resolveMeasurementHierarchy({registry:measurementRegistry,eventProfile:profile,evidence})
    : deriveRuntimeDemandMeasurementHierarchy({primaryEvent:primary,eventProfile:profile,objectiveRegistry,evidence});
  return {...resolved,primaryEvent:{id:primary.id,name:primary.name,role:primary.role},rules:{...(resolved.rules||{}),specialisedHierarchyOnlyWhenMatched:true,unsupportedEventOrVariantUsesRuntimeDemandFallback:true}};
}

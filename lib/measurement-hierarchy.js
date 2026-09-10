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
  return (registry?.hierarchies||[]).find(h => (h.eventFamilies||[]).includes(eventProfile.eventFamily) && (!(h.variants||[]).length || (h.variants||[]).includes(eventProfile.variant)))
    || (registry?.hierarchies||[]).find(h => (h.eventFamilies||[]).includes(eventProfile.eventFamily))
    || null;
}

function evidenceStatus(measurement, evidence = {}) {
  const records = [...(measurement.preferredEvidence||[]), ...(measurement.proxyEvidence||[])];
  const observed=records.filter(key=>evidence[key]!=null);
  if(!observed.length) return {status:'UNKNOWN',quality:'NONE',evidenceKeys:[]};
  const preferred=(measurement.preferredEvidence||[]).filter(key=>evidence[key]!=null);
  return {status:'MEASURED',quality:preferred.length?'DIRECT_OR_PREFERRED':'PROXY',evidenceKeys:observed};
}

export function resolveMeasurementHierarchy({registry,eventProfile,evidence={}}={}) {
  const hierarchy=hierarchyForEvent(registry,eventProfile||{});
  if(!hierarchy) return {status:'NO_HIERARCHY',hierarchyId:null,eventFamily:eventProfile?.eventFamily||null,measurements:[],gaps:[]};
  const measurements=hierarchy.measurements.map(m=>({...m,evidence:evidenceStatus(m,evidence)})).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  return {
    status:'READY',hierarchyId:hierarchy.id,eventFamily:eventProfile?.eventFamily||null,variant:eventProfile?.variant||null,
    measurements,
    gaps:measurements.filter(m=>m.evidence.status==='UNKNOWN').map(m=>({measurementId:m.id,priority:m.priority,tier:m.tier,capabilities:m.capabilities,meaning:'UNMEASURED_NOT_WEAK'})),
    rules:{missingEvidenceIsUnknownNotWeakness:true,measurementPriorityIsNotSessionPrescription:true,directEventEvidenceOutranksProxyEvidence:true}
  };
}

export function resolvePrimaryObjectiveMeasurementHierarchy({objectiveContext,formatRegistry,measurementRegistry,evidence={}}={}) {
  const primary=objectiveContext?.primaryEvent||null;
  if(!primary) return {status:'NO_PRIMARY_OBJECTIVE',primaryEvent:null,measurements:[],gaps:[]};
  const profile=(formatRegistry?.profiles||[]).find(p=>p.id===primary.formatProfileId)||null;
  if(!profile) return {status:'PRIMARY_EVENT_STRUCTURE_PENDING',primaryEvent:primary,measurements:[],gaps:[]};
  return {...resolveMeasurementHierarchy({registry:measurementRegistry,eventProfile:profile,evidence}),primaryEvent:{id:primary.id,name:primary.name,role:primary.role}};
}

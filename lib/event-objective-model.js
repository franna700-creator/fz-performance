const ROLE_WEIGHT = Object.freeze({ PRIMARY: 1, SECONDARY: 0.7, VALIDATION: 0.4, MAINTENANCE: 0.6 });
const EVENT_STATES = new Set(['SCHEDULED','ACTIVE','COMPLETED','CANCELLED']);
const SPECIFICITY = new Set(['SHARED','EVENT_SPECIFIC','SUPPORT']);

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function dateOnly(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null; }
function dayNumber(date) { return Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 86400000); }

export function validateObjectiveRegistry(registry = {}) {
  const errors = [];
  if (registry.version !== '1.0') errors.push('registry version must be 1.0');
  const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : [];
  const events = Array.isArray(registry.events) ? registry.events : [];
  const capIds = new Set();
  for (const cap of capabilities) {
    if (!cap?.id || capIds.has(cap.id)) errors.push(`invalid or duplicate capability id: ${cap?.id || 'missing'}`);
    capIds.add(cap?.id);
  }
  const eventIds = new Set();
  for (const event of events) {
    if (!event?.id || eventIds.has(event.id)) errors.push(`invalid or duplicate event id: ${event?.id || 'missing'}`);
    eventIds.add(event?.id);
    if (!dateOnly(event?.date)) errors.push(`event ${event?.id || 'unknown'} has invalid date`);
    if (!EVENT_STATES.has(event?.status)) errors.push(`event ${event?.id || 'unknown'} has invalid status`);
    if (!(event?.role in ROLE_WEIGHT)) errors.push(`event ${event?.id || 'unknown'} has invalid role`);
    if (n(event?.strategicWeight, -1) < 0 || n(event?.strategicWeight, 2) > 1) errors.push(`event ${event?.id || 'unknown'} strategicWeight must be 0..1`);
    const seenDemand = new Set();
    for (const demand of event?.demands || []) {
      if (!capIds.has(demand?.capabilityId)) errors.push(`event ${event.id} references unknown capability ${demand?.capabilityId}`);
      if (seenDemand.has(demand?.capabilityId)) errors.push(`event ${event.id} duplicates capability ${demand?.capabilityId}`);
      seenDemand.add(demand?.capabilityId);
      if (!SPECIFICITY.has(demand?.specificity)) errors.push(`event ${event.id} has invalid specificity for ${demand?.capabilityId}`);
      if (n(demand?.weight, -1) < 0 || n(demand?.weight, 2) > 1) errors.push(`event ${event.id} demand weight must be 0..1`);
      if (n(demand?.transferWeight, -1) < 0 || n(demand?.transferWeight, 2) > 1) errors.push(`event ${event.id} transferWeight must be 0..1`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function eventRunway(event, nowDate) {
  const date = dateOnly(event?.date), now = dateOnly(nowDate);
  if (!date || !now) return null;
  return dayNumber(date) - dayNumber(now);
}

export function proximityFactor(days) {
  if (!Number.isFinite(days)) return 1;
  if (days < 0) return 0;
  if (days <= 3) return 1.35;
  if (days <= 10) return 1.2;
  if (days <= 28) return 1.1;
  return 1;
}

export function eventStrategicWeight(event) {
  if (!event || ['COMPLETED','CANCELLED'].includes(event.status)) return 0;
  return clamp(n(event.strategicWeight) * (ROLE_WEIGHT[event.role] || 0), 0, 1);
}

export function eventPlanningWeight(event, nowDate) {
  const strategic = eventStrategicWeight(event);
  if (!strategic) return 0;
  const runway = eventRunway(event, nowDate);
  return clamp(strategic * proximityFactor(runway), 0, 1);
}

function demandMap(event) {
  return new Map((event?.demands || []).map(demand => [demand.capabilityId, demand]));
}

export function sharedCapabilityTransfer(eventA, eventB) {
  const a = demandMap(eventA), b = demandMap(eventB);
  const all = new Set([...a.keys(), ...b.keys()]);
  let intersection = 0, union = 0;
  const shared = [];
  for (const id of all) {
    const da = a.get(id), db = b.get(id);
    const wa = n(da?.weight), wb = n(db?.weight);
    intersection += Math.min(wa, wb);
    union += Math.max(wa, wb);
    if (!da || !db) continue;
    const transfer = Math.sqrt(wa * wb) * ((n(da.transferWeight) + n(db.transferWeight)) / 2);
    shared.push({ capabilityId:id, eventAWeight:wa, eventBWeight:wb, transfer:Math.round(transfer*1000)/1000, specificity: da.specificity === 'EVENT_SPECIFIC' || db.specificity === 'EVENT_SPECIFIC' ? 'LIMITED' : 'SHARED' });
  }
  shared.sort((x,y) => y.transfer - x.transfer);
  return { eventAId:eventA?.id || null, eventBId:eventB?.id || null, similarity:union ? Math.round((intersection/union)*1000)/1000 : 0, shared };
}

export function capabilityPriorities(registry, nowDate) {
  const names = new Map((registry?.capabilities || []).map(cap => [cap.id, cap]));
  const out = new Map();
  for (const event of registry?.events || []) {
    const strategicWeight = eventStrategicWeight(event);
    const nearTermWeight = eventPlanningWeight(event, nowDate);
    if (!strategicWeight && !nearTermWeight) continue;
    for (const demand of event.demands || []) {
      const strategicContribution = strategicWeight * n(demand.weight);
      const nearTermContribution = nearTermWeight * n(demand.weight);
      const current = out.get(demand.capabilityId) || { capabilityId:demand.capabilityId, name:names.get(demand.capabilityId)?.name || demand.capabilityId, strategicScore:0, nearTermScore:0, events:[] };
      current.strategicScore += strategicContribution;
      current.nearTermScore += nearTermContribution;
      current.events.push({ eventId:event.id, eventName:event.name, role:event.role, strategicContribution:Math.round(strategicContribution*1000)/1000, nearTermContribution:Math.round(nearTermContribution*1000)/1000, specificity:demand.specificity });
      out.set(demand.capabilityId,current);
    }
  }
  return [...out.values()].map(row => ({ ...row, strategicScore:Math.round(row.strategicScore*1000)/1000, nearTermScore:Math.round(row.nearTermScore*1000)/1000, events:row.events.sort((a,b)=>b.strategicContribution-a.strategicContribution) })).sort((a,b)=>b.strategicScore-a.strategicScore || b.nearTermScore-a.nearTermScore || a.name.localeCompare(b.name));
}

export function buildObjectiveContext(registry, nowDate) {
  const validation = validateObjectiveRegistry(registry);
  if (!validation.ok) throw new Error(`invalid objective registry: ${validation.errors.join('; ')}`);
  const now = dateOnly(nowDate);
  if (!now) throw new Error('nowDate must be YYYY-MM-DD');
  const scheduled = (registry.events || []).filter(event => !['COMPLETED','CANCELLED'].includes(event.status) && eventRunway(event,now) >= 0).map(event => ({ ...event, runwayDays:eventRunway(event,now), strategicWeightResolved:eventStrategicWeight(event), nearTermPlanningWeight:eventPlanningWeight(event,now) })).sort((a,b)=>a.runwayDays-b.runwayDays);
  const primary = scheduled.filter(event => event.role === 'PRIMARY').sort((a,b)=>b.strategicWeight-a.strategicWeight || a.runwayDays-b.runwayDays)[0] || null;
  const overlaps=[];
  for(let i=0;i<scheduled.length;i+=1) for(let j=i+1;j<scheduled.length;j+=1) overlaps.push(sharedCapabilityTransfer(scheduled[i],scheduled[j]));
  const nextEvergreenCandidate = primary ? null : (registry.evergreenObjectives || []).find(objective => objective.status === 'DORMANT') || null;
  return { version:'1.0', asOf:now, primaryEvent:primary, upcomingEvents:scheduled, capabilityPriorities:capabilityPriorities(registry,now), overlaps:overlaps.sort((a,b)=>b.similarity-a.similarity), nextEvergreenCandidate, rules:{ proximityDoesNotOverrideStrategicPriority:true, sharedCapabilityDoesNotMakeEventsEquivalent:true, completedOrCancelledEventsDoNotDriveCurrentPlanning:true, evergreenActivationRequiresConfirmation:true } };
}

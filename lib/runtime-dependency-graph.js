import { FZ_DATA_CONTRACTS } from './data-contract-registry.js';

export const FZ_DEPENDENCY_GRAPH = Object.freeze({
  'source.garmin.wellness':['wellness.current'],
  'wellness.current':['recovery.current','materiality.current','adaptive.context','ui.today','ui.trends'],
  'recovery.current':['materiality.current','adaptive.context','ui.today','ui.trends'],

  'source.tredict.activity':['training.session','training.evidence'],
  'source.garmin.activity':['training.session','training.evidence'],
  'training.session':['process.reconcileAthleteMemory','training.evidence','training.identity','training.intent','materiality.current','ui.train'],
  'training.evidence':['training.identity','training.intent','trends.ncl','performance.aet','capability.evidence','materiality.current','ui.train','ui.trends'],

  'source.athlete.feedback':['athlete.memory'],
  'athlete.memory':['process.reconcileAthleteMemory','recovery.current','training.identity','training.intent','performance.aet','capability.evidence','materiality.current','adaptive.context','ui.train','ui.trends'],
  'process.reconcileAthleteMemory':['training.identity','capability.evidence','materiality.current','adaptive.context','ui.train','ui.trends'],
  'training.identity':['adaptive.context','ui.today','ui.train','ui.trends'],
  'training.intent':['adaptive.context','ui.train','ui.system'],

  'trends.ncl':['load.rolling','materiality.current','adaptive.context','ui.trends'],
  'load.rolling':['materiality.current','adaptive.context','ui.trends'],
  'performance.aet':['capability.evidence','adaptive.context','ui.trends'],

  'source.athlete.event':['event.intake'],
  'source.research.event':['event.intake','event.format'],
  'source.athlete.objective':['objective.graph'],
  'event.intake':['event.format','event.intelligence','objective.graph','ui.system'],
  'event.format':['event.intelligence','capability.priority','ui.system'],
  'objective.graph':['event.intelligence','capability.priority','adaptive.context','ui.system','ui.trends'],
  'event.intelligence':['capability.evidence','capability.priority','adaptive.context','ui.trends','ui.system'],
  'capability.evidence':['capability.priority','adaptive.context','ui.trends'],
  'capability.priority':['adaptive.context','recommendation.current','ui.trends'],

  'materiality.current':['adaptive.context','recommendation.current','ui.system'],
  'adaptive.context':['recommendation.current','ui.system'],
  'recommendation.current':['adaptive.choice','ui.today'],
  'source.athlete.choice':['adaptive.choice'],
  'adaptive.choice':['athlete.memory','ui.today']
});

export function affectedNodes(changedNodes, graph = FZ_DEPENDENCY_GRAPH) {
  const queue = Array.isArray(changedNodes) ? [...changedNodes] : [changedNodes];
  const seen = new Set(queue.filter(Boolean));
  while (queue.length) {
    const node = queue.shift();
    for (const next of graph[node] || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen];
}

export function affectedSurfaces(changedNodes, graph = FZ_DEPENDENCY_GRAPH) {
  return [...new Set(affectedNodes(changedNodes,graph).filter(node => node.startsWith('ui.')).map(node => node.slice(3).toUpperCase()))].sort();
}

export function validateDependencyGraph(graph = FZ_DEPENDENCY_GRAPH, contracts = FZ_DATA_CONTRACTS) {
  const errors=[];
  const contractIds=new Set(contracts.map(c=>c.id));
  const allowedSpecial=node => node.startsWith('source.') || node.startsWith('process.') || node.startsWith('ui.');
  for (const [from,tos] of Object.entries(graph)) {
    if (!contractIds.has(from) && !allowedSpecial(from)) errors.push(`unowned dependency node ${from}`);
    if (!Array.isArray(tos)) { errors.push(`${from} dependencies must be array`); continue; }
    for (const to of tos) if (!contractIds.has(to) && !allowedSpecial(to)) errors.push(`unowned dependency target ${from} -> ${to}`);
  }
  for (const contract of contracts) {
    const direct=new Set(graph[contract.id] || []);
    for (const consumer of contract.consumers || []) if (!direct.has(consumer) && !affectedNodes(contract.id,graph).includes(consumer)) errors.push(`${contract.id} declared consumer ${consumer} absent from dependency closure`);
    for (const trigger of contract.refreshTriggers || []) {
      const closure=affectedNodes(trigger,graph);
      if (!closure.includes(contract.id) && trigger !== contract.id) errors.push(`${contract.id} refresh trigger ${trigger} does not reach contract`);
    }
  }
  return {ok:errors.length===0,errors};
}

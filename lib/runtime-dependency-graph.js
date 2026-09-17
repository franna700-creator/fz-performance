import { FZ_DATA_CONTRACTS } from './data-contract-registry.js';

export const FZ_DEPENDENCY_GRAPH = Object.freeze({
  'clock.local_day':['athlete.state.current','measurement.evidence','objective.graph','adaptive.context','ui.system'],
  'clock.decision_window':['athlete.state.current','adaptive.context','ui.system'],

  'source.garmin.wellness':['wellness.current','wellness.history'],
  'wellness.current':['recovery.current','materiality.current','readiness.current','adaptive.context','ui.today','ui.trends'],
  'wellness.history':['trends.summary','ui.trends'],
  'recovery.current':['materiality.current','readiness.current','adaptive.context','ui.today','ui.trends'],

  'source.tredict.activity':['training.session','training.evidence','process.reconcilePlannedIntent'],
  'source.garmin.activity':['training.session','training.evidence','process.reconcilePlannedIntent'],
  'training.session':['process.reconcileAthleteMemory','process.reconcilePlannedIntent','training.evidence','training.identity','training.intent','choice.outcome','materiality.current','ui.train'],
  'process.reconcilePlannedIntent':['measurement.evidence','training.session','materiality.current','adaptive.context','ui.train','ui.system'],
  'training.evidence':['measurement.evidence','training.identity','training.intent','trends.ncl','performance.aet','capability.evidence','materiality.current','trends.summary','ui.train','ui.trends'],

  'source.athlete.feedback':['athlete.memory'],
  'athlete.memory':['athlete.state.current','measurement.evidence','process.reconcileAthleteMemory','training.identity','training.intent','performance.aet','capability.evidence','choice.outcome','materiality.current','adaptive.context','trends.summary','ui.train','ui.trends'],
  'athlete.state.current':['recovery.current','readiness.current','adaptive.context','ui.today','ui.system','ui.trends'],
  'choice.outcome':['ui.system'],
  'process.reconcileAthleteMemory':['training.identity','capability.evidence','materiality.current','adaptive.context','ui.train','ui.trends'],
  'training.identity':['adaptive.context','ui.today','ui.train','ui.trends'],
  'training.intent':['adaptive.context','ui.train','ui.system'],

  'trends.ncl':['load.rolling','materiality.current','adaptive.context','ui.trends'],
  'load.rolling':['materiality.current','adaptive.context','trends.summary','ui.trends'],
  'performance.aet':['capability.evidence','adaptive.context','trends.summary','ui.trends'],

  'source.athlete.event':['event.intake'],
  'source.research.event':['event.intake','event.format'],
  'source.athlete.objective':['objective.graph'],
  'event.intake':['event.format','event.intelligence','objective.graph','ui.system'],
  'event.format':['event.demand_taxonomy','event.intelligence','capability.priority','ui.system'],
  'event.demand_taxonomy':['event.intelligence','capability.priority','measurement.hierarchy','ui.trends'],
  'objective.graph':['event.intelligence','capability.priority','measurement.hierarchy','adaptive.context','ui.system','ui.trends'],
  'event.intelligence':['capability.evidence','capability.priority','adaptive.context','ui.trends','ui.system'],
  'capability.evidence':['capability.priority','measurement.hierarchy','adaptive.context','trends.summary','ui.trends'],
  'capability.priority':['measurement.hierarchy','adaptive.context','ui.trends'],
  'measurement.evidence':['capability.evidence','measurement.hierarchy','adaptive.context','ui.goals'],
  'measurement.hierarchy':['adaptive.context','trends.summary','ui.trends','ui.goals'],
  'trends.summary':['ui.trends'],

  'source.canonical.mutation':['canonical.revision'],
  'canonical.revision':['convergence.status','ui.system'],
  'convergence.status':['ui.system'],

  'source.fz.runtime.publish':['adaptive.context'],
  'materiality.current':['readiness.current','adaptive.context','recommendation.shadow','ui.system'],
  'readiness.current':['adaptive.context','ui.today','ui.trends'],
  'adaptive.context':['recommendation.shadow','ui.system'],
  'recommendation.shadow':['recommendation.current','ui.system'],
  'source.fz.recommendation.publish':['recommendation.current'],
  'recommendation.current':['recommendation.explanation','adaptive.choice','ui.today','ui.train'],
  'recommendation.explanation':['adaptive.choice','ui.today','ui.train'],
  'source.athlete.choice':['adaptive.choice'],
  'adaptive.choice':['athlete.memory','training.session','materiality.current','adaptive.context','ui.today','ui.train','ui.system']
});

export function dependencyNodeSet(graph = FZ_DEPENDENCY_GRAPH) {
  const nodes = new Set(Object.keys(graph));
  for (const targets of Object.values(graph)) for (const target of targets || []) nodes.add(target);
  return nodes;
}

export function unknownDependencyNodes(changedNodes, graph = FZ_DEPENDENCY_GRAPH) {
  const nodes = Array.isArray(changedNodes) ? changedNodes : [changedNodes];
  const known = dependencyNodeSet(graph);
  return [...new Set(nodes.filter(Boolean).filter(node => !known.has(node)))];
}

export function assertKnownChangedNodes(changedNodes, graph = FZ_DEPENDENCY_GRAPH) {
  const unknown = unknownDependencyNodes(changedNodes, graph);
  if (unknown.length) throw new Error(`unknown_dependency_node:${unknown.sort().join(',')}`);
  return true;
}

export function affectedNodes(changedNodes, graph = FZ_DEPENDENCY_GRAPH) {
  const queue=Array.isArray(changedNodes)?[...changedNodes]:[changedNodes];
  const seen=new Set(queue.filter(Boolean));
  while(queue.length){
    const node=queue.shift();
    for(const next of graph[node]||[]){
      if(seen.has(next))continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen];
}

export function affectedSurfaces(changedNodes, graph = FZ_DEPENDENCY_GRAPH) {
  return [...new Set(affectedNodes(changedNodes,graph).filter(node=>node.startsWith('ui.')).map(node=>node.slice(3).toUpperCase()))].sort();
}

export function validateDependencyGraph(graph = FZ_DEPENDENCY_GRAPH, contracts = FZ_DATA_CONTRACTS) {
  const errors=[];
  const contractIds=new Set(contracts.map(c=>c.id));
  const allowedSpecial=node=>node.startsWith('source.')||node.startsWith('process.')||node.startsWith('ui.')||node.startsWith('clock.');
  for(const [from,tos] of Object.entries(graph)){
    if(!contractIds.has(from)&&!allowedSpecial(from))errors.push(`unowned dependency node ${from}`);
    if(!Array.isArray(tos)){errors.push(`${from} dependencies must be array`);continue;}
    for(const to of tos)if(!contractIds.has(to)&&!allowedSpecial(to))errors.push(`unowned dependency target ${from} -> ${to}`);
  }
  for(const contract of contracts){
    const direct=new Set(graph[contract.id]||[]);
    for(const consumer of contract.consumers||[])if(!direct.has(consumer)&&!affectedNodes(contract.id,graph).includes(consumer))errors.push(`${contract.id} declared consumer ${consumer} absent from dependency closure`);
    for(const trigger of contract.refreshTriggers||[]){
      const closure=affectedNodes(trigger,graph);
      if(!closure.includes(contract.id)&&trigger!==contract.id)errors.push(`${contract.id} refresh trigger ${trigger} does not reach contract`);
    }
  }
  return {ok:errors.length===0,errors};
}

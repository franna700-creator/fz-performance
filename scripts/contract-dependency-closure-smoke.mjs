import { FZ_DATA_CONTRACTS, validateDataContractRegistry } from '../lib/data-contract-registry.js';
import { FZ_DEPENDENCY_GRAPH, affectedNodes, validateDependencyGraph } from '../lib/runtime-dependency-graph.js';

const registry=validateDataContractRegistry();
if(!registry.ok) throw new Error(`Registry invalid: ${registry.errors.join('; ')}`);
const graph=validateDependencyGraph();
if(!graph.ok) throw new Error(`Dependency graph invalid: ${graph.errors.join('; ')}`);

for (const contract of FZ_DATA_CONTRACTS) {
  const closure=affectedNodes(contract.id,FZ_DEPENDENCY_GRAPH);
  for (const consumer of contract.consumers) if(!closure.includes(consumer)) throw new Error(`${contract.id} does not propagate to ${consumer}`);
}

const mustReach={
  'source.garmin.wellness':['ui.today','adaptive.context'],
  'source.tredict.activity':['ui.train','ui.trends','adaptive.context'],
  'source.athlete.feedback':['ui.train','ui.trends','adaptive.context'],
  'source.athlete.event':['ui.system','ui.trends','adaptive.context'],
  'source.research.event':['event.demand_taxonomy','event.intelligence','capability.priority'],
  'source.athlete.objective':['measurement.hierarchy','adaptive.context','recommendation.explanation'],
};
for (const [source,targets] of Object.entries(mustReach)) {
  const closure=affectedNodes(source);
  for(const target of targets) if(!closure.includes(target)) throw new Error(`${source} must reach ${target}`);
}
console.log('PASS v0.7 RC8 contract/dependency closure: declared owners, triggers and consumers are mutually consistent');

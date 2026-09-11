import { FZ_DATA_CONTRACTS, validateDataContractRegistry } from '../lib/data-contract-registry.js';
import { FZ_DEPENDENCY_GRAPH, affectedNodes, validateDependencyGraph } from '../lib/runtime-dependency-graph.js';

const registry=validateDataContractRegistry();
if(!registry.ok) throw new Error(`Registry invalid: ${registry.errors.join('; ')}`);
const graph=validateDependencyGraph();
if(!graph.ok) throw new Error(`Dependency graph invalid: ${graph.errors.join('; ')}`);

for(const contract of FZ_DATA_CONTRACTS){
  const closure=affectedNodes(contract.id,FZ_DEPENDENCY_GRAPH);
  for(const consumer of contract.consumers){
    if(!closure.includes(consumer)) throw new Error(`${contract.id} does not propagate to ${consumer}`);
  }
}

const mustReach={
  'source.garmin.wellness':['ui.today','adaptive.context','recommendation.shadow','recommendation.current'],
  'source.tredict.activity':['ui.train','ui.trends','adaptive.context','recommendation.shadow','recommendation.current'],
  'source.athlete.feedback':['ui.train','ui.trends','adaptive.context','recommendation.shadow','recommendation.current'],
  'source.athlete.event':['ui.system','ui.trends','adaptive.context','recommendation.shadow','recommendation.current'],
  'source.research.event':['event.demand_taxonomy','event.intelligence','capability.priority'],
  'source.athlete.objective':['measurement.hierarchy','adaptive.context','recommendation.shadow','recommendation.current'],
  'recommendation.shadow':['recommendation.current','recommendation.explanation','ui.today']
};
for(const [source,targets] of Object.entries(mustReach)){
  const closure=affectedNodes(source);
  for(const target of targets) if(!closure.includes(target)) throw new Error(`${source} must reach ${target}`);
}

const directShadowTargets=new Set(FZ_DEPENDENCY_GRAPH['recommendation.shadow']||[]);
if(!directShadowTargets.has('recommendation.current')) throw new Error('4.3 requires explicit shadow to active projection edge');
if(directShadowTargets.has('ui.today')) throw new Error('shadow must not bypass recommendation.current and write TODAY directly');
if(directShadowTargets.has('adaptive.choice')) throw new Error('shadow must not manufacture athlete choice');

console.log('PASS v0.8 RC1 contract/dependency closure: evidence reaches immutable 4.2 shadow, then 4.3 active recommendation, and TODAY only through the active projection boundary');

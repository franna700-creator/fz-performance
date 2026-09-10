import { affectedNodes, affectedSurfaces, validateDependencyGraph } from '../lib/runtime-dependency-graph.js';

const valid=validateDependencyGraph();
if(!valid.ok) throw new Error(valid.errors.join('; '));

const training=affectedNodes('source.tredict.activity');
for(const node of ['training.session','training.evidence','trends.ncl','load.rolling','capability.evidence','adaptive.context','recommendation.shadow']) {
  if(!training.includes(node)) throw new Error(`Training change does not reach ${node}`);
}
if(training.includes('recommendation.current')) throw new Error('Training evidence may not directly refresh active recommendation.current during 4.2 shadow');
for(const surface of ['TODAY','TRAIN','TRENDS','SYSTEM']) {
  if(!affectedSurfaces('source.tredict.activity').includes(surface)) throw new Error(`Training change does not invalidate ${surface}`);
}

const event=affectedNodes('source.athlete.event');
for(const node of ['event.intake','event.format','event.intelligence','capability.priority','adaptive.context','recommendation.shadow']) {
  if(!event.includes(node)) throw new Error(`Event change does not reach ${node}`);
}
if(event.includes('recommendation.current')) throw new Error('Event/objective changes may not directly activate recommendation.current during 4.2 shadow');

const runtimePublish=affectedNodes('source.fz.runtime.publish');
for(const node of ['adaptive.context','recommendation.shadow','ui.system']) {
  if(!runtimePublish.includes(node)) throw new Error(`Canonical runtime publication does not reach ${node}`);
}
if(runtimePublish.includes('recommendation.current')||runtimePublish.includes('ui.today')) throw new Error('Canonical runtime publication may recompute shadow but may not activate TODAY during 4.2');

const publish=affectedNodes('source.fz.recommendation.publish');
for(const node of ['recommendation.current','recommendation.explanation','ui.today']) {
  if(!publish.includes(node)) throw new Error(`Explicit recommendation publish path does not reach ${node}`);
}

console.log('PASS v0.8 RC1 dependency graph: source and canonical-state changes reach isolated shadow recomputation; active TODAY recommendation requires explicit publish');

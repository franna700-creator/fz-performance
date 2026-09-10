import { FZ_DEPENDENCY_GRAPH, affectedNodes, affectedSurfaces, validateDependencyGraph } from '../lib/runtime-dependency-graph.js';

const valid=validateDependencyGraph();
if(!valid.ok) throw new Error(valid.errors.join('; '));

const training=affectedNodes('source.tredict.activity');
for(const node of ['training.session','training.evidence','materiality.current','trends.ncl','load.rolling','capability.evidence','adaptive.context','recommendation.shadow','recommendation.current']) {
  if(!training.includes(node)) throw new Error(`Training change does not reach ${node}`);
}
if((FZ_DEPENDENCY_GRAPH['training.evidence']||[]).includes('recommendation.current')) throw new Error('Training evidence may not bypass materiality/shadow and directly target recommendation.current');
if(!(FZ_DEPENDENCY_GRAPH['recommendation.shadow']||[]).includes('recommendation.current')) throw new Error('4.3 activation must project from immutable recommendation.shadow');
for(const surface of ['TODAY','TRAIN','TRENDS','SYSTEM']) {
  if(!affectedSurfaces('source.tredict.activity').includes(surface)) throw new Error(`Training change does not invalidate ${surface}`);
}

const event=affectedNodes('source.athlete.event');
for(const node of ['event.intake','event.format','event.intelligence','capability.priority','adaptive.context','recommendation.shadow','recommendation.current']) {
  if(!event.includes(node)) throw new Error(`Event change does not reach ${node}`);
}
if((FZ_DEPENDENCY_GRAPH['event.intake']||[]).includes('recommendation.current')) throw new Error('Event/objective evidence may not bypass intelligence and directly activate recommendation.current');

const runtimePublish=affectedNodes('source.fz.runtime.publish');
for(const node of ['adaptive.context','recommendation.shadow','recommendation.current','ui.system','ui.today']) {
  if(!runtimePublish.includes(node)) throw new Error(`Canonical runtime publication does not reach ${node}`);
}

const legacyPublish=affectedNodes('source.fz.recommendation.publish');
for(const node of ['recommendation.current','recommendation.explanation','ui.today']) {
  if(!legacyPublish.includes(node)) throw new Error(`Legacy explicit recommendation publish path does not reach ${node}`);
}

console.log('PASS v0.8 RC1 dependency graph: evidence reaches active TODAY only through canonical intelligence and immutable shadow projection');

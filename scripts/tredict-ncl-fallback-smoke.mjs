import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reconstructHeartRateIntensityDistribution } from '../lib/tredict-client.js';

const zones = [
  { from: -1, to: 143, intensity: 0 },
  { from: 144, to: 162, intensity: 1 },
  { from: 163, to: -1, intensity: 2 }
];

const existing = {
  summary: {
    durationTotal: 60,
    intensityDistribution: { heartrate: { 0: 45, 1: 10, 2: 5 } }
  },
  seriesSampled: { data: { heartrate: [100, 150, 170] } },
  currentZones: { heartrate: zones }
};
assert.deepEqual(
  reconstructHeartRateIntensityDistribution(existing).summary.intensityDistribution.heartrate,
  existing.summary.intensityDistribution.heartrate,
  'canonical Tredict intensity aggregate must always outrank derived fallback'
);

const reconstructable = {
  summary: { durationTotal: 60 },
  seriesSampled: { data: { heartrate: [100, 150, 170] } },
  currentZones: { heartrate: zones }
};
const reconstructed = reconstructHeartRateIntensityDistribution(reconstructable);
assert.deepEqual(reconstructed.summary.intensityDistribution.heartrate, { 0: 20, 1: 20, 2: 20 });
assert.equal(
  Object.values(reconstructed.summary.intensityDistribution.heartrate).reduce((sum, value) => sum + value, 0),
  60,
  'derived intensity seconds must conserve activity duration'
);
assert.equal(
  reconstructed.summary._fzIntensityDistributionDerivation,
  'seriesSampled.heartrate+currentZones.heartrate'
);

const noSamples = reconstructHeartRateIntensityDistribution({
  summary: { durationTotal: 60 },
  currentZones: { heartrate: zones }
});
assert.equal(noSamples.summary.intensityDistribution, undefined, 'missing HR samples must remain missing rather than inferred');

const partialSamples = reconstructHeartRateIntensityDistribution({
  summary: { durationTotal: 50 },
  seriesSampled: { data: { heartrate: [100, null, 170, 150, undefined] } },
  currentZones: { heartrate: zones }
});
assert.equal(
  Object.values(partialSamples.summary.intensityDistribution.heartrate).reduce((sum, value) => sum + value, 0),
  50,
  'usable samples may be normalized to duration while null samples stay excluded'
);
assert.ok(partialSamples.summary.intensityDistribution.heartrate[0] > 0);
assert.ok(partialSamples.summary.intensityDistribution.heartrate[1] > 0);
assert.ok(partialSamples.summary.intensityDistribution.heartrate[2] > 0);

const clientSource = fs.readFileSync('lib/tredict-client.js', 'utf8');
const activityListBlock = clientSource.match(/async function activityList\(args = \{\}\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(activityListBlock.includes('endDate: args.endDate'), 'Tredict executed-activity requests must honor the lower endDate bound supplied by canonical sync');
assert.ok(activityListBlock.includes('startDate: args.startDate'), 'Tredict executed-activity requests must honor the upper startDate bound supplied by canonical sync');

console.log('PASS Tredict NCL fallback + bounded activity ingestion: source aggregate priority, zone reconstruction, duration conservation, missing-data isolation, and explicit date bounds');

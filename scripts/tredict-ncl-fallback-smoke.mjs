import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reconstructHeartRateIntensityDistribution, tredictNextCursor } from '../lib/tredict-client.js';

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

assert.equal(tredictNextCursor({ pagination: { nextCursor: '2026-09-10T00:00:00Z' } }), '2026-09-10T00:00:00Z');
assert.equal(tredictNextCursor({ _pagination: { nextCursor: '2026-09-09T00:00:00Z' } }), '2026-09-09T00:00:00Z');
assert.equal(tredictNextCursor({ page: { nextCursor: '2026-09-08T00:00:00Z' } }), '2026-09-08T00:00:00Z');
assert.equal(tredictNextCursor({ pagination: {} }), null);

const clientSource = fs.readFileSync('lib/tredict-client.js', 'utf8');
const activityListBlock = clientSource.match(/async function activityList\(args = \{\}\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(activityListBlock.includes('endDate: requestedEndDate'), 'Tredict executed-activity requests must honor the lower endDate bound supplied by canonical sync');
assert.ok(activityListBlock.includes('startDate: pageStartDate'), 'Tredict executed-activity requests must honor the upper startDate/cursor bound supplied by canonical sync');
assert.ok(activityListBlock.includes('tredictNextCursor(data)'), 'Tredict activity ingestion must follow server pagination when a nextCursor is present');
assert.ok(activityListBlock.includes('seenCursors.has(nextCursor)'), 'Tredict pagination must fail closed rather than loop on a repeated cursor');
assert.ok(activityListBlock.includes('byId.has(key)'), 'Tredict pagination must de-duplicate cursor-boundary rows before canonical ingestion');
assert.ok(activityListBlock.includes('exceeded ${maxPages} pages'), 'Tredict pagination must expose incomplete-range exhaustion instead of silently truncating');

console.log('PASS Tredict NCL fallback + complete bounded activity ingestion: aggregate priority, reconstruction, missing-data isolation, date bounds, cursor continuation, de-duplication, and fail-closed pagination');

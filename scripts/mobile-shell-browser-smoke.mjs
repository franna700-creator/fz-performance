import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist = path.resolve('dist');
const requestCounts = new Map();
const pageErrors = [];

function count(pathname) {
  requestCounts.set(pathname, (requestCounts.get(pathname) || 0) + 1);
}
function json(res, value) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
function staticFile(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const file = path.join(dist, rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(file);
  const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'text/html';
  res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

const runtime = {
  ok: true,
  stateId: '2026-09-10T20:00:00+02:00',
  masterAsOf: '2026-09-10T20:00:00+02:00',
  renderContract: {
    readiness: {
      score: 68,
      status: 'MODIFY / RECOVER · POST-SESSION ABSORPTION',
      systemicRecovery: 'MORNING RECOVERY SIGNAL REMAINED SOFTENED. Sleep5.21 h / score64 and RHR59 were the limiting systemic anchors.',
      localTissueState: 'CURRENT LOCAL / GI / STRENGTH RESPONSE NOT CAPTURED.',
      primaryDecision: 'No further quality tonight.',
      successCriteria: 'Reassess tomorrow.'
    }
  }
};
const wellness = {
  ok: true,
  source: { status: 'CONNECTED' },
  wellness: {
    date: '2026-09-13', freshness: 'LIVE', sourceAsOf: '2026-09-13T18:00:00.000Z', ingestedAt: '2026-09-13T18:01:00.000Z',
    current: { steps: 12000, distanceKm: 8.4, bodyBattery: 5, bodyBatteryHigh: 24, bodyBatteryLow: 5, stress: 28, stressAvg: 46, heartRate: 78, restingHeartRate: 60, hrv: 41, sleepScore: 39, sleepHours: 5.81, activeCalories: 640, activeMinutes: 72, respiration: 14.1 },
    series: { body_battery: [], stress: [], heart_rate: [], respiration: [] }
  }
};
const training = {
  ok: true,
  sessions: [{
    session_id: 'exec:test:run', local_date: '2026-09-13', actual_start_at: '2026-09-13T06:00:00.000Z', title: 'Test Run', sport_type: 'Running', status: 'COMPLETED', session_kind: null,
    classification: { modality: 'RUNNING', adaptiveIntent: 'MAINTAIN', confidence: 'HIGH' },
    metrics: { durationSeconds: 1800, distanceMeters: 5000, avgHeartRate: 140, maxHeartRate: 160, calories: 350, paceSecPerKm: 360, avgPowerWatts: 330, cadence: 170, elevationGainMeters: 40 },
    workoutDetail: { hasDetail: true, physiology: { heartRateEffort: 40, hrIntensitySeconds: [1200,600,0], hrIntensityShares: { low: 0.667, moderate: 0.333, high: 0 } }, running: { runningEffectiveness: 0.7, groundContactTimeMs: 250, flightTimeMs: 100, stepLengthCm: 110, avgPowerWatts: 330, maxPowerWatts: 500, avgCadence: 170, maxCadence: 180 }, strength: null },
    evidence: { sourceKeys: ['tredict','garmin'], hasMetrics: true, hasWorkoutDetail: true },
    events: [{ actor: 'ATHLETE', occurred_at: '2026-09-13T06:35:00.000Z', summary: 'Felt controlled and good.' }],
    sources: [{ source_key: 'tredict' }, { source_key: 'garmin' }]
  }],
  contextEvents: [], integrity: { sessionsWithCanonicalMetrics: 1, sessionsWithCanonicalWorkoutDetail: 1 }
};
const trends = {
  ok: true,
  summaries: { recovery: 'Recovery stable.', performance: 'Performance stable.', exposure: 'Exposure controlled.', trajectory: 'Trajectory remains positive.', voice: 'Athlete felt controlled and good.' },
  recovery: { wellnessHistory: [] }, load: { formula: 'test', series: [], rolling7d: { value: 100 }, rolling28d: { value: 400 } },
  performance: { matchedAet: [], runningRelationship: [], excludedAet: [], latestMatchedAet: null },
  capabilities: [], quality: { loadMissingDates: [] }, provenance: { operationalTruth: 'Neon', historicalWellnessSeed: 'test', auditRepresentation: 'Drive' }
};
const system = {
  ok: true,
  runtime: { masterValidated: true, stateId: '2026-09-10T20:00:00+02:00', masterAsOf: '2026-09-10T20:00:00+02:00' },
  garmin: { connection: { status: 'CONNECTED' }, latestWellness: { source_as_of: '2026-09-13T18:00:00.000Z' } },
  tredict: { configured: true, latestEvidence: [] }, trainingEvidence: [], athleteMemory: { events: 1, latest_event: '2026-09-13T06:35:00.000Z' },
  intelligence: { current: { pendingPropagation: false, activeRecommendation: { sessionOptionComposerVersion: '4.4.0-composer.1' } } }
};
const intelligence = {
  ok: true, revision: 'browser-smoke-r1', pendingPropagation: false, pending: { materiality: false, shadowRecommendation: false, activeRecommendation: false },
  markers: { sessionOptionComposerVersion: '4.4.0-composer.1', currentRecoveryFreshnessPolicy: 'current-recovery-v1' },
  activeRecommendation: {
    status: 'READY', localDate: '2026-09-13', fzRecommendedLane: 'ABSORB', confidence: 'MODERATE', recommendationVersion: 'test-rec-r1', shadowRecommendationId: 'shadow-test-r1', sessionOptionComposerVersion: '4.4.0-composer.1',
    explanation: { athleteFacing: { headline: 'Protect the next useful training opportunity.', whyNow: 'Current wellness and recovery context favour useful movement at low cost.', objectiveConnection: 'Stay anchored to the primary objective.' }, recommendation: { whyThisLane: 'Current wellness and recovery context favour useful movement at low cost.', successConditions: ['Complete the intended dose without materially worsening the next valuable training opportunity.'] } },
    lanes: {
      ABSORB: [{ optionId: 'option:test:absorb', title: 'Low-impact aerobic recovery', objective: 'Preserve aerobic continuity.', dose: '25–40 min easy', whyNow: 'Useful movement at low cost.', modality: 'ELLIPTICAL', expectedCost: 'LOW', targetedGaps: [] }],
      MAINTAIN: [{ optionId: 'option:test:maintain', title: 'Controlled steady aerobic', objective: 'Preserve aerobic capability.', dose: '40–60 min controlled steady work', whyNow: 'Useful continuity at controlled cost.', modality: 'RUNNING', expectedCost: 'LOW_TO_MODERATE', targetedGaps: [] }],
      ADAPT: []
    }
  }, athleteDecision: null
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  count(url.pathname);
  if (url.pathname === '/api/runtime-state') return json(res, runtime);
  if (url.pathname === '/api/wellness/today') return json(res, wellness);
  if (url.pathname === '/api/training/memory' || url.pathname === '/api/training/today') return json(res, training);
  if (url.pathname === '/api/trends/current') return json(res, trends);
  if (url.pathname === '/api/system/status') return json(res, system);
  if (url.pathname === '/api/intelligence/current') return json(res, intelligence);
  if (url.pathname === '/api/intelligence/refresh') return json(res, { ...intelligence, afterRevision: intelligence.revision, activeRecommendation: intelligence.activeRecommendation });
  return staticFile(res, url.pathname);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
await page.addInitScript(() => {
  window.__fzPulse = 0;
  setInterval(() => { window.__fzPulse += 1; }, 50);
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log('PASS', message);
}
async function clickPage(name, expectedText) {
  const button = page.locator(`.bottom [data-page="${name}"]`);
  await button.click({ timeout: 1500 });
  await page.waitForFunction(target => document.getElementById(target)?.classList.contains('active'), name, { timeout: 1500 });
  assert((await page.locator(`#${name}`).innerText()).includes(expectedText), `${name.toUpperCase()} navigation renders expected content`);
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 5000 });
  await page.waitForSelector('#today .fz-clean-readiness', { timeout: 3000 });
  assert(await page.locator('#today .fz-clean-loading').count() === 0, 'TODAY leaves the loading shell');
  assert((await page.locator('#stateStamp').innerText()).includes('CANONICAL RUNTIME'), 'canonical sync completes and updates shell state');
  await page.waitForFunction(() => document.querySelector('#today .fz-clean-readiness .score strong')?.textContent?.trim() === '—', { timeout: 3000 });
  const todayText = await page.locator('#today').innerText();
  assert(!todayText.includes('MORNING RECOVERY SIGNAL REMAINED SOFTENED'), 'stale 10 Sep readiness narrative is suppressed from current TODAY');
  assert(!todayText.includes('Sleep5.21 h / score64'), 'stale 10 Sep readiness metrics are not presented as current');
  assert(todayText.includes('13 Sep 2026'), 'current recommendation date is visible when stale runtime readiness is suppressed');
  assert(todayText.includes('Freshness guard'), 'TODAY explains why the historical readiness score is not shown');
  await page.waitForTimeout(350);
  const pulse = await page.evaluate(() => window.__fzPulse);
  assert(pulse >= 3, 'browser event loop remains live after 4.4 recommendation projection');
  assert(pageErrors.length === 0, `no browser page errors occur (${pageErrors.join(' | ') || 'none'})`);

  await clickPage('trends', 'Longitudinal Signals');
  await clickPage('train', 'Training Memory');
  assert((await page.locator('#train').innerText()).includes('Current Training Choice'), '4.4 training choice renders without locking TRAIN');
  await page.locator('.fz-alternate-lanes summary').click();
  await page.waitForSelector('.fz-alternate-lanes[open]');
  assert((await page.locator('.fz-alternate-lanes').innerText()).includes('Controlled steady aerobic'), 'alternate lane exposes the actual MAINTAIN option, not only its count');
  assert((await page.locator('.fz-alternate-lanes').innerText()).includes('40–60 min controlled steady work'), 'alternate option exposes its prescribed dose');
  assert((await page.locator('.fz-alternate-lanes').innerText()).includes('No session option is currently released for this lane.'), 'empty alternate lane is explicit rather than pretending options exist');
  await clickPage('system', 'System Health');
  await clickPage('today', 'Live Physiology');

  await page.waitForTimeout(250);
  const finalPulse = await page.evaluate(() => window.__fzPulse);
  assert(finalPulse > pulse, 'browser event loop remains responsive after repeated navigation');
  assert((requestCounts.get('/api/intelligence/current') || 0) < 10, 'intelligence polling does not run away during initial render');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'mobile shell has no horizontal overflow');
  console.log('PASS mobile shell real-browser freshness, alternate options, liveness and navigation acceptance');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

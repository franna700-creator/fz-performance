import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { webkit } from 'playwright';

const root = process.cwd();
const dist = path.join(root, 'dist');
const baselineSha = process.env.FZ_BASELINE_SHA || '51da79dfc680d9bac9f9e82589f1e37446ef7a2d';
const baselineSystemJs = execFileSync('git', ['show', `${baselineSha}:src/system-intelligence.js`], { encoding: 'utf8' });
const fixedSystemJs = fs.readFileSync(path.join(dist, 'assets', 'system-intelligence.js'), 'utf8');

const now = new Date().toISOString();
const apiPayloads = {
  '/api/runtime-state': {
    ok: true,
    renderContract: { readiness: { score: 82, status: 'READY', systemicRecovery: 'Browser test recovery state.', localTissueState: 'Browser test local state.', primaryDecision: 'Browser test recommendation.', successCriteria: 'Render completes.' } }
  },
  '/api/wellness/today': {
    ok: true,
    syncStatus: 'CURRENT',
    wellness: { freshness: 'LIVE', sourceAsOf: now, ingestedAt: now, current: { steps: 1234, distanceKm: 1.23, bodyBattery: 60, bodyBatteryHigh: 80, bodyBatteryLow: 30, stress: 20, stressAvg: 22, heartRate: 65, restingHeartRate: 55, hrv: 70, sleepScore: 80, sleepHours: 7.5, activeCalories: 100, activeMinutes: 20, respiration: 14 }, series: {} }
  },
  '/api/training/memory': {
    ok: true,
    sessions: [], contextEvents: [], integrity: { unlinkedSessionFeedback: 0, lateLinkedAthleteEvents: 0 }
  },
  '/api/trends/current': {
    ok: true,
    summaries: {}, recovery: { wellnessHistory: [] },
    load: { series: [], rolling7d: { value: 0 }, rolling28d: { value: 0 }, formula: 'browser-test' },
    performance: { matchedAet: [], excludedAet: [], runningRelationship: [] },
    quality: { loadMissingDates: [], historicallyEnrichedSessions: 0, evidencePolicy: 'MONOTONIC_BEST_AVAILABLE' },
    capabilities: [], provenance: {}, freshness: { latestTrainingEvidenceAt: now }, trainingIntent: { counts: {} }
  },
  '/api/system/status': {
    ok: true,
    runtime: { masterValidated: true, stateId: 'browser-test', masterAsOf: now },
    garmin: { connection: { status: 'CONNECTED' }, latestWellness: {} },
    tredict: { configured: true, latestEvidence: [] }, trainingEvidence: [], athleteMemory: { events: 0 },
    intelligence: { materiality: { engineVersion: '4.1.0', count: 0, assessments: [] } }
  }
};

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.webmanifest')) return 'application/manifest+json';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const rawPath = new URL(req.url, 'http://127.0.0.1').pathname;
  let file = rawPath === '/' ? path.join(dist, 'index.html') : path.join(dist, rawPath.replace(/^\//, ''));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function runScenario(label, systemJs, expectRendered) {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.route('**/assets/system-intelligence.js', route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: systemJs }));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const payload = apiPayloads[pathname];
    if (!payload) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    // Force SYSTEM/TRAIN/TRENDS to settle before runtime/wellness. This reliably exercises
    // the observer/microtask race that can starve the main loadAll() continuation.
    if (pathname === '/api/runtime-state' || pathname === '/api/wellness/today') await new Promise(r => setTimeout(r, 150));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });

  let rendered = false;
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
    rendered = await Promise.race([
      page.waitForFunction(() => {
        const today = document.getElementById('today');
        const stamp = document.getElementById('stateStamp');
        return Boolean(today?.textContent?.includes('FZ Readiness') && stamp?.textContent?.includes('CANONICAL RUNTIME'));
      }, { timeout: 2500 }).then(() => true).catch(() => false),
      new Promise(resolve => setTimeout(() => resolve(false), 3000))
    ]);
  } catch {
    rendered = false;
  }

  if (expectRendered && rendered) {
    await page.waitForTimeout(500);
    const stable = await page.evaluate(() => ({
      loadingGone: !document.getElementById('today')?.textContent?.includes('Loading current athlete state'),
      canonicalStamp: document.getElementById('stateStamp')?.textContent || '',
      adaptiveSections: document.querySelectorAll('[data-materiality-observability]').length,
      integritySections: document.querySelectorAll('[data-dynamic-integrity]').length
    }));
    if (!stable.loadingGone || !stable.canonicalStamp.includes('CANONICAL RUNTIME') || stable.adaptiveSections > 1 || stable.integritySections > 1) rendered = false;
  }

  await browser.close().catch(() => {});
  const pass = rendered === expectRendered && pageErrors.length === 0;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: rendered=${rendered} expected=${expectRendered} pageErrors=${pageErrors.length}`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  return pass;
}

let ok = true;
ok = (await runScenario('baseline production observer reproduces canonical-render stall', baselineSystemJs, false)) && ok;
ok = (await runScenario('fixed observer completes canonical render under identical timing', fixedSystemJs, true)) && ok;

server.close();
if (!ok) process.exit(1);
console.log('PASS WebKit before/after canonical refresh regression');

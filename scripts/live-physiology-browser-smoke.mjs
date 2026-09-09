import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist = path.resolve('dist');
let backgroundRefreshes = 0;
let forcedRefreshes = 0;

const baseSeries = {
  body_battery: [['2026-09-09T17:00:00.000Z',35],['2026-09-09T17:15:00.000Z',33],['2026-09-09T17:30:00.000Z',31]],
  stress: [['2026-09-09T17:00:00.000Z',20],['2026-09-09T17:15:00.000Z',-1],['2026-09-09T17:30:00.000Z',28]],
  heart_rate: [['2026-09-09T17:00:15.000Z',129],['2026-09-09T17:15:15.000Z',120],['2026-09-09T17:30:15.000Z',142]],
  respiration: [['2026-09-09T17:00:00.000Z',13.8],['2026-09-09T17:15:00.000Z',0],['2026-09-09T17:30:00.000Z',0]]
};

function wellnessPayload({ freshness, sourceAsOf, ingestedAt, syncStatus, steps, bodyBattery }) {
  return {
    ok: true,
    date: '2026-09-09',
    syncStatus,
    warning: null,
    source: { status: 'CONNECTED' },
    wellness: {
      date: '2026-09-09', sourceAsOf, ingestedAt, freshness, ageMinutes: freshness === 'LIVE' ? 5 : 180,
      current: {
        steps, distanceKm: 9.19, activeCalories: 751, activeMinutes: 104.4,
        heartRate: 142, restingHeartRate: 54, stress: 28, stressAvg: 24,
        bodyBattery, bodyBatteryHigh: 93, bodyBatteryLow: bodyBattery,
        hrv: 70, sleepScore: 81, sleepHours: 7.15, respiration: 0
      },
      series: baseSeries
    }
  };
}

const persisted = wellnessPayload({
  freshness: 'STALE', sourceAsOf: '2026-09-09T15:15:15.000Z', ingestedAt: '2026-09-09T15:19:40.000Z',
  syncStatus: 'DB_ONLY', steps: 3580, bodyBattery: 47
});
const refreshed = wellnessPayload({
  freshness: 'LIVE', sourceAsOf: '2026-09-09T18:30:15.000Z', ingestedAt: '2026-09-09T18:47:54.000Z',
  syncStatus: 'SYNCED', steps: 11278, bodyBattery: 31
});
const forced = wellnessPayload({
  freshness: 'LIVE', sourceAsOf: '2026-09-09T18:45:15.000Z', ingestedAt: '2026-09-09T18:49:54.000Z',
  syncStatus: 'SYNCED', steps: 11325, bodyBattery: 30
});

function json(res, value) {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function staticFile(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const file = path.join(dist, rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(file);
  const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html';
  res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/wellness/today') {
    if (url.searchParams.get('refresh') === '0') return json(res, persisted);
    if (url.searchParams.get('refresh') === '1') { forcedRefreshes += 1; return json(res, forced); }
    backgroundRefreshes += 1;
    await new Promise(resolve => setTimeout(resolve, 650));
    return json(res, refreshed);
  }
  if (url.pathname === '/api/runtime-state') return json(res, { ok:true, renderContract:{ readiness:{ score:82,status:'READY',systemicRecovery:'Systemic recovery is good.',localTissueState:'No material local limiter.',primaryDecision:'Proceed with the current recommendation.',successCriteria:'Reassess when new evidence arrives.' } } });
  if (url.pathname === '/api/training/memory') return json(res, { ok:true, sessions:[], contextEvents:[] });
  if (url.pathname === '/api/trends/current') return json(res, { ok:true, summaries:{}, recovery:{wellnessHistory:[]}, load:{series:[],rolling7d:{value:null},rolling28d:{value:null},formula:'test'}, performance:{matchedAet:[],runningRelationship:[],excludedAet:[]}, quality:{loadMissingDates:[]}, capabilities:[], provenance:{operationalTruth:'Neon',auditRepresentation:'Drive'} });
  if (url.pathname === '/api/system/status') return json(res, { ok:true, runtime:{masterValidated:true}, garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:'2026-09-09T18:30:15.000Z'}}, tredict:{configured:true,latestEvidence:[]}, trainingEvidence:[], athleteMemory:{events:0} });
  return staticFile(res, url.pathname);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log('PASS', message);
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.fz-live-physiology-v3[data-freshness="STALE"]', { timeout: 500 });
  assert(await page.locator('.fz-live-grid').evaluate(el => el.hidden), 'persisted static grid is hidden after immediate DB render');
  assert(await page.locator('.fz-live-chart-v3').count() === 4, 'four Live Physiology scrub graphs render immediately');
  assert((await page.locator('[data-live-key="respiration"] [data-live-value]').textContent()).startsWith('13.8'), 'respiration zero placeholders are excluded');
  assert(backgroundRefreshes === 1, 'DB-only render triggers one background Garmin refresh');

  await page.waitForSelector('.fz-live-physiology-v3[data-freshness="LIVE"]', { timeout: 2500 });
  assert((await page.locator('.fz-live-toolbar').textContent()).includes('auto-refresh 5 min'), 'freshness toolbar states automatic refresh cadence');
  assert((await page.locator('.fz-live-toolbar').textContent()).includes('SYNCED'), 'background source refresh visibly reports sync state');
  assert((await page.locator('.fz-live-anchor-row').textContent()).includes('11 278') || (await page.locator('.fz-live-anchor-row').textContent()).includes('11,278') || (await page.locator('.fz-live-anchor-row').textContent()).includes('11278'), 'background refresh advances persisted physiology');

  const chart = page.locator('[data-live-key="heart_rate"] svg');
  const box = await chart.boundingBox();
  await chart.dispatchEvent('pointerdown', { pointerType:'mouse', clientX: box.x + box.width * 0.25, clientY: box.y + 30, buttons:1, pressure:0.5 });
  assert((await page.locator('[data-live-key="heart_rate"] [data-live-value]').textContent()).includes('·'), 'pointer scrubbing exposes timestamped value');

  await page.locator('[data-live-refresh]').click();
  await page.waitForFunction(() => document.querySelector('.fz-live-toolbar')?.textContent?.includes('18:45'));
  assert(forcedRefreshes === 1, 'Refresh Garmin performs explicit forced source refresh');

  assert((await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), 'mobile Live Physiology introduces no horizontal overflow');
  console.log('PASS Live Physiology browser acceptance');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

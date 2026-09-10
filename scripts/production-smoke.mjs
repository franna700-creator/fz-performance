import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = (process.env.FZ_PROD_URL || 'https://fz-performance-mvp.vercel.app').replace(/\/$/, '');
const ARTIFACT_DIR = process.env.FZ_ARTIFACT_DIR || 'artifacts';
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

function expectedSastDate() {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg', weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date());
}

async function getJson(context, path) {
  const response = await context.request.get(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  assert.equal(response.status(), 200, `${path} must return HTTP 200`);
  return { response, data: await response.json() };
}

function finiteOrNull(value, label) {
  assert.ok(value === null || Number.isFinite(Number(value)), `${label} must be numeric or null`);
}

async function assertContracts(context) {
  const runtime = await getJson(context, '/api/runtime-state');
  assert.equal(runtime.data.masterValidated, true, 'runtime state must be master validated');
  assert.ok(runtime.data.stateId, 'runtime stateId must be present');
  assert.ok(runtime.response.headers()['x-fz-state-sha256'], 'runtime checksum header must be present');
  assert.equal(runtime.response.headers()['x-fz-state-source'], 'database', 'production runtime must be database-backed');

  const wellness = (await getJson(context, '/api/wellness/today?refresh=0')).data;
  assert.equal(wellness.ok, true, 'persisted wellness contract must be healthy');
  assert.ok(wellness.wellness, 'persisted wellness must be present');
  assert.ok(wellness.wellness.ingestedAt, 'wellness persistence timestamp must be present');

  const training = (await getJson(context, '/api/training/memory?backDays=45&forwardDays=0')).data;
  assert.equal(training.ok, true, 'canonical training memory must be healthy');
  assert.ok(Array.isArray(training.sessions), 'training sessions must be an array');

  const trends = (await getJson(context, '/api/trends/current?days=45')).data;
  assert.equal(trends.ok, true, 'canonical Trends contract must be healthy');
  assert.match(trends.provenance?.operationalTruth || '', /Neon/i, 'Trends operational truth must be Neon');
  assert.equal(trends.provenance?.auditRepresentation, 'Google Drive is not queried by this runtime contract', 'Drive must not be a runtime dependency');

  const loadSeries = Array.isArray(trends.load?.series) ? trends.load.series : [];
  assert.ok(loadSeries.length > 0, 'load series must be present');
  const byDate = new Map(loadSeries.map(point => [point.date, point]));
  for (const point of loadSeries) {
    finiteOrNull(point.value, `load ${point.date}`);
    if (point.value !== null) assert.ok(Number(point.value) >= 0, `load ${point.date} cannot be negative`);
  }
  for (const missingDate of trends.quality?.loadMissingDates || []) {
    assert.equal(byDate.get(missingDate)?.value ?? null, null, `${missingDate} missing detail must remain null/pending, not zero`);
  }
  const trainingDates = new Set((training.sessions || []).map(s => s.local_date).filter(Boolean));
  for (const date of trainingDates) {
    const point = byDate.get(date);
    if (point) assert.notEqual(Number(point.value), 0, `${date} has canonical training and must not become a false zero-load day`);
  }
  finiteOrNull(trends.load?.rolling7d?.value ?? null, 'rolling 7d load');
  finiteOrNull(trends.load?.rolling28d?.value ?? null, 'rolling 28d load');

  // Historical regression anchors remain stable, while the live series may extend.
  const sep8 = byDate.get('2026-09-08');
  assert.ok(sep8, '8 Sep historical load point must remain present');
  assert.ok(Math.abs(Number(sep8.value) - 66.32) < 0.01, '8 Sep NCL historical derivation must remain ~66.32');

  const matchedAet = trends.performance?.matchedAet || [];
  const requiredHistorical = ['2026-07-27','2026-08-04','2026-08-17','2026-08-25','2026-08-31'];
  const matchedDates = matchedAet.map(x => x.date);
  for (const date of requiredHistorical) assert.ok(matchedDates.includes(date), `matched AET baseline must retain ${date}`);
  assert.equal(new Set(matchedDates).size, matchedDates.length, 'matched AET dates must be unique');
  assert.equal(trends.performance?.matchedAet?.find(x => x.date === '2026-08-04')?.comparison, 'MATCHED_CAVEAT', '4 Aug AET caveat must remain');
  assert.equal(trends.performance?.excludedAet?.find(x => x.date === '2026-09-08')?.comparison, 'NON_COMPARABLE', '8 Sep GI-limited AET must remain non-comparable');

  const system = (await getJson(context, '/api/system/status?materialityLimit=20')).data;
  assert.equal(system.ok, true, 'system status must be healthy');
  assert.equal(system.architecture?.operationalTruth, 'Neon', 'SYSTEM operational truth must be Neon');
  assert.match(system.architecture?.driveRole || '', /flight recorder; not runtime engine/i, 'Drive role must remain audit-only');
  assert.equal(system.garmin?.connection?.status, 'CONNECTED', 'Garmin / Fitness AI connection must be connected');
  assert.equal(system.tredict?.configured, true, 'Tredict must be configured');
  assert.equal(system.intelligence?.materiality?.engineVersion, '4.1.0', 'Tranche 4.1 engine version must remain visible');
  assert.ok(Array.isArray(system.intelligence?.materiality?.assessments), 'materiality assessments must be observable');

  return { runtime: runtime.data, wellness, training, trends, system };
}

async function boot(page, label) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.ok(response && response.ok(), `${label}: root document must load`);
  await page.waitForSelector('#today .fz-clean-hero', { timeout: 30000 });
  await page.waitForSelector('#today [data-dynamic-source="physiology"]', { timeout: 15000 });
  await page.waitForSelector('#today [data-dynamic-source="training"]', { timeout: 15000 });

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  assert.match(viewport || '', /viewport-fit=cover/, `${label}: mobile safe-area viewport must remain enabled`);
  assert.equal((await page.locator('#todayDate').innerText()).trim(), expectedSastDate(), `${label}: SAST date must be correct`);
  assert.match((await page.locator('#countdown').innerText()).trim(), /^\d{2}:\d{2}:\d{2}$/, `${label}: countdown must render`);
  assert.match(await page.locator('#nextSlot').innerText(), /(06|20):00 SAST/, `${label}: next scheduled intelligence slot must remain 06:00 or 20:00`);
  assert.equal(await page.locator('body').innerText().then(t => t.includes('Why this matters now')), false, `${label}: removed TODAY duplication must not return`);
  assert.ok(await page.locator('[data-live-refresh]').isVisible(), `${label}: manual Garmin refresh must be visible`);
  assert.ok(await page.locator('[data-training-sync-now]').isVisible(), `${label}: manual workout sync must be visible`);

  return { pageErrors, consoleErrors };
}

async function openPage(page, label, id) {
  const selector = label === 'mobile' ? `.bottom button[data-page="${id}"]` : `.nav button[data-page="${id}"]`;
  await page.locator(selector).click();
  await page.waitForFunction(pageId => document.getElementById(pageId)?.classList.contains('active'), id, { timeout: 5000 });
}

async function assertSurfaces(page, label) {
  await openPage(page, label, 'trends');
  for (const selector of ['#cleanHrvChart svg','#cleanSleepChart svg','#cleanNclChart svg','#cleanAetChart svg','#cleanRunScatter svg','#trendAthleteVoice']) {
    await page.waitForSelector(selector, { timeout: 10000 });
  }
  const trendsText = await page.locator('#trends').innerText();
  assert.match(trendsText, /Normalised Cardio Load/i, `${label}: NCL surface must render`);
  assert.match(trendsText, /Matched Run AET/i, `${label}: matched AET surface must render`);
  assert.match(trendsText, /NON.COMPARABLE|NON-COMPARABLE/i, `${label}: excluded AET evidence must remain visible`);

  await openPage(page, label, 'train');
  await page.waitForSelector('#athleteMemory .fz-athlete-memory-shell', { timeout: 10000 });
  await page.waitForSelector('#train .fz-training-list', { timeout: 10000 });
  assert.match(await page.locator('#train').innerText(), /Canonical subjective evidence/i, `${label}: Athlete Memory must remain canonical`);

  await openPage(page, label, 'system');
  await page.waitForSelector('#system .status-grid', { timeout: 10000 });
  await page.waitForSelector('#system [data-materiality-observability]', { timeout: 10000 });
  const systemText = await page.locator('#system').innerText();
  assert.match(systemText, /Operational truth[\s\S]*NEON/i, `${label}: SYSTEM must show Neon operational truth`);
  assert.match(systemText, /Adaptive Intelligence/i, `${label}: SYSTEM must expose Tranche 4.1 materiality`);
  assert.match(systemText, /4\.2/i, `${label}: SYSTEM must preserve the recomputation boundary`);

  if (label === 'mobile') {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 2, `mobile: page must not horizontally overflow (${overflow}px)`);
    assert.ok(await page.locator('.bottom').isVisible(), 'mobile: bottom navigation must remain visible');
  }
}

async function runViewport(browser, label, contextOptions, screenshotName) {
  const context = await browser.newContext(contextOptions);
  await assertContracts(context);
  const page = await context.newPage();
  try {
    const errors = await boot(page, label);
    await assertSurfaces(page, label);
    await openPage(page, label, 'today');
    await page.screenshot({ path: `${ARTIFACT_DIR}/${screenshotName}`, fullPage: true });
    assert.deepEqual(errors.pageErrors, [], `${label}: no page errors allowed`);
    assert.deepEqual(errors.consoleErrors, [], `${label}: no console errors allowed`);
  } catch (error) {
    await page.screenshot({ path: `${ARTIFACT_DIR}/${label}-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, 'desktop', { viewport: { width: 1440, height: 1000 } }, 'desktop-v070.png');
  await runViewport(browser, 'mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'mobile-v070.png');
  console.log('PASS v0.7 production smoke: dynamic sources + canonical runtime + moving-data invariants + Tranche 4.1 observability');
} finally {
  await browser.close();
}

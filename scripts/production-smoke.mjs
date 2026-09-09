import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = (process.env.FZ_PROD_URL || 'https://fz-performance-mvp.vercel.app').replace(/\/$/, '');
const ARTIFACT_DIR = process.env.FZ_ARTIFACT_DIR || 'artifacts';
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

function expectedSastDate() {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
}

async function getJson(context, path) {
  const response = await context.request.get(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  assert.equal(response.status(), 200, `${path} must return HTTP 200`);
  return { response, data: await response.json() };
}

async function assertContracts(context) {
  const runtime = await getJson(context, '/api/runtime-state');
  assert.equal(runtime.data.masterValidated, true, 'runtime state must be master validated');
  assert.ok(runtime.data.stateId, 'runtime stateId must be present');
  assert.ok(runtime.response.headers()['x-fz-state-sha256'], 'runtime checksum header must be present');
  assert.equal(runtime.response.headers()['x-fz-state-source'], 'database', 'production runtime must be database-backed');

  const trends = (await getJson(context, '/api/trends/current?days=45')).data;
  assert.equal(trends.ok, true, 'canonical Trends contract must be healthy');
  assert.match(trends.provenance?.operationalTruth || '', /Neon/i, 'Trends operational truth must be Neon');
  assert.match(trends.provenance?.historicalLoadSeed || '', /Cardio Load master/i, 'historical load seed provenance must be explicit');
  assert.equal(trends.provenance?.auditRepresentation, 'Google Drive is not queried by this runtime contract', 'Drive must not be a runtime dependency');

  const jul27 = trends.load?.series?.find(x => x.date === '2026-07-27');
  assert.ok(jul27, '27 Jul historical load point must exist');
  assert.ok(Math.abs(Number(jul27.value) - 129.2166666667) < 0.001, '27 Jul must retain the validated whole-day NCL rollup');
  assert.equal(jul27.state, 'HISTORICAL_RECONCILED', '27 Jul load must be historical reconciled truth');

  const sep8 = trends.load?.series?.find(x => x.date === '2026-09-08');
  assert.ok(sep8, '8 Sep load point must exist');
  assert.ok(Math.abs(Number(sep8.value) - 66.32) < 0.001, '8 Sep NCL must remain 66.32');
  assert.equal(sep8.state, 'CANONICAL_DERIVED', '8 Sep load must remain directly derived from canonical detail');
  assert.deepEqual(trends.quality?.loadMissingDates || [], [], 'current 28-day load window must contain no false missing dates');
  assert.ok(Math.abs(Number(trends.load?.rolling7d?.value) - 270.72) < 0.001, '7d rolling NCL must remain 270.72');
  assert.ok(Math.abs(Number(trends.load?.rolling28d?.value) - 2036.59) < 0.001, '28d rolling NCL must remain 2036.59');

  const expectedAet = ['2026-07-27','2026-08-04','2026-08-17','2026-08-25','2026-08-31'];
  assert.deepEqual((trends.performance?.matchedAet || []).map(x => x.date), expectedAet, 'matched AET family must be exact and stable');
  assert.equal(trends.performance.matchedAet.find(x => x.date === '2026-08-04')?.comparison, 'MATCHED_CAVEAT', '4 Aug AET must retain matched caveat');
  assert.equal(trends.performance?.excludedAet?.find(x => x.date === '2026-09-08')?.comparison, 'NON_COMPARABLE', '8 Sep GI-limited AET must remain non-comparable');

  const system = (await getJson(context, '/api/system/status')).data;
  assert.equal(system.ok, true, 'system status must be healthy');
  assert.equal(system.architecture?.operationalTruth, 'Neon', 'SYSTEM operational truth must be Neon');
  assert.match(system.architecture?.driveRole || '', /flight recorder; not runtime engine/i, 'Drive role must remain audit-only');
  assert.equal(system.garmin?.connection?.status, 'CONNECTED', 'Garmin / Fitness AI connection must be connected');
  assert.equal(system.tredict?.configured, true, 'Tredict must be configured');

  return { runtime: runtime.data, trends, system };
}

async function boot(page, label) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.ok(response && response.ok(), `${label}: root document must load`);
  await page.waitForSelector('#today .fz-clean-hero', { timeout: 30000 });
  await page.waitForSelector('#today .fz-live-grid .fz-live-metric', { timeout: 15000 });

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  assert.match(viewport || '', /viewport-fit=cover/, `${label}: mobile safe-area viewport must remain enabled`);
  assert.equal((await page.locator('#todayDate').innerText()).trim(), expectedSastDate(), `${label}: SAST date must be correct`);
  assert.match((await page.locator('#countdown').innerText()).trim(), /^\d{2}:\d{2}:\d{2}$/, `${label}: countdown must render`);
  assert.match(await page.locator('#nextSlot').innerText(), /(06|20):00 SAST/, `${label}: next refresh must be one of the locked slots`);
  assert.equal(await page.locator('body').innerText().then(t => t.includes('Why this matters now')), false, `${label}: removed TODAY duplication must not return`);

  return { pageErrors, consoleErrors };
}

async function openPage(page, label, id) {
  const selector = label === 'mobile' ? `.bottom button[data-page="${id}"]` : `.nav button[data-page="${id}"]`;
  await page.locator(selector).click();
  await page.waitForFunction(pageId => document.getElementById(pageId)?.classList.contains('active'), id, { timeout: 5000 });
}

async function assertConsolidatedSurfaces(page, label) {
  await openPage(page, label, 'today');
  await page.waitForSelector('#today .fz-clean-recommendation');
  await page.waitForSelector('#today .fz-training-focus');

  await openPage(page, label, 'trends');
  for (const selector of ['#cleanHrvChart svg','#cleanSleepChart svg','#cleanNclChart svg','#cleanAetChart svg','#cleanRunScatter svg','#trendAthleteVoice']) {
    await page.waitForSelector(selector, { timeout: 10000 });
  }
  const trendsText = await page.locator('#trends').innerText();
  assert.match(trendsText, /Normalised Cardio Load/i, `${label}: NCL surface must render`);
  assert.match(trendsText, /Matched Run AET/i, `${label}: matched AET surface must render`);
  assert.match(trendsText, /NON.COMPARABLE|NON-COMPARABLE/i, `${label}: excluded AET evidence must remain visible`);

  const ncl = page.locator('#cleanNclChart');
  await ncl.scrollIntoViewIfNeeded();
  const box = await ncl.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 80, `${label}: NCL chart must have a real rendered box`);
  if (label === 'mobile') await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height * 0.45);
  else await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.45);
  await page.waitForFunction(() => {
    const tip = document.querySelector('#cleanNclChart .fz-chart-tooltip');
    return tip && getComputedStyle(tip).display !== 'none' && tip.textContent.trim().length > 8;
  }, null, { timeout: 3000 });

  await openPage(page, label, 'train');
  await page.waitForSelector('#athleteMemory .fz-athlete-memory-shell', { timeout: 10000 });
  await page.waitForSelector('#train .fz-training-list', { timeout: 10000 });
  assert.match(await page.locator('#train').innerText(), /Canonical subjective evidence/i, `${label}: Athlete Memory must be canonical and explicit`);

  await openPage(page, label, 'system');
  await page.waitForSelector('#system .status-grid', { timeout: 10000 });
  await page.waitForSelector('#system .pipeline-flow', { timeout: 10000 });
  const systemText = await page.locator('#system').innerText();
  assert.match(systemText, /Operational truth[\s\S]*NEON/i, `${label}: SYSTEM must show Neon operational truth`);
  assert.match(systemText, /flight recorder[\s\S]*not the runtime engine/i, `${label}: SYSTEM must show Drive as audit-only`);

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
    await assertConsolidatedSurfaces(page, label);
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
  await runViewport(browser, 'desktop', { viewport: { width: 1440, height: 1000 } }, 'desktop-final.png');
  await runViewport(browser, 'mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'mobile-final.png');
  console.log('PASS consolidated production browser smoke: desktop + mobile + canonical runtime contracts + NCL authority + matched AET + Athlete Memory + SYSTEM provenance + chart scrubbing');
} finally {
  await browser.close();
}

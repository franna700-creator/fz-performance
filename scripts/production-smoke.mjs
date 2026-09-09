import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = (process.env.FZ_PROD_URL || 'https://fz-performance-mvp.vercel.app').replace(/\/$/, '');
const ARTIFACT_DIR = process.env.FZ_ARTIFACT_DIR || 'artifacts';
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

function expectedSastDate() {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg'
  }).format(new Date());
}

function expectedWellnessDate(state) {
  const [y,m,d] = String(state.stateId).slice(0,10).split('-').map(Number);
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d).padStart(2,'0')} ${months[m-1]}`;
}

function previousCompletedWellness(state) {
  const rows = state.datasets?.WELLNESS_HISTORY;
  assert.ok(Array.isArray(rows) && rows.length > 1, 'runtime WELLNESS_HISTORY must contain history plus current day');
  const currentIndex = rows.findIndex(row => row?.status === 'LIVE / PARTIAL');
  assert.ok(currentIndex > 0, 'runtime WELLNESS_HISTORY must contain a completed day before the current live row');
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if (rows[i]?.status === 'HISTORICAL') return rows[i];
  }
  assert.fail('runtime WELLNESS_HISTORY must contain a completed historical day before current');
}

async function assertGateway(context) {
  const response = await context.request.get(`${BASE}/api/runtime-state`, { headers: { accept: 'application/json' } });
  assert.equal(response.status(), 200, 'runtime gateway must return HTTP 200');
  const state = await response.json();
  assert.equal(state.masterValidated, true, 'runtime state must be master validated');
  assert.ok(state.stateId, 'runtime stateId must be present');
  assert.ok(response.headers()['x-fz-state-sha256'], 'runtime checksum header must be present');
  assert.ok(response.headers()['x-fz-state-source'], 'runtime generation source header must be present');
  return state;
}

async function bootAndNavigate(page, label) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.ok(response && response.ok(), `${label}: root document must load`);
  await page.waitForFunction(() => document.documentElement.dataset.fzReady === 'true', null, { timeout: 20000 });

  assert.equal((await page.locator('#todayDate').innerText()).trim(), expectedSastDate(), `${label}: SAST date must be correct`);
  assert.match((await page.locator('#countdown').innerText()).trim(), /^\d{2}:\d{2}:\d{2}$/, `${label}: countdown must render`);
  assert.match(await page.locator('#nextSlot').innerText(), /(06|20):00 SAST/, `${label}: next refresh must be one of the locked slots`);

  for (const id of ['today', 'trends', 'train', 'system']) {
    const selector = label === 'mobile' ? `.bottom button[data-page="${id}"]` : `.nav button[data-page="${id}"]`;
    await page.locator(selector).click();
    await page.waitForFunction(pageId => document.getElementById(pageId)?.classList.contains('active'), id);
  }

  assert.deepEqual(pageErrors, [], `${label}: no page errors allowed`);
  assert.deepEqual(consoleErrors, [], `${label}: no console errors allowed`);
}

async function selectPreviousDayOnWellness(page, label, metric) {
  await page.locator(`[data-well-metric="${metric}"]`).click();
  const wellness = page.locator('#fzWellnessChart');
  await wellness.scrollIntoViewIfNeeded();
  const box = await wellness.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100, `${label}: wellness chart must have a real box`);
  // Interact just left of the latest point to select the immediately previous observation.
  const x = box.x + box.width * 0.955;
  const y = box.y + box.height * 0.46;
  if (label === 'mobile') await page.touchscreen.tap(x, y);
  else await page.mouse.move(x, y);
  await page.waitForTimeout(120);
}

async function assertLongitudinalTrends(page, label, state) {
  await page.waitForSelector('#longitudinalLayer', { timeout: 10000 });
  const firstSectionId = await page.locator('#trends > .section').first().getAttribute('id');
  assert.equal(firstSectionId, 'longitudinalLayer', `${label}: longitudinal Trends must be the primary/top Trends surface`);

  await page.waitForSelector('#fzWellnessChart svg', { timeout: 10000 });
  const currentDate = expectedWellnessDate(state);
  const previous = previousCompletedWellness(state);
  await page.waitForFunction(date => document.querySelector('#wellSelectedDate')?.textContent?.trim() === date, currentDate, { timeout: 5000 });
  assert.equal((await page.locator('#wellSelectedDate').innerText()).trim(), currentDate, `${label}: wellness explorer must open on current master-validated state date`);
  assert.equal((await page.locator('#wellSelectedValue').innerText()).trim(), `${state.liveToday.hrv} ms`, `${label}: current HRV must come from live runtime state`);
  assert.match((await page.locator('.runtime-trend-update').first().innerText()).trim(), /CURRENT MASTER-VALIDATED UPDATE/i, `${label}: deep lenses must retain current runtime interpretation`);

  // Regression guard: the immediately previous completed day must remain fully closed and selectable.
  await selectPreviousDayOnWellness(page, label, 'steps');
  assert.equal((await page.locator('#wellSelectedDate').innerText()).trim(), previous.dateLabel, `${label}: previous completed wellness row must exist`);
  assert.equal((await page.locator('#wellSelectedValue').innerText()).trim(), Number(previous.completedDaySteps).toLocaleString('en-US'), `${label}: previous completed steps must be retained`);
  assert.equal((await page.locator('#wellSelectedStatus').innerText()).trim(), 'HISTORICAL', `${label}: previous completed day must be historical`);

  await selectPreviousDayOnWellness(page, label, 'stress');
  assert.equal((await page.locator('#wellSelectedDate').innerText()).trim(), previous.dateLabel, `${label}: previous completed stress row must be selectable`);
  assert.equal((await page.locator('#wellSelectedValue').innerText()).trim(), String(previous.completedDayStress), `${label}: previous completed-day stress must be retained`);

  await selectPreviousDayOnWellness(page, label, 'active');
  assert.equal((await page.locator('#wellSelectedDate').innerText()).trim(), previous.dateLabel, `${label}: previous completed active-energy row must be selectable`);
  assert.equal((await page.locator('#wellSelectedValue').innerText()).trim(), `${Number(previous.completedDayActiveCalories).toLocaleString('en-US')} kcal`, `${label}: previous completed active calories must be retained`);

  await page.locator('[data-well-metric="hrv"]').click();
  const wellness = page.locator('#fzWellnessChart');
  await wellness.scrollIntoViewIfNeeded();
  const box = await wellness.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100, `${label}: wellness explorer must render with a real box`);

  if (label === 'mobile') {
    await page.touchscreen.tap(box.x + box.width * 0.28, box.y + Math.min(box.height * 0.48, 125));
  } else {
    await page.mouse.move(box.x + box.width * 0.28, box.y + box.height * 0.45);
  }
  await page.waitForTimeout(100);
  const selected = (await page.locator('#wellSelectedDate').innerText()).trim();
  assert.ok(selected && selected !== currentDate, `${label}: scrubbed wellness explorer must select historical days, not remain stuck on current state`);

  await page.locator('[data-well-metric="sleepScore"]').click();
  assert.match((await page.locator('#wellMetricTitle').innerText()).trim(), /Sleep score/i, `${label}: wellness metric tabs must change the chart`);
  assert.equal((await page.locator('#wellSelectedDate').innerText()).trim(), currentDate, `${label}: changing wellness metric must return to the latest valid current point when available`);
  assert.equal((await page.locator('#wellSelectedValue').innerText()).trim(), String(state.liveToday.sleepScore), `${label}: current sleep score must come from live runtime state`);

  const lensChecks = [
    ['response', '#fzResponseSvg'],
    ['performance', '#fzAetDeepChart svg'],
    ['cost', '#fzAcChart svg'],
    ['voice', '#voiceDeepList'],
    ['trajectory', '.deep-trajectory']
  ];
  for (const [lens, selector] of lensChecks) {
    await page.locator(`[data-long-lens="${lens}"]`).click();
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.waitForSelector(`.long-pane[data-lens="${lens}"] .runtime-trend-update`, { timeout: 5000 });
  }
  await page.locator('[data-long-lens="state"]').click();
  await page.waitForSelector('#fzWellnessChart svg', { timeout: 5000 });
}

async function desktopSmoke(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const state = await assertGateway(context);
  const page = await context.newPage();
  try {
    await bootAndNavigate(page, 'desktop');
    await page.locator('.nav button[data-page="trends"]').click();
    await assertLongitudinalTrends(page, 'desktop', state);

    await page.waitForSelector('#recoveryChart svg', { timeout: 10000 });
    await page.waitForSelector('#loadChart svg', { timeout: 10000 });
    await page.waitForSelector('#aetChart svg', { timeout: 10000 });
    await page.waitForSelector('#runScatter svg', { timeout: 10000 });

    const chart = page.locator('#recoveryChart');
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    assert.ok(box && box.width > 100 && box.height > 100, 'desktop: recovery chart must have a real rendered box');
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
    await page.waitForSelector('#recoveryChart .chart-scrub-tooltip.show', { timeout: 3000 });
    const pointerTip = (await page.locator('#recoveryChart .chart-scrub-tooltip.show').innerText()).trim();
    assert.ok(pointerTip.length > 8, 'desktop: pointer scrub tooltip must contain observation data');

    await chart.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('#recoveryChart .chart-scrub-tooltip.show', { timeout: 3000 });

    await page.locator('.nav button[data-page="system"]').click();
    await page.waitForSelector('#runtimeHealthPanel');
    assert.match(await page.locator('#runtimeHealthPanel').innerText(), /Platform[\s\S]*Application[\s\S]*Data/i, 'desktop: health layers must render');
    assert.ok(state.pages.today && state.pages.trends && state.pages.train && state.pages.system, 'desktop: all four runtime page contracts must exist');
  } catch (error) {
    await page.screenshot({ path: `${ARTIFACT_DIR}/desktop-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function mobileSmoke(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const state = await assertGateway(context);
  const page = await context.newPage();
  try {
    await bootAndNavigate(page, 'mobile');
    await page.locator('.bottom button[data-page="trends"]').click();
    await assertLongitudinalTrends(page, 'mobile', state);

    await page.waitForSelector('#recoveryChart svg', { timeout: 10000 });
    const chart = page.locator('#recoveryChart');
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    assert.ok(box && box.width > 100, 'mobile: chart must render');
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + Math.min(box.height * 0.45, 120));
    await page.waitForSelector('#recoveryChart .chart-scrub-tooltip.show', { timeout: 3000 });
    const touchTip = (await page.locator('#recoveryChart .chart-scrub-tooltip.show').innerText()).trim();
    assert.ok(touchTip.length > 8, 'mobile: touch scrub tooltip must contain observation data');
  } catch (error) {
    await page.screenshot({ path: `${ARTIFACT_DIR}/mobile-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await desktopSmoke(browser);
  await mobileSmoke(browser);
  console.log('PASS production browser smoke: desktop + mobile + runtime + previous completed history + current wellness sync + scrubbing + six lenses + legacy chart scrubbing');
} finally {
  await browser.close();
}
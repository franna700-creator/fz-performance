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
  assert.match(await page.locator('#nextSlot').innerText(), /(06|13|20):00 SAST/, `${label}: next refresh must be one of the locked slots`);

  for (const id of ['today', 'trends', 'train', 'system']) {
    const selector = label === 'mobile' ? `.bottom button[data-page="${id}"]` : `.nav button[data-page="${id}"]`;
    await page.locator(selector).click();
    await page.waitForFunction(pageId => document.getElementById(pageId)?.classList.contains('active'), id);
  }

  assert.deepEqual(pageErrors, [], `${label}: no page errors allowed`);
  assert.deepEqual(consoleErrors, [], `${label}: no console errors allowed`);
}

async function scrubSnapshot(page, selector) {
  return page.locator(selector).evaluate(el => {
    const style = getComputedStyle(el);
    return {
      className: el.className,
      opacity: style.opacity,
      visibility: style.visibility,
      display: style.display,
      text: el.textContent?.trim() || ''
    };
  });
}

async function desktopSmoke(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const state = await assertGateway(context);
  const page = await context.newPage();
  try {
    await bootAndNavigate(page, 'desktop');
    await page.locator('.nav button[data-page="trends"]').click();
    await page.waitForSelector('#recoveryChart svg', { timeout: 10000 });
    await page.waitForSelector('#loadChart svg', { timeout: 10000 });
    await page.waitForSelector('#aetChart svg', { timeout: 10000 });
    await page.waitForSelector('#runScatter svg', { timeout: 10000 });

    const chart = page.locator('#recoveryChart');
    const box = await chart.boundingBox();
    assert.ok(box && box.width > 100 && box.height > 100, 'desktop: recovery chart must have a real rendered box');
    await chart.hover({ position: { x: Math.round(box.width * 0.45), y: Math.round(box.height * 0.45) } });
    await page.waitForTimeout(250);
    const pointer = await scrubSnapshot(page, '#recoveryChart .chart-scrub-tooltip');
    console.log('DESKTOP_SCRUB', JSON.stringify(pointer));
    assert.ok(pointer.className.includes('show'), 'desktop: pointer scrub must activate tooltip class');
    assert.notEqual(pointer.opacity, '0', 'desktop: pointer scrub tooltip must be visually visible');
    assert.ok(pointer.text.length > 8, 'desktop: pointer scrub tooltip must contain observation data');

    await chart.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const keyboard = await scrubSnapshot(page, '#recoveryChart .chart-scrub-tooltip');
    assert.ok(keyboard.className.includes('show') && keyboard.text.length > 8, 'desktop: keyboard scrub must show observation data');

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
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  await assertGateway(context);
  const page = await context.newPage();
  try {
    await bootAndNavigate(page, 'mobile');
    await page.locator('.bottom button[data-page="trends"]').click();
    await page.waitForSelector('#recoveryChart svg', { timeout: 10000 });
    const chart = page.locator('#recoveryChart');
    await chart.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const box = await chart.boundingBox();
    assert.ok(box && box.width > 100 && box.height > 100, 'mobile: chart must render');
    assert.ok(box.y < viewport.height && box.y + box.height > 0, 'mobile: chart must be inside the touch viewport before interaction');

    const tapX = Math.max(1, Math.min(viewport.width - 2, box.x + box.width * 0.5));
    const tapY = Math.max(1, Math.min(viewport.height - 2, box.y + Math.min(box.height * 0.45, 120)));
    await page.touchscreen.tap(tapX, tapY);
    await page.waitForTimeout(250);
    const touch = await scrubSnapshot(page, '#recoveryChart .chart-scrub-tooltip');
    console.log('MOBILE_SCRUB', JSON.stringify({ ...touch, tapX, tapY, box }));
    assert.ok(touch.className.includes('show'), 'mobile: touch scrub must activate tooltip class');
    assert.notEqual(touch.opacity, '0', 'mobile: touch scrub tooltip must be visually visible');
    assert.ok(touch.text.length > 8, 'mobile: touch scrub tooltip must contain observation data');
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
  console.log('PASS production browser smoke: desktop + mobile + runtime + navigation + chart scrubbing');
} finally {
  await browser.close();
}

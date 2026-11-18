/* global document, window, CustomEvent, requestAnimationFrame, scrollY, process */
// Evidence capture (not a test): node e2e/safesurf.capture.mjs with the dev server on :5183.
import { chromium } from '@playwright/test';
import { renameSync, rmSync } from 'node:fs';
const ARGS = [
  '--use-angle=swiftshader',
  '--use-gl=angle',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
const BASE = 'http://localhost:5183/';
const browser = await chromium.launch({ args: ARGS });
// The machine is shared and software GL is slow: give every wait generous room.
const SLOW = 180000;

async function shots(tag, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.setDefaultTimeout(SLOW);
  await page.goto(`${BASE}?safesurfDelay=40000&safesurfManual=1`);
  const demo = page.getByTestId('safesurf-demo');
  await demo.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="safesurf-demo"]')?.getAttribute('data-render') ===
      'webgl',
    undefined,
    { timeout: SLOW },
  );
  const step = async (ms) => {
    await page.evaluate(
      (m) => window.dispatchEvent(new CustomEvent('safesurf:step', { detail: m })),
      ms,
    );
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
  };
  const snap = async (name, wait = 600) => {
    await page.waitForTimeout(wait);
    const b = await demo.boundingBox();
    await page.screenshot({
      path: `docs/reports/img/safesurf-${tag}-${name}.png`,
      fullPage: true,
      clip: {
        x: 0,
        y: b.y + (await page.evaluate(() => scrollY)),
        width: viewport.width,
        height: b.height,
      },
    });
  };
  // Evidence only: hide the fixed site nav so it does not paint over the rig in full-page clips.
  await page.addStyleTag({ content: 'header.nav{visibility:hidden!important}' });
  await snap('default');
  await page.getByTestId('safesurf-allow-site').click();
  await page.getByTestId('safesurf-sponsor').click();
  await step(2000);
  // Keep the phone on screen while the burn runs (the stage pauses off screen).
  await page.locator('.ss-phone').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.getByTestId('safesurf-block').dispatchEvent('click');
  await step(0);
  await step(420);
  await snap('midburn');
  await step(3000);
  await page.getByTestId('safesurf-allow-site').click();
  await snap('countdown', 150);
  await page.getByTestId('safesurf-sponsor').click();
  // The stage pauses while the phone is off screen, so bring it back before it re-forms.
  await page.locator('.ss-phone').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await step(0);
  await step(3000);
  await snap('allowed');
  await page.close();
}
if (!process.env.VIDEO_ONLY) await shots('desktop', { width: 1440, height: 900 });
if (!process.env.VIDEO_ONLY) await shots('mobile', { width: 390, height: 844 });

// Video: real clock, short delay, full flow.
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: '/tmp/ss-video', size: { width: 1280, height: 800 } },
});
const page = await ctx.newPage();
page.setDefaultTimeout(SLOW);
await page.goto(`${BASE}?safesurfDelay=12000`);
const demo = page.getByTestId('safesurf-demo');
await demo.scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
const phone = page.locator('.ss-phone');
const pb = await phone.boundingBox();
await page.mouse.move(pb.x + 20, pb.y + 40, { steps: 8 });
await page.mouse.move(pb.x + pb.width - 20, pb.y + pb.height - 60, { steps: 20 });
await page.waitForTimeout(500);
await page.getByTestId('safesurf-allow-site').click();
await page.waitForTimeout(2000);
// Busy: a second unlock shakes the lock, sponsor asks for the shortcut that is refused.
await page.getByTestId('safesurf-allow-page').click({ force: true });
await page.waitForTimeout(1500);
await page.getByTestId('safesurf-sponsor').click({ force: true });
await page.waitForTimeout(2500);
// Wait out the compressed hour, watch the burn, then lock it back.
await page.getByTestId('safesurf-block').waitFor({ state: 'visible', timeout: 60000 });
await page.waitForTimeout(3500);
await page.getByTestId('safesurf-block').click();
await page.waitForTimeout(3500);
for (const b of await page.locator('button[data-testid^="safesurf-bypass-"]').all()) {
  await b.click();
  await page.waitForTimeout(900);
}
await page.getByTestId('safesurf-allow-page').click();
await page.waitForTimeout(2500);
await page.getByTestId('safesurf-block').waitFor({ state: 'visible', timeout: 60000 });
await page.waitForTimeout(3500);
const vid = page.video();
await ctx.close();
renameSync(await vid.path(), 'docs/reports/video/safesurf.webm');
rmSync('/tmp/ss-video', { recursive: true, force: true });
await browser.close();

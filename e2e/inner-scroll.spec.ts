import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Inner scroll areas must take the wheel while they can still scroll, and hand off to the page at their end.
 * The page runs Lenis smooth scroll; this guards against it swallowing wheel input meant for an inner scroller.
 */
test.beforeEach(() => {
  test.setTimeout(120_000);
});

const TOL = 4;
const sizes = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const top = (el: Locator) => el.evaluate((n) => n.scrollTop);
const room = (el: Locator) => el.evaluate((n) => n.scrollHeight - n.clientHeight - n.scrollTop);

async function wheelOver(page: Page, el: Locator, dy: number, steps = 1) {
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(60);
  }
  // Let any smoothing settle.
  await page.waitForTimeout(900);
}

/** Centres the element in the viewport and waits for the page to be still. */
async function centre(page: Page, el: Locator) {
  await el.evaluate((n) => n.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(900);
}

async function expectInnerThenPage(page: Page, el: Locator) {
  await centre(page, el);
  const free = await room(el);
  expect(free).toBeGreaterThan(100);
  const y0 = await scrollY(page);
  const t0 = await top(el);
  // Half of the available travel: the inner area must absorb all of it.
  await wheelOver(page, el, Math.floor(free / 6), 3);
  expect(await top(el)).toBeGreaterThan(t0 + free * 0.3);
  expect(Math.abs((await scrollY(page)) - y0)).toBeLessThanOrEqual(TOL);

  // Past the end: the article reaches its end, then the page takes over (a fresh gesture, no trap).
  await wheelOver(page, el, await room(el), 1);
  expect(await room(el)).toBeLessThanOrEqual(1);
  const yEnd = await scrollY(page);
  // New gestures at the end must reach the page. A slow runner can still be latched to the inner scroller for the
  // first one, so allow a few fresh gestures; a scroll trap would never move the page at all.
  let moved = false;
  for (let i = 0; i < 4 && !moved; i++) {
    await wheelOver(page, el, 400, 1);
    moved = (await scrollY(page)) > yEnd + 100;
  }
  expect(moved).toBe(true);
}

async function openSafeSurf(page: Page) {
  await page.goto('/?safesurfDelay=60000');
  const demo = page.getByTestId('safesurf-demo');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toBeVisible({ timeout: 90_000 });
  return page.getByRole('region', { name: /Mock news article/ });
}

async function openXrayDiagnosis(page: Page) {
  await page.goto('/');
  await page.getByTestId('xray-stage').scrollIntoViewIfNeeded();
  const region = page.getByTestId('xray-region-1');
  await expect(region).toBeVisible({ timeout: 90_000 });
  await region.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('xray-description')).toHaveAttribute('data-complete', 'true', {
    timeout: 90_000,
  });
  return page.getByRole('region', { name: 'Diagnosis details' });
}

for (const s of sizes) {
  test.describe(`inner scroll at ${s.name}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('SafeSurf phone article scrolls under the wheel, then hands off to the page', async ({
      page,
    }) => {
      await expectInnerThenPage(page, await openSafeSurf(page));
    });
  });
}

test.describe('inner scroll at 390x844 (diagnosis panel)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('X-Ray diagnosis panel scrolls under the wheel, then hands off', async ({ page }) => {
    const panel = await openXrayDiagnosis(page);
    await centre(page, panel);
    if ((await room(panel)) < 100) test.skip(true, 'diagnosis fits without scrolling');
    await expectInnerThenPage(page, panel);
  });
});

test.describe('inner scroll with reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  test('SafeSurf phone article scrolls natively', async ({ page }) => {
    await expectInnerThenPage(page, await openSafeSurf(page));
  });
});

test.describe('inner scroll areas are keyboard reachable', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('every overflowing [data-scroll-area] is a focusable, named region', async ({ page }) => {
    await page.goto('/');
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-scroll-area]')]
        .filter(
          (n) =>
            (n.tabIndex < 0 && n.scrollHeight > n.clientHeight + 1) ||
            n.getAttribute('role') !== 'region' ||
            !n.getAttribute('aria-label'),
        )
        .map((n) => n.className),
    );
    expect(bad).toEqual([]);
  });
  test('every overflow:auto|scroll element in the page opts in with data-scroll-area', async ({
    page,
  }) => {
    await page.goto('/');
    const missing = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((n) => {
          const o = getComputedStyle(n);
          return (
            (o.overflowY === 'auto' || o.overflowY === 'scroll') &&
            !n.hasAttribute('data-scroll-area') &&
            !n.closest('[data-scroll-area]')
          );
        })
        .map((n) => n.className || n.tagName),
    );
    expect(missing).toEqual([]);
  });
});

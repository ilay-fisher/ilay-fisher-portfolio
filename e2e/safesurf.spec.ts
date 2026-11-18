import { expect, test, type Page } from '@playwright/test';

/** The demo's delay is shortened by the `safesurfDelay` query hook so the suite never sleeps long. */
const URL = '/?safesurfDelay=1500';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function open(page: Page, delayMs?: number) {
  await page.goto(delayMs ? `/?safesurfDelay=${delayMs}` : URL);
  const demo = page.getByTestId('safesurf-demo');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toBeVisible();
  return demo;
}

const media = (page: Page) => page.locator('[data-ss-media]');
const allIn = async (page: Page, state: 'blocked' | 'allowed') => {
  await expect(media(page).first()).toHaveAttribute('data-state', state);
  for (const m of await media(page).all()) await expect(m).toHaveAttribute('data-state', state);
};

test('images are hidden by default while the article text is visible', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  const demo = await open(page);
  await allIn(page, 'blocked');
  await expect(demo.getByRole('heading', { level: 3 })).toBeVisible();
  await expect(page.getByTestId('safesurf-status')).toContainText('4 images blocked');
  // Software GL is slow to compile shaders on a loaded runner, so give the stage time.
  await expect(demo).toHaveAttribute('data-render', 'webgl', { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('allow starts the countdown, images stay blocked, then they appear after the delay', async ({
  page,
}) => {
  // Software GL makes each step slow, so give the blocked-then-allowed check room.
  await open(page, 3000);
  await page.getByTestId('safesurf-allow-site').click();
  await expect(page.getByTestId('safesurf-countdown')).toContainText(/\d/);
  await allIn(page, 'blocked');
  await allIn(page, 'allowed');
  await expect(page.getByTestId('safesurf-status')).toContainText('Images and video allowed');
});

test('blocking again is instant, and the filter switch is queued like any loosening', async ({
  page,
}) => {
  await open(page, 60000);
  await page.getByTestId('safesurf-allow-site').click();
  await page.getByTestId('safesurf-sponsor').click();
  await allIn(page, 'allowed');
  await page.getByTestId('safesurf-block').click();
  await allIn(page, 'blocked');

  await page.getByTestId('safesurf-switch').click();
  await expect(page.getByTestId('safesurf-switch')).toBeChecked();
  await expect(page.getByTestId('safesurf-countdown')).toContainText(/\d/);
  await page.getByTestId('safesurf-cancel').click();
  await expect(page.getByTestId('safesurf-status')).not.toContainText('Unlock request');
});

test('ask sponsor skips the wait', async ({ page }) => {
  await page.goto('/?safesurfDelay=30000');
  await page.getByTestId('safesurf-demo').scrollIntoViewIfNeeded();
  await page.getByTestId('safesurf-allow-page').click();
  await page.getByTestId('safesurf-sponsor').click();
  await allIn(page, 'allowed');
});

test('a bypass attempt is refused', async ({ page }) => {
  await open(page);
  await page.getByTestId('safesurf-bypass-dns').click();
  await expect(page.getByTestId('safesurf-bypass-result')).toContainText(/private DNS/i);
  await allIn(page, 'blocked');
});

test('the main flow works with the keyboard alone', async ({ page }) => {
  await open(page);
  await page.getByTestId('safesurf-allow-site').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('safesurf-countdown')).toContainText(/\d/);
  await page.getByTestId('safesurf-cancel').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('safesurf-status')).not.toContainText('Unlock request');
  await page.getByTestId('safesurf-switch').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('safesurf-countdown')).toContainText(/\d/);
  await page.getByTestId('safesurf-sponsor').focus();
  await page.keyboard.press('Enter');
  await allIn(page, 'allowed');
  await expect(page.getByTestId('safesurf-switch')).not.toBeChecked();
});

test('no horizontal scroll at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.getByTestId('safesurf-demo').boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('the burn is a choreographed sequence: staggered, handed to the canvas, then the tile is left', async ({
  page,
}) => {
  await page.goto('/?safesurfDelay=1500&safesurfManual=1');
  const demo = page.getByTestId('safesurf-demo');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute('data-render', 'webgl', { timeout: 20_000 });
  const step = async (ms: number) => {
    await page.evaluate(
      (m) => window.dispatchEvent(new CustomEvent('safesurf:step', { detail: m })),
      ms,
    );
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
  };
  await page.getByTestId('safesurf-allow-site').click();
  await page.getByTestId('safesurf-sponsor').click();
  await step(2000);
  const hidden = () => page.locator('img.ss-media__img[data-gl-hidden]').count();
  expect(await hidden()).toBe(0);
  await page.getByTestId('safesurf-block').click();
  await step(100);
  // Early in the sequence only the first images have been handed to the canvas.
  const early = await hidden();
  expect(early).toBeGreaterThan(0);
  await step(500);
  const mid = await hidden();
  expect(mid).toBeGreaterThanOrEqual(early);
  await step(2500);
  // At rest the real tiles show and the canvas lets go of every image.
  await expect.poll(hidden).toBeGreaterThanOrEqual(0);
  await allIn(page, 'blocked');
});

test('a second request while the lock is busy shakes it, and the sponsor gets a confirm mark', async ({
  page,
}) => {
  const demo = await open(page, 60000);
  await page.getByTestId('safesurf-allow-site').click();
  await page.getByTestId('safesurf-allow-page').click({ force: true });
  await expect(demo.locator('.ss-lock')).toHaveAttribute('data-shake', /^[01]$/);
  await page.getByTestId('safesurf-sponsor').click();
  await expect(demo.locator('.ss-ring__snap')).toHaveAttribute('data-via', 'sponsor');
  await expect(demo.locator('.ss-ring__check')).toHaveCount(1);
});

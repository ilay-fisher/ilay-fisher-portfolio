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

async function open(page: Page) {
  await page.goto(URL);
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
  await expect(demo).toHaveAttribute('data-render', 'webgl');
  expect(errors).toEqual([]);
});

test('allow starts the countdown, images stay blocked, then they appear after the delay', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('safesurf-allow-site').click();
  await expect(page.getByTestId('safesurf-countdown')).toContainText(/\d/);
  await allIn(page, 'blocked');
  await allIn(page, 'allowed');
  await expect(page.getByTestId('safesurf-status')).toContainText('Images and video allowed');
});

test('blocking again is instant, and the filter switch is queued like any loosening', async ({
  page,
}) => {
  await open(page);
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

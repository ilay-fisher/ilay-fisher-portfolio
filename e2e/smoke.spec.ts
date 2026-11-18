import { expect, test, type Page } from '@playwright/test';

const IDS = ['top', 'about', 'safesurf', 'drone', 'xray', 'experience', 'contact'];

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('loads with no console errors and has all sections in order', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  const ids = await page.$$eval('main > section', (els) => els.map((e) => e.id));
  expect(ids).toEqual(IDS);
  expect(errors).toEqual([]);
});

test('title and description are set', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ilay Fisher/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /hold up/);
});

for (const [label, id] of [
  ['About', 'about'],
  ['SafeSurf', 'safesurf'],
  ['Drone', 'drone'],
  ['X-Ray', 'xray'],
  ['Experience', 'experience'],
  ['Contact', 'contact'],
] as const) {
  test(`nav link "${label}" scrolls to #${id}`, async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name: label })
      .click();
    // The last section may be unable to reach the top of the viewport; then the page is at its end.
    await expect
      .poll(
        async () =>
          page.locator(`#${id}`).evaluate((el) => {
            const top = Math.round(el.getBoundingClientRect().top);
            const atEnd =
              window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
            return top < 120 || atEnd;
          }),
        { timeout: 8000 },
      )
      .toBe(true);
  });
}

test('skip link is first in tab order and targets main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute('href', '#main');
});

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
  { width: 360, height: 740 },
]) {
  test(`no horizontal scroll at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('reduced motion still renders everything', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  for (const id of IDS) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  for (const t of ['hero-canvas', 'safesurf-demo', 'drone-demo', 'xray-demo']) {
    await expect(page.getByTestId(t)).toBeVisible();
  }
  const hidden = await page.$$eval(
    '[data-reveal]',
    (els) => els.filter((e) => getComputedStyle(e).opacity === '0').length,
  );
  expect(hidden).toBe(0);
  expect(errors).toEqual([]);
});

test('self-hosted fonts load and nothing is requested from other origins', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http'))
      external.push(r.url());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() =>
    document.fonts.check('800 20px "Bricolage Grotesque Variable"'),
  );
  expect(ok).toBe(true);
  expect(external).toEqual([]);
});

test('WebGL2 is available in this browser', async ({ page }) => {
  await page.goto('/');
  const ok = await page.evaluate(() =>
    Boolean(document.createElement('canvas').getContext('webgl2')),
  );
  expect(ok).toBe(true);
});

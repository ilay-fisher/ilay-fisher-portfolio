import { expect, test } from '@playwright/test';

const radius = (selector: string) =>
  `parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(selector)})).borderTopLeftRadius)`;

test.describe('design v2: nothing is a sharp rectangle', () => {
  test('buttons, tags, stage and portrait all have a radius', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.btn');
    for (const selector of ['.btn', '.tag', '.stage', '.lens', '.lens__glass', '.nav__bar']) {
      const r = await page.evaluate(radius(selector));
      expect(r, `${selector} radius`).toBeGreaterThan(0);
    }
  });

  test('no console errors while scrolling the whole page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    for (const id of ['about', 'safesurf', 'drone', 'xray', 'experience', 'contact']) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
      await page.waitForTimeout(150);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('design v2: no horizontal scroll', () => {
  for (const [w, h] of [
    [360, 740],
    [390, 844],
    [1440, 900],
  ]) {
    test(`at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await page.waitForTimeout(500);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw).toBeLessThanOrEqual(w);
    });
  }
});

test.describe('design v2: cursor', () => {
  test('appears with a fine pointer after the first mouse move and never blocks clicks', async ({
    page,
  }) => {
    await page.goto('/');
    const cursor = page.getByTestId('cursor');
    await expect(cursor).toBeAttached();
    await expect(page.locator('html')).not.toHaveClass(/has-cursor/);
    await page.mouse.move(400, 400);
    await page.mouse.move(420, 410);
    await expect(page.locator('html')).toHaveClass(/has-cursor/);
    await expect(cursor).toHaveAttribute('data-visible', 'true');
    expect(await cursor.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    // hugging a control: hover the first nav link
    const link = page.locator('.nav__links a').first();
    await link.hover();
    await expect(cursor).toHaveAttribute('data-mode', 'hug');
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    test('is absent on touch devices', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('cursor')).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveClass(/has-cursor/);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('is absent under reduced motion and content is visible', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('cursor')).toHaveCount(0);
      await expect(page.getByTestId('grain')).toHaveAttribute('data-moving', 'false');
      await expect(page.getByRole('heading', { level: 2, name: /Built alone/ })).toBeVisible();
    });
  });
});

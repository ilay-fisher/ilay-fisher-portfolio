import { expect, test, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/');
  const demo = page.getByTestId('xray-demo');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toBeVisible();
  await expect(page.getByTestId('xray-heatmap')).toHaveAttribute(
    'data-source',
    /computed|fallback/,
    {
      timeout: 15_000,
    },
  );
  return demo;
}

test.describe('X-Ray demo', () => {
  test('images load and the computed heatmap is not blank', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await openDemo(page);

    const loaded = await page.evaluate(() =>
      ['xray-target-image', 'xray-baseline-image'].map((id) => {
        const img = document.querySelector<HTMLImageElement>(`[data-testid="${id}"]`);
        return !!img && img.complete && img.naturalWidth > 0;
      }),
    );
    expect(loaded[0]).toBe(true);

    await expect(page.getByTestId('xray-heatmap')).toHaveAttribute('data-source', 'computed');
    const painted = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(
        '[data-testid="xray-heatmap"] canvas, canvas[data-testid="xray-heatmap"]',
      );
      if (!c) return 0;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 0) n++;
      return n;
    });
    expect(painted).toBeGreaterThan(50);
    expect(errors).toEqual([]);
  });

  test('keyboard and drag move the slider clip', async ({ page }) => {
    await openDemo(page);
    const slider = page.getByTestId('xray-slider');
    await slider.focus();
    await slider.press('Home');
    await expect(slider).toHaveValue('0');
    await slider.press('End');
    await expect(slider).toHaveValue('100');
    await slider.press('Home');
    for (let i = 0; i < 10; i++) await slider.press('ArrowRight');
    await expect(slider).toHaveValue('10');

    const box = (await page.getByTestId('xray-stage').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, { steps: 8 });
    await page.mouse.up();
    const v = Number(await slider.inputValue());
    expect(v).toBeGreaterThan(65);
    expect(v).toBeLessThan(85);
  });

  test('PCB detects regions and a selected region streams its diagnosis', async ({ page }) => {
    await openDemo(page);
    const first = page.getByRole('button', { name: /^Region 1 of \d+/ });
    await expect(first).toBeVisible();
    const regionCount = await page.locator('[data-testid^="xray-region-"]').count();
    expect(regionCount).toBeGreaterThanOrEqual(1);

    await page.getByTestId('xray-region-1').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('xray-diagnosis')).toBeVisible();
    await expect(page.getByTestId('xray-crop-pair')).toBeVisible();
    await expect(page.getByTestId('xray-replay-note')).toContainText(/recorded/i);
    await expect(page.getByTestId('xray-diagnosis').getByRole('status')).toContainText(
      /Region 1 of/,
      { timeout: 15_000 },
    );
    const text = (await page.getByTestId('xray-description').textContent()) ?? '';
    expect(text.length).toBeGreaterThan(40);
  });

  test('preset switch reloads the stage and finds its region', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('xray-preset-aerial').click();
    await expect(page.getByTestId('xray-preset-aerial')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('xray-region-1')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('xray-measured')).toContainText(/ms/);
  });

  test('keyboard-only run reaches a diagnosis', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('xray-preset-ui').focus();
    await page.keyboard.press('Enter');
    const region = page.getByTestId('xray-region-1');
    await expect(region).toBeVisible({ timeout: 15_000 });
    await region.focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('xray-diagnosis')).toBeVisible();
  });

  test('no horizontal scroll at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

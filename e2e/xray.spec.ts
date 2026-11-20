import { expect, test, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/');
  const demo = page.getByTestId('xray-demo');
  await demo.scrollIntoViewIfNeeded();
  await page.getByTestId('xray-stage').scrollIntoViewIfNeeded();
  await expect(demo).toBeVisible();
  await expect(page.getByTestId('xray-heatmap')).toHaveAttribute(
    'data-source',
    /computed|fallback/,
    { timeout: 60_000 },
  );
  return demo;
}

test.describe('X-Ray demo', () => {
  test.describe.configure({ timeout: 120_000 });
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

  test('the intro sweep waits for scrolling to stop, then plays @gl-heavy', async ({ page }) => {
    // Frame timing matters here, so it runs alone (gl-heavy project): on a starved machine a frame can
    // take longer than the idle window and look like the scroll stopped.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('xray-heatmap')).toHaveAttribute(
      'data-source',
      /computed|fallback/,
      {
        timeout: 60_000,
      },
    );
    // Park above the section until the page has finished laying out, then scroll onto it.
    await page.waitForTimeout(2000);
    const r = await page.evaluate(async () => {
      const st = document.querySelector('[data-testid="xray-stage"]')!;
      const knob = document.querySelector<HTMLElement>('.xray__knob')!;
      const base = st.getBoundingClientRect().top + scrollY - 150;
      const seen: [number, string][] = [];
      const t0 = performance.now();
      let i = 0;
      await new Promise<void>((done) => {
        const f = () => {
          const t = performance.now() - t0;
          // A finger keeps the page moving over the stage for the first second.
          if (t < 1000) window.scrollTo({ top: base + (i++ % 2 ? 4 : 0), behavior: 'instant' });
          seen.push([t, knob.style.left]);
          if (t < 5000) requestAnimationFrame(f);
          else done();
        };
        requestAnimationFrame(f);
      });
      return {
        movedWhileScrolling: seen.filter(([t, l]) => t < 1000 && l !== '50%').length,
        positionsAfter: new Set(seen.filter(([t]) => t >= 1000).map(([, l]) => l)).size,
      };
    });
    expect(r.movedWhileScrolling).toBe(0);
    expect(r.positionsAfter).toBeGreaterThan(3);
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

    await page.getByTestId('xray-stage').scrollIntoViewIfNeeded();
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
      { timeout: 60_000 },
    );
    const text = (await page.getByTestId('xray-description').textContent()) ?? '';
    expect(text.length).toBeGreaterThan(40);
  });

  test('preset switch reloads the stage and finds its region', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('xray-preset-aerial').click();
    await expect(page.getByTestId('xray-preset-aerial')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('xray-region-1')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('xray-measured')).toContainText(/ms/);
  });

  test('keyboard-only run reaches a diagnosis', async ({ page }) => {
    // Reduced motion completes the stream at once, so nothing depends on wall-clock typing time.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openDemo(page);
    await page.getByTestId('xray-preset-ui').focus();
    await page.keyboard.press('Enter');
    const region = page.getByTestId('xray-region-1');
    await expect(region).toBeVisible({ timeout: 60_000 });
    await region.focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('xray-diagnosis')).toBeVisible();
    await expect(page.getByTestId('xray-description')).toHaveAttribute('data-complete', 'true');
  });

  test('no horizontal scroll at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('knob follows the slider on the rail and the cursor contract is set', async ({ page }) => {
    await openDemo(page);
    const slider = page.getByTestId('xray-slider');
    await expect(slider.locator('xpath=..')).toHaveAttribute('data-cursor', 'drag');
    await slider.focus();
    await slider.press('Home');
    const knob = page.locator('.xray__knob');
    await expect
      .poll(async () => (await knob.boundingBox())?.x ?? 999, { timeout: 60_000 })
      .toBeLessThan((await page.getByTestId('xray-stage').boundingBox())!.x + 8);
    await slider.press('End');
    await expect
      .poll(async () => (await knob.boundingBox())?.x ?? 0, { timeout: 60_000 })
      .toBeGreaterThan((await page.getByTestId('xray-stage').boundingBox())!.x + 200);
    await expect(page.getByTestId('xray-region-1')).toHaveAttribute('data-cursor', 'scan');
  });

  test('the rig does not change height when a diff result lands (no layout shift)', async ({
    page,
  }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await openDemo(page);
      const demo = page.getByTestId('xray-demo');
      await page.getByTestId('xray-preset-aerial').click();
      // The diff may already be done by the time we look (fast machine), so pending is not asserted.
      const pending = (await demo.boundingBox())!.height;
      await expect(page.getByTestId('xray-heatmap')).toHaveAttribute(
        'data-source',
        /computed|fallback/,
        { timeout: 60_000 },
      );
      const done = (await demo.boundingBox())!.height;
      expect(Math.abs(done - pending)).toBeLessThanOrEqual(1);
    }
  });

  test('the section never changes the page layout while it loads, computes and streams', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // reduced motion completes the stream at once, so the run never depends on typing time
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const metrics = () =>
      page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        panel: Math.round(
          document.querySelector('[data-testid="xray-diagnosis"]')!.getBoundingClientRect().height,
        ),
        readout: Math.round(
          document.querySelector('[data-testid="xray-readout"]')!.getBoundingClientRect().height,
        ),
        experienceTop: Math.round(
          document.getElementById('experience')!.getBoundingClientRect().top + window.scrollY,
        ),
      }));
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const loaded = await metrics();
      await page.getByTestId('xray-demo').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('xray-heatmap')).toHaveAttribute(
        'data-source',
        /computed|fallback/,
        { timeout: 60_000 },
      );
      const computed = await metrics();
      await page.getByTestId('xray-stage').scrollIntoViewIfNeeded();
      await page.getByTestId('xray-region-1').click();
      await expect(page.getByTestId('xray-diagnosis')).toBeVisible();
      await expect(page.getByTestId('xray-crop-pair')).toBeVisible();
      const selected = await metrics();
      await expect(page.getByTestId('xray-description')).toHaveAttribute('data-complete', 'true', {
        timeout: 60_000,
      });
      const finished = await metrics();
      expect({ width, computed }).toEqual({ width, computed: loaded });
      expect({ width, selected }).toEqual({ width, selected: loaded });
      expect({ width, finished }).toEqual({ width, finished: loaded });
    }
  });
});

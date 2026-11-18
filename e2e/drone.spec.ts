import { expect, test, type Locator, type Page } from '@playwright/test';

/** Shape of `window.__drone.state()`, exposed only with `?drone=test`. */
interface DroneState {
  cols: number;
  rows: number;
  replans: number;
  status: 'flying' | 'arrived' | 'blocked';
  algo: 'astar' | 'dstar';
  mode: 'demo' | 'manual';
  obstacles: number;
  wind: number;
  route: number[];
  goal: { x: number; y: number };
  drone: { x: number; y: number };
  frames: number;
}

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __drone: { state(): DroneState } }).__drone.state());

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function open(page: Page, query = 'drone=test') {
  await page.goto(`/?${query}#drone`);
  const rig = page.getByTestId('drone-demo');
  await rig.scrollIntoViewIfNeeded();
  await expect(rig).toHaveAttribute('data-ready', 'true');
  return rig;
}

/** Page coordinates of the centre of grid cell (cx, cy). */
async function cellPoint(canvas: Locator, st: DroneState, cx: number, cy: number) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  return {
    x: box.x + ((cx + 0.5) / st.cols) * box.width,
    y: box.y + ((cy + 0.5) / st.rows) * box.height,
  };
}

test('the canvas draws a city, not a blank box', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await open(page);
  const stats = await page.getByTestId('drone-canvas').evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return { w: 0, colours: 0, nonBg: 0 };
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const seen = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4 * 7) {
      const k = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const top = Math.max(...seen.values());
    const total = [...seen.values()].reduce((a, b) => a + b, 0);
    return { w: c.width, colours: seen.size, nonBg: total - top };
  });
  expect(stats.w).toBeGreaterThan(300);
  expect(stats.colours).toBeGreaterThan(5);
  expect(stats.nonBg).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test('dropping an obstacle on the route re-plans and changes the path', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await open(page);
  const before = await state(page);
  expect(before.replans).toBe(0);
  await page.getByTestId('drone-btn-drop').click();
  const after = await state(page);
  expect(after.replans).toBe(1);
  expect(after.route).not.toEqual(before.route);
  expect(after.obstacles).toBe(before.obstacles + 1);
  await expect(page.getByTestId('drone-readout-replans')).toHaveText('1');
  await expect(page.getByTestId('drone-live')).toContainText(/Route blocked\. Re-planned in/);
  expect(errors).toEqual([]);
});

test('dragging on the canvas paints obstacles, and the Erase toggle removes them', async ({
  page,
}) => {
  await open(page);
  const canvas = page.getByTestId('drone-canvas');
  const st = await state(page);
  const y = st.rows - 3;
  const a = await cellPoint(canvas, st, 6, y);
  const b = await cellPoint(canvas, st, 14, y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  const painted = await state(page);
  expect(painted.obstacles).toBeGreaterThanOrEqual(st.obstacles + 4);
  await page.getByTestId('drone-erase').click();
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(a.x, a.y, { steps: 12 });
  await page.mouse.up();
  const erased = await state(page);
  expect(erased.obstacles).toBeLessThan(painted.obstacles);
});

test('the wind tool paints wind zones', async ({ page }) => {
  await open(page);
  const canvas = page.getByTestId('drone-canvas');
  const st = await state(page);
  await page.getByTestId('drone-tool-wind').click();
  const a = await cellPoint(canvas, st, 5, 2);
  const b = await cellPoint(canvas, st, 9, 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  expect((await state(page)).wind).toBeGreaterThan(st.wind);
});

test('reset restores the starting scene', async ({ page }) => {
  await open(page);
  const base = await state(page);
  await page.getByTestId('drone-btn-drop').click();
  await page.getByTestId('drone-btn-drop').click();
  await page.getByTestId('drone-btn-wind').click();
  expect((await state(page)).replans).toBeGreaterThan(0);
  await page.getByTestId('drone-btn-reset').click();
  const after = await state(page);
  expect(after.replans).toBe(0);
  expect(after.obstacles).toBe(base.obstacles);
  expect(after.wind).toBe(base.wind);
  expect(after.route.at(-1)).toBe(base.route.at(-1));
  await expect(page.getByTestId('drone-readout-replans')).toHaveText('0');
});

test('walling in the goal says so and the drone holds position', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await open(page);
  const canvas = page.getByTestId('drone-canvas');
  const st = await state(page);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const p = await cellPoint(canvas, st, st.goal.x + dx, st.goal.y + dy);
      await page.mouse.click(p.x, p.y);
    }
  }
  await expect(page.getByTestId('drone-status')).toContainText(/No route/);
  await expect(page.getByTestId('drone-live')).toContainText(
    /No route to the goal\. The drone holds position\./,
  );
  const held = await state(page);
  expect(held.status).toBe('blocked');
  await page.waitForTimeout(600);
  const later = await state(page);
  expect(later.drone).toEqual(held.drone);
  // Remove one wall: the route comes back.
  await page.getByTestId('drone-erase').click();
  const p = await cellPoint(canvas, st, st.goal.x - 1, st.goal.y);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('drone-live')).toContainText(/Route found again/);
  expect((await state(page)).status).toBe('flying');
  expect(errors).toEqual([]);
});

test('keyboard only: every action works without a pointer', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await open(page);
  const drop = page.getByTestId('drone-btn-drop');
  await drop.focus();
  await expect(drop).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await state(page)).replans).toBe(1);
  await page.getByTestId('drone-btn-wind').focus();
  await page.keyboard.press('Space');
  expect((await state(page)).replans).toBe(2);
  await page.getByTestId('drone-algo-dstar').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('drone-readout-algorithm')).toHaveText('D* Lite');
  await page.getByTestId('drone-btn-goal').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('drone-live')).toContainText(/New goal/);
  await page.getByTestId('drone-btn-reset').focus();
  await page.keyboard.press('Enter');
  expect((await state(page)).replans).toBe(0);
  // Every control reachable by Tab.
  await page.getByTestId('drone-tool-obstacle').focus();
  const reached = new Set<string>();
  for (let i = 0; i < 14; i++) {
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
    if (id) reached.add(id);
    await page.keyboard.press('Tab');
  }
  for (const id of ['drone-tool-wind', 'drone-btn-drop', 'drone-btn-reset', 'drone-algo-astar']) {
    expect(reached.has(id), id).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('runs itself when idle and stops as soon as the visitor interacts', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await open(page, 'drone=test-auto');
  await expect(page.getByTestId('drone-demo')).toHaveAttribute('data-mode', 'demo');
  await expect
    .poll(async () => (await state(page)).replans, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  await page.getByTestId('drone-tool-wind').click();
  await expect(page.getByTestId('drone-demo')).toHaveAttribute('data-mode', 'manual');
  const n = (await state(page)).replans;
  await page.waitForTimeout(5000);
  expect((await state(page)).replans).toBe(n);
  expect(errors).toEqual([]);
});

test('the frame loop runs while visible, and pauses off screen', async ({ page }) => {
  await open(page);
  const f1 = (await state(page)).frames;
  // headless runs with tracing on can render well under 60 fps, so poll for growth
  await expect
    .poll(async () => (await state(page)).frames, { timeout: 12_000 })
    .toBeGreaterThan(f1 + 4);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const g1 = (await state(page)).frames;
  await page.waitForTimeout(400);
  const g2 = (await state(page)).frames;
  expect(g2 - g1).toBeLessThanOrEqual(2);
});

test('reduced motion: a planned path is shown and no loop runs', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/?drone=test#drone');
  const rig = page.getByTestId('drone-demo');
  await rig.scrollIntoViewIfNeeded();
  await expect(rig).toHaveAttribute('data-motion', 'static');
  await expect(rig).toHaveAttribute('data-ready', 'true');
  const s1 = await state(page);
  expect(s1.route.length).toBeGreaterThan(2);
  await page.waitForTimeout(600);
  expect((await state(page)).frames).toBe(s1.frames);
  await page.getByTestId('drone-btn-drop').click();
  expect((await state(page)).replans).toBe(1);
  await ctx.close();
});

test('no horizontal scroll at 390 px and the rig fits', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await open(page);
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
  const box = await page.getByTestId('drone-canvas').boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  expect((await state(page)).cols).toBeLessThan(40);
  await ctx.close();
});

test('touch does not hijack scrolling unless Draw mode is on', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await open(page);
  const canvas = page.getByTestId('drone-canvas');
  expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
  await page.getByTestId('drone-draw-mode').click();
  expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
  await ctx.close();
});

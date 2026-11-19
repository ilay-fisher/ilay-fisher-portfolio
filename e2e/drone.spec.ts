import { expect, test, type Locator, type Page } from '@playwright/test';
import { scrollSettled } from './helpers';

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
  simTime: number;
  clock: 'raf' | 'manual';
}

type Probe = {
  state(): DroneState;
  step(n: number, dtMs?: number): DroneState;
  loopActive(): boolean;
};

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __drone: { state(): DroneState } }).__drone.state());

/**
 * Advances the simulation by `n` ticks of `dtMs` simulated ms through the probe's manual clock.
 * Nothing in these tests waits on wall-clock time or on the frame rate.
 */
const step = (page: Page, n: number, dtMs = 16) =>
  page.evaluate(
    ([c, d]) => (window as unknown as { __drone: Probe }).__drone.step(c!, d),
    [n, dtMs],
  );

const loopActive = (page: Page) =>
  page.evaluate(() => (window as unknown as { __drone: Probe }).__drone.loopActive());

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
  await expect(rig).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
  // The `#drone` deep link keeps re-aiming the page until it has been quiet for a moment (lazy content shifts layout).
  // Measure and drag only once the page has stopped moving, or canvas coordinates go stale between read and use.
  await scrollSettled(page, { samples: 10 });
  // Centre the canvas so no grid cell sits under the sticky nav, whatever the viewport.
  await page
    .getByTestId('drone-canvas')
    .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await scrollSettled(page, { samples: 4 });
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

// Readiness waits on a lazy chunk and a mount; on a saturated CI box that can take a while.
test.setTimeout(60_000);

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
  // Cell points are read fresh for every drag: a canvas that moved between measuring and pressing would drop the stroke.
  const drag = async (from: number, to: number) => {
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const a = await cellPoint(canvas, st, from, y);
    const b = await cellPoint(canvas, st, to, y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  await expect(async () => {
    await drag(6, 14);
    expect((await state(page)).obstacles).toBeGreaterThanOrEqual(st.obstacles + 4);
  }).toPass({ timeout: 20_000 });
  const painted = await state(page);
  await page.getByTestId('drone-erase').click();
  await expect(async () => {
    await drag(14, 6);
    expect((await state(page)).obstacles).toBeLessThan(painted.obstacles);
  }).toPass({ timeout: 20_000 });
});

test('the wind tool paints wind zones', async ({ page }) => {
  await open(page);
  const canvas = page.getByTestId('drone-canvas');
  const st = await state(page);
  await page.getByTestId('drone-tool-wind').click();
  await expect(async () => {
    // Centre the canvas so the top rows are clear of the sticky nav, then read the points fresh.
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const a = await cellPoint(canvas, st, 5, 2);
    const b = await cellPoint(canvas, st, 9, 2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    expect((await state(page)).wind).toBeGreaterThan(st.wind);
  }).toPass({ timeout: 20_000 });
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
  expect(after.route).toEqual(base.route);
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
  const later = await step(page, 60);
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
  expect((await state(page)).replans).toBe(0);
  // 15 simulated seconds of idle run
  const idle = await step(page, 940);
  expect(idle.replans).toBeGreaterThanOrEqual(1);
  await page.getByTestId('drone-tool-wind').click();
  await expect(page.getByTestId('drone-demo')).toHaveAttribute('data-mode', 'manual');
  const n = (await state(page)).replans;
  expect((await step(page, 500)).replans).toBe(n);
  expect(errors).toEqual([]);
});

test('the manual clock is deterministic: same seed and steps give the same flight', async ({
  page,
}) => {
  await open(page, 'drone=test-auto');
  const a = await step(page, 400);
  await page.reload();
  await expect(page.getByTestId('drone-demo')).toHaveAttribute('data-ready', 'true');
  const b = await step(page, 400);
  expect(b.frames).toBe(400);
  expect(b.simTime).toBeCloseTo(6400, 3);
  expect(b.drone).toEqual(a.drone);
  expect(b.route).toEqual(a.route);
  expect(b.replans).toBe(a.replans);
  expect(a.drone).not.toEqual({ x: 0, y: 0 });
});

test('the frame loop is active while visible and stops off screen', async ({ page }) => {
  await open(page, 'drone=test-live');
  await expect.poll(() => loopActive(page)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => loopActive(page)).toBe(false);
  await page.getByTestId('drone-demo').scrollIntoViewIfNeeded();
  await expect.poll(() => loopActive(page)).toBe(true);
});

test('reduced motion: a planned path is shown and no loop runs', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/?drone=test-live#drone');
  const rig = page.getByTestId('drone-demo');
  await rig.scrollIntoViewIfNeeded();
  await expect(rig).toHaveAttribute('data-motion', 'static');
  await expect(rig).toHaveAttribute('data-ready', 'true');
  const s1 = await state(page);
  expect(s1.route.length).toBeGreaterThan(2);
  expect(await loopActive(page)).toBe(false);
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

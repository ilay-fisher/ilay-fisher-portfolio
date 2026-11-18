import { expect, test, type Page } from '@playwright/test';

/** The hero exposes `window.__hero` only with ?heroSeed, so every test is deterministic. */
const URL = '/?heroSeed=11';
const SETTLE_MS = 90_000;

interface Snap {
  id: string;
  pos: { x: number; y: number; z: number };
  asleep: boolean;
}

const canvas = (page: Page) => page.getByTestId('hero-canvas');
const snap = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hero: { snapshot(): Snap[] } }).__hero.snapshot());
const names = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __hero: { nameSnapshot(): number[][] } }).__hero.nameSnapshot(),
  );
const project = (page: Page, id: string) =>
  page.evaluate(
    (i) =>
      (
        window as unknown as { __hero: { project(id: string): { x: number; y: number } | null } }
      ).__hero.project(i),
    id,
  );
const dist = (a: Snap, b: Snap) =>
  Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);

async function openHero(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  return errors;
}

async function settle(page: Page) {
  await expect(canvas(page)).toHaveAttribute('data-sleeping', 'true', { timeout: SETTLE_MS });
}

test.describe('hero scene', () => {
  test.setTimeout(240_000);

  test('becomes ready with every body dropped, then settles inside the bounds', async ({
    page,
  }) => {
    const errors = await openHero(page);
    await expect(canvas(page)).toHaveAttribute('data-bodies', '16', { timeout: 30_000 });
    await settle(page);
    const bounds = await page.evaluate(() =>
      (
        window as unknown as {
          __hero: { bounds(): { minX: number; maxX: number; minZ: number; maxZ: number } };
        }
      ).__hero.bounds(),
    );
    for (const s of await snap(page)) {
      expect(s.pos.x, s.id).toBeGreaterThan(bounds.minX);
      expect(s.pos.x, s.id).toBeLessThan(bounds.maxX);
      expect(s.pos.z, s.id).toBeGreaterThan(bounds.minZ);
      expect(s.pos.z, s.id).toBeLessThan(bounds.maxZ);
      expect(s.pos.y, s.id).toBeGreaterThan(0);
      expect(s.pos.y, s.id).toBeLessThan(2.5);
    }
    expect(errors).toEqual([]);
  });

  test('dragging moves an object, throwing it moves others, and the name never moves', async ({
    page,
  }) => {
    const errors = await openHero(page);
    await settle(page);
    const nameBefore = await names(page);
    const before = await snap(page);
    const a = before.find((s) => s.id === 'key-node')!;
    const b = [...before].filter((s) => s.id !== a.id).sort((p, q) => dist(p, a) - dist(q, a))[0]!;
    const pa = (await project(page, a.id))!;
    const pb = (await project(page, b.id))!;

    // Drag: hold and move; the object follows.
    await page.mouse.move(pa.x, pa.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(pa.x + i * 10, pa.y - i * 6);
      await page.waitForTimeout(80);
    }
    const held = (await snap(page)).find((s) => s.id === a.id)!;
    expect(dist(held, a)).toBeGreaterThan(0.4);

    // Throw: sweep through the neighbour and let go while moving.
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        pa.x + 80 + ((pb.x - pa.x - 80) * i) / steps,
        pa.y - 48 + ((pb.y - pa.y + 48) * i) / steps,
      );
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await page.waitForTimeout(2500);
    const after = await snap(page);
    const moved = after.filter(
      (s) =>
        s.id !== a.id &&
        dist(
          s,
          before.find((x) => x.id === s.id)!,
        ) > 0.05,
    );
    expect(moved.length).toBeGreaterThan(0);
    expect(await names(page)).toEqual(nameBefore);
    expect(errors).toEqual([]);
  });

  test('reset drops everything again and it settles', async ({ page }) => {
    await openHero(page);
    await settle(page);
    await page.getByRole('button', { name: 'Drop again' }).click();
    await expect(canvas(page)).toHaveAttribute('data-sleeping', 'false');
    await settle(page);
    expect(await snap(page)).toHaveLength(16);
  });

  test('keyboard: N selects, arrows push, announcements are made', async ({ page }) => {
    await openHero(page);
    await settle(page);
    await canvas(page).focus();
    await page.keyboard.press('n');
    await expect(page.getByRole('status')).toContainText('selected');
    const before = await snap(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1200);
    const after = await snap(page);
    const moved = after.filter(
      (s) =>
        dist(
          s,
          before.find((x) => x.id === s.id)!,
        ) > 0.2,
    );
    expect(moved.length).toBeGreaterThan(0);
    await expect(page.getByRole('status')).toContainText(/pushed|hopped/);
  });

  test('the canvas is not blank', async ({ page }) => {
    await openHero(page);
    await settle(page);
    const clip = { x: 600, y: 120, width: 800, height: 700 };
    const withScene = await page.screenshot({ clip });
    await canvas(page).evaluate((c) => (c.style.visibility = 'hidden'));
    const without = await page.screenshot({ clip });
    expect(withScene.equals(without)).toBe(false);
    expect(withScene.length).toBeGreaterThan(without.length * 1.5);
  });
});

test.describe('hero fallback and layout', () => {
  test('reduced motion shows the still and runs no scene', async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await expect(page.locator('img.hero__still')).toBeVisible();
    await expect(canvas(page)).toHaveAttribute('data-ready', 'false');
    expect(await page.evaluate(() => '__hero' in window)).toBe(false);
    await ctx.close();
  });

  test('the real text and actions are present at 1440 and 390 with no horizontal scroll', async ({
    browser,
  }) => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      await page.goto(URL);
      await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Ilay Fisher' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'See SafeSurf' })).toHaveAttribute(
        'href',
        '#safesurf',
      );
      await expect(page.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
        'href',
        '#contact',
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
      await ctx.close();
    }
  });
});

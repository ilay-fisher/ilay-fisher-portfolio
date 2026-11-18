import { expect, test, type Page } from '@playwright/test';

/**
 * The hero exposes `window.__hero` only with ?heroSeed. `heroFast=1` settles the physics before the
 * first frame, so every scene test starts from the same resting state and never waits for a slow
 * software-GL drop. Tests that need time passing call `__hero.step(n)` instead of sleeping.
 */
const URL = '/?heroSeed=11&heroFast=1';

interface Snap {
  id: string;
  pos: { x: number; y: number; z: number };
  asleep: boolean;
}
interface Pixels {
  width: number;
  height: number;
  covered: number;
  colours: number;
  spread: number;
}
interface Hero {
  ids(): string[];
  snapshot(): Snap[];
  nameSnapshot(): number[][];
  bounds(): { minX: number; maxX: number; minZ: number; maxZ: number };
  project(id: string): { x: number; y: number } | null;
  throwBody(id: string, v: { x: number; y: number; z: number }): void;
  step(n?: number): void;
  settle(): boolean;
  hits(): number;
  pixels(): Pixels;
}
const hero = <T>(page: Page, fn: (h: Hero) => T, arg?: unknown) =>
  page.evaluate(
    ([src, a]) => {
      const h = (window as unknown as { __hero: Hero }).__hero;
      return (new Function('h', 'a', `return (${src})(h, a)`) as (h: Hero, a: unknown) => T)(h, a);
    },
    [fn.toString(), arg] as const,
  );

const canvas = (page: Page) => page.getByTestId('hero-canvas');
const snap = (page: Page) => hero(page, (h) => h.snapshot());
const dist = (a: Snap, b: Snap) =>
  Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
const status = (page: Page) => page.locator('#top').getByRole('status');

async function openHero(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  return errors;
}

test.describe('hero scene', () => {
  test.setTimeout(60_000);

  test('the canvas is not blank right after the first rendered frame', async ({ page }) => {
    const errors = await openHero(page);
    const px = await hero(page, (h) => h.pixels());
    expect(px.covered, 'share of pixels with something drawn').toBeGreaterThan(0.1);
    expect(px.colours, 'distinct colours').toBeGreaterThan(30);
    expect(px.spread, 'luminance spread').toBeGreaterThan(8);
    expect(errors).toEqual([]);
  });

  test('is ready already settled, with every body inside the bounds', async ({ page }) => {
    const errors = await openHero(page);
    const ids = await hero(page, (h) => h.ids());
    // 32 on a GPU, fewer on small screens or software renderers; never fewer than the top ten plus pieces.
    expect(ids.length).toBeGreaterThanOrEqual(14);
    expect(ids.length).toBeLessThanOrEqual(32);
    await expect(canvas(page)).toHaveAttribute('data-bodies', String(ids.length));
    await expect(canvas(page)).toHaveAttribute('data-sleeping', 'true');
    const bounds = await hero(page, (h) => h.bounds());
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

  test('a throw moves other objects and the name never moves', async ({ page }) => {
    const errors = await openHero(page);
    const nameBefore = await hero(page, (h) => h.nameSnapshot());
    const before = await snap(page);
    const a = before.find((s) => s.id === 'key-node') ?? before[0]!;
    const b = [...before].filter((s) => s.id !== a.id).sort((p, q) => dist(p, a) - dist(q, a))[0]!;
    await hero(page, (h, id) => h.throwBody(id as string, { x: 0, y: 1, z: -22 }), a.id);
    await hero(page, (h) => h.step(240));
    const after = await snap(page);
    const moved = after.filter(
      (s) =>
        dist(
          s,
          before.find((x) => x.id === s.id)!,
        ) > 0.05,
    );
    expect(moved.length).toBeGreaterThan(0);
    expect(b.id).toBeTruthy();
    expect(await hero(page, (h) => h.nameSnapshot())).toEqual(nameBefore);
    expect(errors).toEqual([]);
  });

  test('dragging with the mouse picks up the object under the pointer', async ({ page }) => {
    await openHero(page);
    const before = await snap(page);
    // The pointer picks whatever is on top, which may not be the first body: drag the front-most one.
    const front = [...before].sort((p, q) => q.pos.z - p.pos.z)[0]!;
    const p = (await hero(page, (h, i) => h.project(i as string), front.id))!;
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(p.x + i * 14, p.y - i * 8);
    await expect
      .poll(
        async () => {
          const now = await snap(page);
          return Math.max(
            ...now.map((s) =>
              dist(
                s,
                before.find((x) => x.id === s.id)!,
              ),
            ),
          );
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0.4);
    await page.mouse.up();
  });

  test('hovering an object shows its name in the chip', async ({ page }) => {
    await openHero(page);
    const id = (await hero(page, (h) => h.ids()))[0]!;
    const p = (await hero(page, (h, i) => h.project(i as string), id))!;
    await page.mouse.move(p.x - 4, p.y - 4);
    await page.mouse.move(p.x, p.y);
    await expect(page.getByTestId('hero-chip')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('hero-chip')).toHaveText(/\S/);
  });

  test('reset drops everything again and it settles', async ({ page }) => {
    await openHero(page);
    const n = (await hero(page, (h) => h.ids())).length;
    await page.getByRole('button', { name: 'Drop again' }).click();
    await expect(canvas(page)).toHaveAttribute('data-sleeping', 'true', { timeout: 20_000 });
    expect(await snap(page)).toHaveLength(n);
  });

  test('keyboard: N selects, arrows push, Space hops, announcements are made', async ({ page }) => {
    await openHero(page);
    await canvas(page).focus();
    await page.keyboard.press('n');
    await expect(status(page)).toContainText('selected');
    const before = await snap(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await hero(page, (h) => h.step(120));
    const after = await snap(page);
    expect(
      after.some(
        (s) =>
          dist(
            s,
            before.find((x) => x.id === s.id)!,
          ) > 0.2,
      ),
    ).toBe(true);
    await expect(status(page)).toContainText(/pushed|hopped/);
  });

  test('keyboard: Enter on a project piece scrolls to its section and it is announced', async ({
    page,
  }) => {
    await openHero(page);
    await canvas(page).focus();
    const count = (await hero(page, (h) => h.ids())).length;
    let found = false;
    for (let i = 0; i < count && !found; i++) {
      await page.keyboard.press('n');
      const text = (await status(page).textContent()) ?? '';
      found = /Enter to jump to its section/.test(text);
    }
    expect(found, 'a project piece announces how to open it').toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/#(safesurf|drone|xray)/);
  });

  test('hits on the name are counted, with nothing else changing', async ({ page }) => {
    await openHero(page);
    const counter = page.getByTestId('hero-hits');
    await expect(counter).toHaveText(/^Hits on the name: \d+\. Damage: 0\.$/);
    const ids = await hero(page, (h) => h.ids());
    for (const id of ids.slice(0, 6)) {
      await hero(page, (h, i) => h.throwBody(i as string, { x: 0, y: 2, z: -24 }), id);
      await hero(page, (h) => h.step(90));
    }
    const hits = await hero(page, (h) => h.hits());
    expect(hits).toBeGreaterThan(0);
    await expect(counter).toHaveText(`Hits on the name: ${hits}. Damage: 0.`, { timeout: 10_000 });
  });
});

test.describe('hero fallback and layout', () => {
  test('automated browsers get the still unless the live scene is opted into', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('img.hero__still')).toBeVisible();
    await expect(canvas(page)).toHaveAttribute('data-ready', 'false');
    await page.goto('/?hero=live&heroFast=1');
    await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
    await expect(page.locator('img.hero__still')).toHaveCount(0);
  });

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
    test.setTimeout(60_000);
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      await page.goto(URL);
      await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Ilay Fisher' })).toBeAttached();
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

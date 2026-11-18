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
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
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
  nameBounds(): Rect | null;
  bodyBounds(id: string): Rect | null;
  throwBody(id: string, v: { x: number; y: number; z: number }): void;
  step(n?: number): void;
  settle(): boolean;
  hits(): number;
  pixels(): Pixels;
}
const hero = <T, A = undefined>(page: Page, fn: (h: Hero, arg: A) => T, arg?: A): Promise<T> =>
  page.evaluate(
    ([src, a]) => {
      const h = (window as unknown as { __hero: Hero }).__hero;
      return (
        new Function('h', 'a', `return (${src as string})(h, a)`) as (h: Hero, a: unknown) => T
      )(h, a);
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
  await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  return errors;
}

test.describe('hero scene', () => {
  test.setTimeout(120_000);

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
    // 29 on a wide GPU screen (25 technologies and 4 projects), 17 on a phone; fewer on software renderers.
    expect(ids.length).toBeGreaterThanOrEqual(14);
    expect(ids.length).toBeLessThanOrEqual(29);
    // Everything is a technology or a project: no generic hardware.
    expect(ids.filter((id) => /dial|toggle|switch/.test(id))).toEqual([]);
    for (const id of ['shield', 'logo', 'drone', 'lens']) expect(ids).toContain(id);
    expect(ids).not.toContain('lock');
    expect(ids).not.toContain('phone');
    await expect(canvas(page)).toHaveAttribute('data-bodies', String(ids.length));
    // Fast path is already at rest; `settle()` re-publishes synchronously, so this never races a frame.
    expect(await hero(page, (h) => h.settle())).toBe(true);
    await expect.poll(() => canvas(page).getAttribute('data-sleeping')).toBe('true');
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

  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
  ] as const) {
    test(`after the intro no piece covers the name, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openHero(page);
      const name = await hero(page, (h) => h.nameBounds());
      expect(name).not.toBeNull();
      const n = name!;
      const tolerance = 8;
      for (const id of await hero(page, (h) => h.ids())) {
        const b = await hero(page, (h, i: string) => h.bodyBounds(i), id);
        if (!b) continue;
        const ox = Math.min(b.x1, n.x1) - Math.max(b.x0, n.x0);
        const oy = Math.min(b.y1, n.y1) - Math.max(b.y0, n.y0);
        expect(Math.min(ox, oy), `${id} overlaps the name`).toBeLessThanOrEqual(tolerance);
      }
    });
  }

  test('a throw moves other objects and the name never moves', async ({ page }) => {
    const errors = await openHero(page);
    const nameBefore = await hero(page, (h) => h.nameSnapshot());
    const before = await snap(page);
    const a = before.find((s) => s.id === 'token-node') ?? before[0]!;
    const b = [...before].filter((s) => s.id !== a.id).sort((p, q) => dist(p, a) - dist(q, a))[0]!;
    await hero(page, (h, id: string) => h.throwBody(id, { x: 0, y: 1, z: -22 }), a.id);
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
    const p = (await hero(page, (h, i: string) => h.project(i), front.id))!;
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
        { timeout: 40_000 },
      )
      .toBeGreaterThan(0.4);
    await page.mouse.up();
  });

  test('hovering an object shows its name in the chip', async ({ page }) => {
    await openHero(page);
    const id = (await hero(page, (h) => h.ids()))[0]!;
    const p = (await hero(page, (h, i: string) => h.project(i), id))!;
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

  test('as a visitor gets it (live physics, smooth scroll), a real double-click scrolls all the way to the section', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // No heroFast, no reduced motion: the page keeps Lenis smooth scrolling and the scene keeps simulating.
    await page.goto('/?hero=live&heroDebug=1');
    await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
    const projects = [
      ['logo', '#safesurf'],
      ['shield', '#safesurf'],
      ['drone', '#drone'],
      ['lens', '#xray'],
    ] as const;
    for (const [id, hash] of projects) {
      await page.evaluate(() => {
        history.replaceState(null, '', location.pathname + location.search);
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
      await page.waitForTimeout(1500);
      const at = await hero(page, (h, i: string) => h.project(i), id);
      expect(at, `${id} is on screen`).not.toBeNull();
      await page.mouse.dblclick(at!.x, at!.y);
      await expect.poll(() => page.evaluate(() => location.hash), { message: id }).toBe(hash);
      // Wait for scrolling to stop, then the section must sit at the top.
      let last = -1;
      let still = 0;
      await expect
        .poll(
          async () => {
            const y = await page.evaluate(() => Math.round(window.scrollY));
            still = Math.abs(y - last) < 1 ? still + 1 : 0;
            last = y;
            return still;
          },
          { message: `${id}: scrolling stops`, timeout: 30_000, intervals: [300] },
        )
        .toBeGreaterThanOrEqual(4);
      const top = await page.evaluate(
        (h) => document.querySelector(h)?.getBoundingClientRect().top ?? 9999,
        hash,
      );
      expect(Math.abs(top), `${id}: ${hash} ends at the top of the viewport`).toBeLessThan(160);
    }
  });

  test('a single click does not open a section', async ({ page }) => {
    await openHero(page);
    const at = await hero(page, (h) => h.project('logo'));
    await page.mouse.click(at!.x, at!.y);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => location.hash)).toBe('');
  });

  test('hits on the name are counted, with nothing else changing', async ({ page }) => {
    await openHero(page);
    const counter = page.getByTestId('hero-hits');
    await expect(counter).toHaveText(/^Hits on the name: \d+\. Damage: 0\.$/);
    const ids = await hero(page, (h) => h.ids());
    for (const id of ids) {
      await hero(page, (h, i: string) => h.throwBody(i, { x: 0, y: 2, z: -24 }), id);
      await hero(page, (h) => h.step(90));
      if ((await hero(page, (h) => h.hits())) > 0) break;
    }
    const hits = await hero(page, (h) => h.hits());
    expect(hits).toBeGreaterThan(0);
    await expect(counter).toHaveText(`Hits on the name: ${hits}. Damage: 0.`, { timeout: 10_000 });
  });
});

test.describe('hero fallback and layout', () => {
  test('automated browsers get the still unless the live scene is opted into', async ({ page }) => {
    test.setTimeout(120_000);
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

test.describe('hero layout', () => {
  test.setTimeout(120_000);

  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ] as const) {
    test(`nothing below the hero moves when the scene mounts, at ${width}px`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      const top = () =>
        page.locator('#about').evaluate((el) => el.getBoundingClientRect().top + scrollY);
      const heroH = () => page.locator('#top').evaluate((el) => el.getBoundingClientRect().height);
      await page.goto('/?heroSeed=11&heroFast=1', { waitUntil: 'commit' });
      await page.locator('#about').waitFor({ state: 'attached' });
      const early = { top: await top(), h: await heroH() };
      await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByTestId('hero-hits')).toBeVisible();
      expect(await top(), '#about offsetTop after the scene is ready').toBe(early.top);
      expect(await heroH(), 'hero height').toBe(early.h);
      await ctx.close();
    });
  }
});

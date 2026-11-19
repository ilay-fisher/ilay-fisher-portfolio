import { expect, test, type Page } from '@playwright/test';
import { profile } from '../src/content/profile';
import { afterFrames, scrollSettled } from './helpers';

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

test.describe('hero scene @gl-heavy', () => {
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
    // 30 on a wide GPU screen (25 technologies, LinkedIn and 4 projects), 18 on a phone; fewer on software renderers.
    expect(ids.length).toBeGreaterThanOrEqual(14);
    expect(ids.length).toBeLessThanOrEqual(30);
    // Everything is a technology or a project: no generic hardware.
    expect(ids.filter((id) => /dial|toggle|switch/.test(id))).toEqual([]);
    for (const id of ['shield', 'logo', 'drone', 'lens', 'token-github', 'linkedin'])
      expect(ids).toContain(id);
    expect(ids).not.toContain('lock');
    expect(ids).not.toContain('phone');
    await expect(canvas(page)).toHaveAttribute('data-bodies', String(ids.length));
    // Fast path is already at rest; `settle()` re-publishes synchronously, so this never races a frame.
    expect(await hero(page, (h) => h.settle())).toBe(true);
    await expect
      .poll(() => canvas(page).getAttribute('data-sleeping'), { timeout: 45_000 })
      .toBe('true');
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
    // Throw a piece that is really at rest, at its nearest resting neighbour. The seed leaves `token-node` leaning on the
    // right wall, awake: a throw into that contact is either soaked up or carried off depending on sub-millimetre
    // differences, which the number of frames that ran before the test (few on a slow runner, many on a fast one)
    // decides. Which piece is thrown must not depend on that.
    const resting = before.filter((s) => s.asleep);
    let a = resting[0]!;
    let b = resting[1]!;
    for (const p of resting)
      for (const q of resting) if (p.id !== q.id && dist(p, q) < dist(a, b)) [a, b] = [p, q];
    const gap = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    const v = { x: ((b.pos.x - a.pos.x) / gap) * 22, y: 1, z: ((b.pos.z - a.pos.z) / gap) * 22 };
    await hero(page, (h, [id, vel]: [string, typeof v]) => h.throwBody(id, vel), [a.id, v]);
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
    // The drop itself is real-time physics; `settle()` runs it to rest by simulated time, whatever the frame rate.
    expect(await hero(page, (h) => h.settle()), 'the drop comes to rest').toBe(true);
    await expect(canvas(page)).toHaveAttribute('data-sleeping', 'true', { timeout: 45_000 });
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
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // No heroFast, no reduced motion: the page keeps Lenis smooth scrolling and the scene keeps simulating.
    const projects = [
      ['logo', '#safesurf'],
      ['shield', '#safesurf'],
      ['drone', '#drone'],
      ['lens', '#xray'],
    ] as const;
    // One visit: the live drop alone takes tens of seconds on software GL, so it is paid once. Between pieces the page
    // goes back to the top the way a visitor does it, with the brand link (smooth scroll again, then stable).
    await page.goto('/?hero=live&heroDebug=1');
    await expect(canvas(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
    for (const [id, hash] of projects) {
      await page
        .getByRole('link', { name: /Ilay Fisher/ })
        .first()
        .click();
      await scrollSettled(page, { interval: 300, timeout: 60_000 });
      expect(await page.evaluate(() => window.scrollY), 'back at the top').toBeLessThan(5);
      // The piece must have stopped moving before it is pressed. What matters is this piece being asleep, not the whole
      // scene: in live mode the idle scheduler keeps nudging a random piece every few seconds (as it should), and on a
      // slow runner each nudge takes longer in wall time to die down than the scene-wide `data-sleeping` flag can be
      // caught true. The first piece waits for the real drop, which takes as long as the machine's frame rate makes it.
      // After a double-click the scene is awake again and, off screen, paused: later pieces run it to rest by simulated
      // time (`settle()`), which does not depend on the frame rate. Settling is repeated until the piece is asleep:
      // anything that wakes a body in between (a hover, a nudge, a resume after the scroll) is simply run to rest again.
      await expect(async () => {
        if (id !== projects[0][0]) expect(await hero(page, (h) => h.settle())).toBe(true);
        await expect
          .poll(async () => (await snap(page)).find((s) => s.id === id)?.asleep ?? false, {
            message: `${id} is asleep`,
            timeout: 8_000,
          })
          .toBe(true);
      }).toPass({ timeout: 90_000, intervals: [500, 1000, 2000] });
      let at: { x: number; y: number } | null = null;
      await expect
        .poll(
          async () => {
            // Compare positions a few drawn frames apart, not a few milliseconds: a starved page does not move in between.
            await afterFrames(page, 3);
            const a = await hero(page, (h, i: string) => h.project(i), id);
            const still = !!a && !!at && Math.hypot(a.x - at.x, a.y - at.y) < 0.5;
            at = a;
            return still;
          },
          { message: `${id} is on screen and at rest`, timeout: 40_000, intervals: [400] },
        )
        .toBe(true);
      const onCanvas = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute('data-testid'),
        [at!.x, at!.y],
      );
      expect(onCanvas, `${id} is not covered by other content`).toBe('hero-canvas');
      await page.mouse.dblclick(at!.x, at!.y);
      // A late layout shift (a lazy image or section above the target) while the scroll is under way: the anchor
      // tracker must retarget, which it does only if nothing cancelled it. This is what a visitor's page does.
      await page.evaluate((h) => {
        const spacer = document.createElement('div');
        spacer.id = 'e2e-spacer';
        spacer.style.height = '700px';
        document.querySelector(h)?.before(spacer);
      }, hash);
      await expect.poll(() => page.evaluate(() => location.hash), { message: id }).toBe(hash);
      // Wait for scrolling to stop, then the section must sit at the top.
      await scrollSettled(page, { interval: 300, timeout: 60_000 });
      const top = await page.evaluate(
        (h) => document.querySelector(h)?.getBoundingClientRect().top ?? 9999,
        hash,
      );
      expect(Math.abs(top), `${id}: ${hash} ends at the top of the viewport`).toBeLessThan(160);
      await page.evaluate(() => document.getElementById('e2e-spacer')?.remove());
    }
  });

  test('a double-click still opens a piece when the page is busy between the two presses', async ({
    page,
  }) => {
    await openHero(page);
    const at = await hero(page, (h) => h.project('logo'));
    // A heavy frame (software GL, a slow phone) can land between the press and the release. The two presses still
    // happened a few milliseconds apart, as the events' own time stamps say; only the handlers ran late.
    await page.evaluate(() => {
      let stalled = false;
      window.addEventListener('pointerdown', () => {
        if (stalled) return;
        stalled = true;
        const until = performance.now() + 450;
        while (performance.now() < until) {
          /* busy */
        }
      });
    });
    await page.mouse.dblclick(at!.x, at!.y);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#safesurf');
  });

  test('a single click does not open a section', async ({ page }) => {
    await openHero(page);
    const at = await hero(page, (h) => h.project('logo'));
    await page.mouse.click(at!.x, at!.y);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => location.hash)).toBe('');
  });

  /** The two profile pieces: scene id, accessible name, and where they lead (always from the profile). */
  const SOCIAL = [
    { id: 'token-github', name: 'GitHub', url: profile.links.github },
    { id: 'linkedin', name: 'LinkedIn', url: profile.links.linkedin },
  ] as const;

  /** Answers the profile hosts with a stub page, so a test never reaches github.com or linkedin.com. */
  async function blockProfileHosts(page: Page) {
    const hit: string[] = [];
    await page.context().route(/^https:\/\/([^/]+\.)?(github|linkedin)\.com\//, (route) => {
      hit.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' });
    });
    return hit;
  }

  /** Waits until the piece lies still on screen, and returns where to press it. */
  async function restingPoint(page: Page, id: string) {
    expect(await hero(page, (h) => h.settle()), 'the scene comes to rest').toBe(true);
    const at = (await hero(page, (h, i: string) => h.project(i), id))!;
    expect(at, `${id} is on screen`).not.toBeNull();
    const onCanvas = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute('data-testid'),
      [at.x, at.y],
    );
    expect(onCanvas, `${id} is not covered by other content`).toBe('hero-canvas');
    return at;
  }

  for (const piece of SOCIAL) {
    test(`a double-click on the ${piece.name} piece opens the profile in a new tab`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await blockProfileHosts(page);
      await openHero(page);
      const at = await restingPoint(page, piece.id);
      const [popup] = await Promise.all([
        page.context().waitForEvent('page'),
        page.mouse.dblclick(at.x, at.y),
      ]);
      await popup.waitForURL(piece.url);
      expect(popup.url()).toBe(piece.url);
      // The hero page itself stays where it was.
      expect(page.url()).toContain('heroSeed=11');
      expect(await page.evaluate(() => location.hash)).toBe('');
      await popup.close();
    });

    test(`Enter on the selected ${piece.name} piece opens the profile in a new tab`, async ({
      page,
    }) => {
      await blockProfileHosts(page);
      await openHero(page);
      await canvas(page).focus();
      const count = (await hero(page, (h) => h.ids())).length;
      let found = false;
      for (let i = 0; i < count && !found; i++) {
        await page.keyboard.press('n');
        const text = (await status(page).textContent()) ?? '';
        found = text.startsWith(`${piece.name} selected`);
      }
      expect(found, `${piece.name} is announced when selected`).toBe(true);
      await expect(status(page)).toContainText(
        `Double-click or press Enter to open my ${piece.name} profile in a new tab.`,
      );
      const [popup] = await Promise.all([
        page.context().waitForEvent('page'),
        page.keyboard.press('Enter'),
      ]);
      await popup.waitForURL(piece.url);
      expect(popup.url()).toBe(piece.url);
      await popup.close();
    });

    test(`a single click or a drag on the ${piece.name} piece opens nothing`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const requests = await blockProfileHosts(page);
      await openHero(page);
      const opened: string[] = [];
      page.context().on('page', (p) => opened.push(p.url()));
      const at = await restingPoint(page, piece.id);
      // A press that moves is a drag: it carries the piece and does not count towards a double press.
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (let i = 1; i <= 5; i++) await page.mouse.move(at.x + i * 12, at.y - i * 6);
      await page.mouse.up();
      // One tap, wherever the piece is now: a single press is never the open gesture.
      const to = (await hero(page, (h, i: string) => h.project(i), piece.id)) ?? at;
      await page.mouse.click(to.x, to.y);
      // Let the scene and the page run on: anything queued by the gesture has fired after this.
      await hero(page, (h) => h.step(60));
      await page.evaluate(() => new Promise<void>((r) => setTimeout(r, 0)));
      expect(opened).toEqual([]);
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => location.hash)).toBe('');
      expect(page.context().pages()).toHaveLength(1);
    });
  }

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

test.describe('hero fallback and layout @gl-heavy', () => {
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
      const actions = page.locator('.hero__actions');
      await expect(actions.getByRole('link', { name: 'See SafeSurf' })).toHaveAttribute(
        'href',
        '#safesurf',
      );
      await expect(actions.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
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

test.describe('hero layout @gl-heavy', () => {
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

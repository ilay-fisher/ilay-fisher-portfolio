import { expect, type Page } from '@playwright/test';

/** Animation frames of stillness that, together with `samples` x `interval` ms, mean a scroll is over. */
const STILL_FRAMES = 6;

/**
 * Resolves with the scroll position once it has stopped changing: `samples` consecutive reads, `interval` ms apart,
 * within 1 px of each other, and at least a few animation frames in which it did not move. Smooth scrolling and layout
 * shifts make a fixed wait wrong on a slow runner; this waits exactly as long as the page keeps moving, bounded only by
 * the test's own timeout.
 *
 * The frames matter on software GL: the browser can go a second or more between animation frames while the main thread
 * stays free, so a frame-driven scroller (Lenis) stands still in wall time without being done, and `page.evaluate`
 * answers happily in between. A scroller can only move on a frame, so "no frame saw it move" is the real condition.
 */
export async function scrollSettled(
  page: Page,
  { samples = 4, interval = 150, timeout = 60_000 } = {},
): Promise<number> {
  let last = Number.NaN;
  let stillSince = 0;
  let framesAtMove = 0;
  await expect
    .poll(
      async () => {
        const { y, frames } = await page.evaluate(() => {
          const w = window as unknown as { __frames?: number };
          if (w.__frames === undefined) {
            w.__frames = 0;
            const tick = () => {
              w.__frames = (w.__frames ?? 0) + 1;
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
          return { y: Math.round(window.scrollY), frames: w.__frames };
        });
        if (Math.abs(y - last) >= 1 || Number.isNaN(last)) {
          last = y;
          stillSince = Date.now();
          framesAtMove = frames;
        }
        // Frames counted from the first read after the last move, so a page that has not drawn a frame yet is not still.
        const stillFrames = frames - framesAtMove;
        return Date.now() - stillSince >= (samples - 1) * interval && stillFrames >= STILL_FRAMES;
      },
      { message: 'scrolling stops', timeout, intervals: [interval] },
    )
    .toBe(true);
  return last;
}

/**
 * How far the section's top is from where the sticky nav leaves it (negative: it is above), or 0 when the page simply
 * cannot scroll any further and the section is as high as it can get.
 */
export async function miss(page: Page, id: string): Promise<number> {
  return page.evaluate((sid) => {
    const el = document.getElementById(sid)!;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const off = el.getBoundingClientRect().top - pad;
    const atEnd = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2;
    return atEnd && off > 0 ? 0 : off;
  }, id);
}

/**
 * Waits until the page has stopped scrolling and the section sits where the nav leaves it (or the page is at its end).
 * Asserts the end state only; how long the scroll took is not under test here.
 */
export async function expectScrolledTo(page: Page, id: string, tolerance = 6): Promise<void> {
  await scrollSettled(page);
  expect(Math.abs(await miss(page, id)), `#${id} sits under the nav`).toBeLessThan(tolerance);
}

/** Waits until the stage's `data-*` attribute value holds the same string for `samples` reads in a row. */
export async function attrSettled(
  page: Page,
  selector: string,
  attr: string,
  { samples = 4, interval = 150, timeout = 30_000 } = {},
): Promise<string> {
  let last: string | null = null;
  let still = 0;
  await expect
    .poll(
      async () => {
        const v = await page.locator(selector).getAttribute(attr);
        still = v === last ? still + 1 : 0;
        last = v;
        return still;
      },
      { message: `${attr} settles`, timeout, intervals: [interval] },
    )
    .toBeGreaterThanOrEqual(samples);
  return last ?? '';
}

/** Lands on a section, then proves nothing drifts afterwards: a long quiet window with the target still in place. */
export async function landed(page: Page, id: string): Promise<void> {
  await expectScrolledTo(page, id);
  await scrollSettled(page, { samples: 8 });
  await expectScrolledTo(page, id);
}

/** Adds a zero-height spacer above `before`, for the layout-shift tests to grow. */
export async function addSpacer(page: Page, before: string): Promise<void> {
  await page.evaluate((id) => {
    const s = document.createElement('div');
    s.id = 'test-spacer';
    s.style.height = '0px';
    document.getElementById(id)?.before(s);
  }, before);
}

/**
 * Clicks the nav link from inside the page, then 150 ms later grows the spacer above the target: a layout shift under
 * a tracked scroll. Both happen in page code so a slow runner cannot stretch the gap between them.
 */
export async function clickThenGrow(page: Page, label: string, px: number): Promise<void> {
  await page.evaluate(
    ([name, h]) => {
      const nav = document.querySelector('nav[aria-label="Sections"]')!;
      const link = [...nav.querySelectorAll('a')].find((a) => a.textContent?.trim() === name);
      (link as HTMLElement).click();
      setTimeout(() => (document.getElementById('test-spacer')!.style.height = `${h}px`), 150);
    },
    [label, px] as const,
  );
}

/**
 * Presses Tab from a fresh start (focus on the document) and asserts the skip link takes it. A Tab sent while a slow
 * runner is still hydrating can be swallowed, so the whole press-and-check is retried from the top; what is asserted is
 * unchanged: from the start of the page, the first Tab stop is the skip link.
 */
export async function expectSkipLinkFirstTab(page: Page): Promise<void> {
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeAttached();
  await expect(async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused({ timeout: 2_000 });
  }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });
}

/**
 * Resolves after the page has drawn `n` more animation frames. A timeout cannot say this: on software GL a frame can
 * take a second, and a simulation (or a smooth scroller) only moves on frames.
 */
export async function afterFrames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

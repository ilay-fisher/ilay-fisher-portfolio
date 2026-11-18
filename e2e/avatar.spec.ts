import { expect, test, type Page } from '@playwright/test';

const glass = '#about .avatar__stage';

/**
 * Waits until the displayed frame index has stopped changing (the spring has settled), then returns it. The pointer
 * is nudged a pixel each poll so it never counts as idle (idle makes the head wander back on its own).
 */
async function settled(page: Page, x: number, y: number): Promise<number> {
  let prev = Number.NaN;
  let stable = 0;
  for (let i = 0; i < 80 && stable < 3; i++) {
    await page.mouse.move(x + (i % 2), y);
    await page.waitForTimeout(150);
    const cur = Number(await page.locator(glass).getAttribute('data-frame'));
    stable = cur === prev ? stable + 1 : 0;
    prev = cur;
  }
  return prev;
}

// the page runs a software-GL scene, so every mouse move waits on a slow frame
test.setTimeout(120_000);

test('the head follows the pointer: sweeping left to right never raises the frame index', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'frames', { timeout: 15000 });
  const box = (await page.locator('#about .avatar').boundingBox())!;
  const y = box.y + box.height / 2;
  const seen: number[] = [];
  for (let x = 4; x <= 1436; x += 180) {
    await page.mouse.move(x, y, { steps: 2 });
    seen.push(await settled(page, x, y));
  }
  for (let i = 1; i < seen.length; i++) {
    expect(seen[i]!, `frame at step ${i}: ${seen.join(',')}`).toBeLessThanOrEqual(seen[i - 1]!);
  }
  expect(seen[0]! - seen[seen.length - 1]!).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('the pointer is tracked anywhere on the page, not only over the avatar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'frames', { timeout: 15000 });
  await page.mouse.move(2, 5, { steps: 6 });
  const left = await settled(page, 2, 5);
  await page.mouse.move(1436, 5, { steps: 6 });
  const right = await settled(page, 1436, 5);
  expect(left).toBeGreaterThan(right);
});

test('reduced motion shows one static frame and ignores the pointer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'static', { timeout: 15000 });
  const first = await page.locator(glass).getAttribute('data-frame');
  await page.mouse.move(2, 400, { steps: 5 });
  await page.waitForTimeout(800);
  await page.mouse.move(1436, 400, { steps: 5 });
  await page.waitForTimeout(800);
  expect(await page.locator(glass).getAttribute('data-frame')).toBe(first);
});

test('if the frames fail the still stays; if the still fails too the monogram shows', async ({
  page,
}) => {
  await page.route('**/images/avatar/turn/f*.webp', (r) => r.abort());
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'still');
  await expect(page.locator('#about .avatar__stage img')).toBeVisible();
  await page.route('**/images/avatar/turn/still.webp', (r) => r.abort());
  await page.reload();
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'monogram');
  await expect(page.locator('#about .avatar__monogram')).toContainText('IF');
});

test('the avatar is lazy: nothing from the turn set loads until About is near', async ({
  page,
}) => {
  const urls: string[] = [];
  page.on('request', (r) => r.url().includes('/images/avatar/turn/f') && urls.push(r.url()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  expect(urls).toEqual([]);
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect.poll(() => urls.length, { timeout: 15000 }).toBeGreaterThan(30);
});

test('he blinks: within a bounded time a blink starts and ends, and the head and layout do not move', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'frames', { timeout: 15000 });
  const stage = page.locator(glass);
  const box = (await page.locator('#about .avatar').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.4;
  // hold the pointer over the face so he faces the visitor and never wanders off on an idle glance
  await page.mouse.move(x, y);
  await settled(page, x, y);
  const layoutOf = () =>
    page.evaluate(() => {
      const r = (s: string) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100);
      };
      return { stage: r('#about .avatar__stage'), canvas: r('#about .avatar__frames') };
    });
  const before = await layoutOf();
  const frameBefore = await stage.getAttribute('data-frame');
  // record every frame index and canvas box the stage reports while a blink is running
  await page.evaluate(() => {
    const el = document.querySelector('#about .avatar__stage') as HTMLElement;
    const w = window as unknown as { __blink: { frames: string[]; states: string[] } };
    w.__blink = { frames: [], states: [] };
    new MutationObserver(() => {
      w.__blink.states.push(el.dataset.blink ?? '');
      if (el.dataset.blink === 'blinking') w.__blink.frames.push(el.dataset.frame ?? '');
    }).observe(el, { attributes: true, attributeFilter: ['data-blink', 'data-frame'] });
  });
  let started = 0;
  let ended = 0;
  for (let i = 0; i < 130 && !(started >= 1 && ended >= started); i++) {
    await page.mouse.move(x + (i % 2), y);
    await page.waitForTimeout(100);
    started = Number(await stage.getAttribute('data-blink-started'));
    ended = Number(await stage.getAttribute('data-blink-ended'));
  }
  expect(started, 'a blink started within 13 s').toBeGreaterThanOrEqual(1);
  expect(ended, 'and it ended').toBeGreaterThanOrEqual(started);
  const seen = await page.evaluate(
    () => (window as unknown as { __blink: { frames: string[]; states: string[] } }).__blink,
  );
  expect(seen.states).toContain('blinking');
  expect(seen.states[seen.states.length - 1]).toBe('idle');
  expect(new Set(seen.frames), 'the frame index stays put during a blink').toEqual(
    new Set([frameBefore]),
  );
  expect(await stage.getAttribute('data-frame')).toBe(frameBefore);
  expect(await layoutOf()).toEqual(before);
  expect(errors).toEqual([]);
});

test('blinking pauses under reduced motion, and a missing atlas just means no blinking', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'static', { timeout: 15000 });
  await page.waitForTimeout(4500);
  expect(await page.locator(glass).getAttribute('data-blink')).toBe('off');
  expect(await page.locator(glass).getAttribute('data-blink-started')).toBe('0');

  const other = await page.context().newPage();
  await other.route('**/images/avatar/turn/blinks.webp', (r) => r.abort());
  await other.setViewportSize({ width: 1440, height: 900 });
  await other.goto('/');
  await other.locator('#about').scrollIntoViewIfNeeded();
  await expect(other.locator(glass)).toHaveAttribute('data-avatar', 'frames', { timeout: 15000 });
  await other.waitForTimeout(4500);
  expect(await other.locator(glass).getAttribute('data-blink')).toBe('off');
});

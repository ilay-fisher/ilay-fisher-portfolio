import { expect, test } from '@playwright/test';

const glass = '#about .lens__glass';

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
  const box = (await page.locator('#about .lens').boundingBox())!;
  const y = box.y + box.height / 2;
  const seen: number[] = [];
  for (let x = 4; x <= 1436; x += 120) {
    await page.mouse.move(x, y, { steps: 4 });
    await page.waitForTimeout(900);
    seen.push(Number(await page.locator(glass).getAttribute('data-frame')));
  }
  for (let i = 1; i < seen.length; i++) {
    expect(seen[i]!, `frame at step ${i}: ${seen.join(',')}`).toBeLessThanOrEqual(seen[i - 1]!);
  }
  expect(seen[0]! - seen[seen.length - 1]!).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('the pointer is tracked anywhere on the page, not only over the lens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'frames', { timeout: 15000 });
  await page.mouse.move(2, 5, { steps: 6 });
  await page.waitForTimeout(1200);
  const left = Number(await page.locator(glass).getAttribute('data-frame'));
  await page.mouse.move(1436, 5, { steps: 6 });
  await page.waitForTimeout(1200);
  const right = Number(await page.locator(glass).getAttribute('data-frame'));
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
  await expect(page.locator('#about .lens__glass img')).toBeVisible();
  await page.route('**/images/avatar/turn/still.webp', (r) => r.abort());
  await page.reload();
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator(glass)).toHaveAttribute('data-avatar', 'monogram');
  await expect(page.locator('#about .lens__monogram')).toContainText('IF');
});

test('the avatar is lazy: nothing from the turn set loads until About is near', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => r.url().includes('/images/avatar/turn/f') && urls.push(r.url()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  expect(urls).toEqual([]);
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect.poll(() => urls.length, { timeout: 15000 }).toBeGreaterThan(30);
});

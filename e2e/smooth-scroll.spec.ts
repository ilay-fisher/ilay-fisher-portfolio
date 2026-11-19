import { expect, test } from '@playwright/test';
import { addSpacer, clickThenGrow, expectScrolledTo, landed, scrollSettled } from './helpers';

// The real thing: Lenis smooth scrolling driven by the animation frame loop, the anchor tracker retargeting while it
// runs, and the visitor taking the wheel. This is wall-clock animation, so it runs in the serial `gl-heavy` project,
// alone on the machine. Every wait is "until the scroll position stops changing", never a fixed budget, and every
// assertion is on where the page ends up.
test.setTimeout(120_000);

const NAV = [
  ['AI', 'ai'],
  ['About', 'about'],
  ['SafeSurf', 'safesurf'],
  ['X-Ray', 'xray'],
  ['Drone', 'drone'],
  ['Experience', 'experience'],
  ['Get in touch', 'contact'],
] as const;

test.describe('smooth nav click lands on the section @gl-heavy', () => {
  for (const [label, id] of NAV) {
    test(`desktop nav "${label}" scrolls smoothly to #${id}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page
        .getByRole('navigation', { name: 'Sections' })
        .getByRole('link', { name: label })
        .click();
      await expectScrolledTo(page, id);
    });
  }

  test('mobile menu at 390 reaches every section', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    for (const [label, id] of NAV) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page
        .getByRole('navigation', { name: 'Sections' })
        .getByRole('link', { name: label })
        .click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expectScrolledTo(page, id);
    }
  });
});

test.describe('nav clicks while the layout above the target changes mid-scroll @gl-heavy', () => {
  test('at 1440 (desktop nav)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await addSpacer(page, 'experience');
    await clickThenGrow(page, 'Get in touch', 900);
    await landed(page, 'contact');
  });

  test('at 390 (menu)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await addSpacer(page, 'experience');
    await page.getByRole('button', { name: 'Menu' }).click();
    await clickThenGrow(page, 'Experience', 700);
    await landed(page, 'experience');
  });
});

test('any wheel input cancels a tracked scroll (the visitor wins) @gl-heavy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Get in touch' })
    .click();
  // Wait for the scroll to be under way (not for a fixed time), then take the wheel.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.mouse.wheel(0, -50);
  const stopped = await scrollSettled(page);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(stopped).toBeLessThan(max - 300); // it did not carry on to the target
  // and it stays stopped: a further quiet window moves nothing
  expect(await scrollSettled(page, { samples: 8 })).toBe(stopped);
});

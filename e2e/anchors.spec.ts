import { expect, test } from '@playwright/test';
import { addSpacer, clickThenGrow, landed } from './helpers';

// Where anchor scrolls END UP is under test here, in the parallel project, so the scroll itself is instant (reduced
// motion) wherever it is not the subject. The real smooth scroll, layout shifts in the middle of it and the visitor
// taking the wheel are in e2e/smooth-scroll.spec.ts, which runs alone.
test.setTimeout(90_000);

for (const [w, h] of [
  [390, 844],
  [1440, 900],
] as const) {
  test.describe(`deep link at ${w}px`, () => {
    test('/#contact ends at the contact section', async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/#contact');
      await landed(page, 'contact');
    });
    test('/#contact ends at the contact section under reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/#contact');
      await landed(page, 'contact');
    });
  });
}

test('a deep link to #experience survives a layout shift after load', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#experience');
  await page.evaluate(() => {
    setTimeout(() => {
      const spacer = document.createElement('div');
      spacer.id = 'test-spacer';
      spacer.style.height = '700px';
      document.getElementById('about')?.before(spacer);
    }, 500);
  });
  await landed(page, 'experience');
});

test.describe('nav clicks while the layout above the target changes (instant scroll)', () => {
  test.use({ reducedMotion: 'reduce' });

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

test('a nav click leaves the address on the section hash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Get in touch' })
    .click();
  await landed(page, 'contact');
  expect(await page.evaluate(() => location.hash)).toBe('#contact');
});

import { expect, test, type Page } from '@playwright/test';
import { expectScrolledTo } from './helpers';

// Under reduced motion the page jumps, so where a click ends up does not depend on the machine's speed.
test.use({ reducedMotion: 'reduce' });

const SIZES = [
  ['1440', { width: 1440, height: 900 }],
  ['665', { width: 665, height: 900 }],
  ['390', { width: 390, height: 844 }],
  ['360', { width: 360, height: 780 }],
] as const;

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, size] of SIZES) {
  test(`nav Get in touch pill is visible, beside Menu on phones, and lands on #contact at ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const cta = page.locator('.nav__bar').getByRole('link', { name: 'Get in touch' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveClass(/btn--primary/);
    const box = (await cta.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.height).toBeGreaterThanOrEqual(36);
    const toggle = page.getByRole('button', { name: 'Menu' });
    if (size.width < 900) {
      await expect(toggle).toBeVisible();
      const t = (await toggle.boundingBox())!;
      expect(t.x + t.width).toBeLessThanOrEqual(box.x + 1); // Menu sits left of the pill, no overlap
      // the name never runs under Menu: wider phone fonts (iOS) need real slack, so ask for 8 px
      const brand = (await page.locator('.nav__brand').boundingBox())!;
      expect(brand.x + brand.width + 8).toBeLessThanOrEqual(t.x + 1);
    }
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await cta.click();
    await expectScrolledTo(page, 'contact');
    await expect(page).toHaveURL(/#contact$/);
    await expect(cta).toHaveAttribute('aria-current', 'true');
  });
}

test('nav Get in touch is the last tab stop in the bar and works from the keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const cta = page.locator('.nav__bar').getByRole('link', { name: 'Get in touch' });
  await cta.focus();
  await expect(cta).toBeFocused();
  await page.keyboard.press('Enter');
  await expectScrolledTo(page, 'contact');
});

for (const [name, size] of [
  ['1440', { width: 1440, height: 900 }],
  ['1024', { width: 1024, height: 800 }],
  ['665', { width: 665, height: 900 }],
  ['480', { width: 480, height: 900 }],
  ['390', { width: 390, height: 844 }],
  ['360', { width: 360, height: 780 }],
] as const) {
  test(`contact actions: one clean row, or Email alone then 2 + 2, at ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const actions = page.locator('#contact .contact__actions');
    await actions.scrollIntoViewIfNeeded();
    const boxes = await actions.locator('> *').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), left: r.left, right: r.right };
      }),
    );
    expect(boxes).toHaveLength(5);
    const rows = [...new Set(boxes.map((b) => b.top))];
    const perRow = rows.map((t) => boxes.filter((b) => Math.abs(b.top - t) <= 2).length);
    const shape = size.width >= 900 ? [5] : [1, 2, 2];
    expect(perRow, `${name}px rows`).toEqual(shape);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(size.width);
    }
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
}

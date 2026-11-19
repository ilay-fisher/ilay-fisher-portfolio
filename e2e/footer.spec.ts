import { expect, test, type Page } from '@playwright/test';

/** The three footer keys, after the footer has scrolled into view and its entrance has finished. */
async function keys(page: Page) {
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  const list = footer.getByRole('list', { name: 'Elsewhere' });
  await expect(list).toHaveAttribute('data-reveal-ready', 'true');
  const links = list.getByRole('link');
  await expect(links).toHaveCount(3);
  // the staggered entrance ends with every key fully opaque
  await expect
    .poll(() =>
      links.evaluateAll((els) =>
        els.every((a) => getComputedStyle(a.parentElement!).opacity === '1'),
      ),
    )
    .toBe(true);
  return { footer, links };
}

for (const [name, size] of [
  ['1440', { width: 1440, height: 900 }],
  ['390', { width: 390, height: 844 }],
] as const) {
  test(`footer keys: visible, correct, 44px hit areas, no horizontal scroll at ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const { footer, links } = await keys(page);
    await expect(links.nth(0)).toHaveAttribute('href', /linkedin\.com\/in\//);
    await expect(links.nth(1)).toHaveAttribute('href', /github\.com\//);
    await expect(links.nth(2)).toHaveAttribute('href', /^mailto:.+@.+/);
    for (const i of [0, 1]) {
      await expect(links.nth(i)).toHaveAttribute('target', '_blank');
      await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
    }
    for (let i = 0; i < 3; i++) {
      const a = links.nth(i);
      await expect(a).toBeVisible();
      await expect(a.locator('svg[aria-hidden="true"]')).toBeVisible();
      const box = (await a.boundingBox())!;
      expect(box.height, `key ${i} height`).toBeGreaterThanOrEqual(44);
      expect(box.width, `key ${i} width`).toBeGreaterThanOrEqual(44);
      expect(box.x, `key ${i} left`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `key ${i} right`).toBeLessThanOrEqual(size.width);
    }
    await expect(footer).toContainText("You reached the bottom. Nothing broke. That's the point.");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('footer keys: hovering lifts the key (transform changes), pressing squashes it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const { links } = await keys(page);
  const key = links.nth(1);
  const transform = () => key.evaluate((a) => getComputedStyle(a).transform);
  expect(await transform()).toBe('none');
  await key.hover();
  await expect.poll(transform).not.toBe('none');
  const lifted = await transform();
  await page.mouse.down();
  await expect.poll(transform).not.toBe(lifted);
  await page.mouse.up();
});

test('footer keys: reduced motion leaves every key still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const { links } = await keys(page);
  const key = links.nth(0);
  await key.hover();
  await page.mouse.down();
  await expect(key).toBeVisible();
  const moved = await key.evaluate((a) => {
    const cs = getComputedStyle(a);
    const icon = getComputedStyle(a.querySelector('svg')!);
    return [cs.transform, cs.translate, icon.transform];
  });
  await page.mouse.up();
  expect(moved).toEqual(['none', 'none', 'none']);
});

test('footer keys: keyboard focus shows a visible ring', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const { links } = await keys(page);
  await links.nth(0).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(links.nth(0)).toBeFocused();
  const ring = await links.nth(0).evaluate((a) => {
    const cs = getComputedStyle(a);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThanOrEqual(2);
});

test('footer email key: the envelope keeps its flap while hovered (no flap flip)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const { links } = await keys(page);
  const key = links.nth(2);
  await key.hover();
  await expect
    .poll(() => key.evaluate((a) => getComputedStyle(a.querySelector('svg')!).transform))
    .not.toBe('none');
  const flap = await key.evaluate(
    (a) => getComputedStyle(a.querySelector('.link-key__flap')!).transform,
  );
  expect(flap).toBe('none');
});

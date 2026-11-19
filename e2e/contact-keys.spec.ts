import { expect, test, type Page } from '@playwright/test';

/** The two Contact keys, once the section is in view. */
async function keys(page: Page) {
  const contact = page.locator('#contact');
  await contact.scrollIntoViewIfNeeded();
  const links = contact.locator('a.link-key');
  await expect(links).toHaveCount(2);
  return { contact, links };
}

for (const [name, size] of [
  ['1440', { width: 1440, height: 900 }],
  ['390', { width: 390, height: 844 }],
] as const) {
  test(`contact keys: visible, correct hrefs, 44px hit areas, aligned with the buttons at ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const { contact, links } = await keys(page);
    await expect(links.nth(0)).toHaveAttribute('href', /linkedin\.com\/in\//);
    await expect(links.nth(1)).toHaveAttribute('href', /github\.com\//);
    for (let i = 0; i < 2; i++) {
      const a = links.nth(i);
      await expect(a).toBeVisible();
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(a.locator('svg[aria-hidden="true"]')).toBeVisible();
      const box = (await a.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    const mail = (await contact.getByRole('link', { name: /Email Ilay/ }).boundingBox())!;
    const copy = (await contact.getByRole('button', { name: /Copy email/ }).boundingBox())!;
    const k = (await links.nth(0).boundingBox())!;
    // the keys share the button height so every control in the panel reads as one family
    expect(Math.abs(k.height - mail.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(copy.height - mail.height)).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('contact keys: hover lifts the key and moves the icon (motion on)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const { links } = await keys(page);
  const key = links.nth(1);
  const transform = () => key.evaluate((a) => getComputedStyle(a).transform);
  const icon = () => key.evaluate((a) => getComputedStyle(a.querySelector('svg')!).transform);
  expect(await transform()).toBe('none');
  await key.hover();
  await expect.poll(transform).not.toBe('none');
  await expect.poll(icon).not.toBe('none');
});

test('contact keys: reduced motion leaves them still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const { links } = await keys(page);
  const key = links.nth(0);
  await key.hover();
  await page.mouse.down();
  const state = await key.evaluate((a) => {
    const cs = getComputedStyle(a);
    return [cs.transform, cs.translate, getComputedStyle(a.querySelector('svg')!).transform];
  });
  await page.mouse.up();
  expect(state).toEqual(['none', 'none', 'none']);
});

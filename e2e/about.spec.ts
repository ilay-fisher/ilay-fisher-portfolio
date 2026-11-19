import { expect, test, type Page } from '@playwright/test';
import { expectScrolledTo, expectSkipLinkFirstTab } from './helpers';

const SECTIONS = [
  ['about', 'About'],
  ['experience', 'Experience'],
  ['contact', 'Get in touch'],
] as const;

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('about, experience and contact are visible with their headings', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto('/');
  for (const [id] of SECTIONS) {
    const section = page.locator(`#${id}`);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('heading', { level: 2 })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test.describe('under reduced motion (instant jumps, so nothing animates under test)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nav highlights the section in view while scrolling', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    for (const [id, label] of SECTIONS) {
      await page.evaluate((target) => {
        const el = document.getElementById(target);
        if (el) window.scrollTo({ top: el.offsetTop + 200, behavior: 'instant' });
      }, id);
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'true');
      await expect(nav.locator('[aria-current]')).toHaveCount(1);
    }
  });
});

test('scroll-progress hairline follows the scroll position', async ({ page }) => {
  await page.goto('/');
  const read = () =>
    page.locator('.nav__progress').evaluate((el) => el.getAttribute('data-progress'));
  expect(Number(await read())).toBeLessThan(0.05);
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  );
  await expect.poll(async () => Number(await read())).toBeGreaterThan(0.95);
});

test.describe('mobile nav at 390x844', () => {
  test.use({ reducedMotion: 'reduce' });

  test('mobile nav reaches every section at 390x844 with keyboard and Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await expect(toggle).toBeVisible();
    const items = ['AI', 'About', 'SafeSurf', 'X-Ray', 'Drone', 'Experience', 'Get in touch'];
    for (const label of items) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const link = page
        .getByRole('navigation', { name: 'Sections' })
        .getByRole('link', { name: label });
      await expect(link).toBeVisible();
      await link.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const id =
        label === 'X-Ray' ? 'xray' : label === 'Get in touch' ? 'contact' : label.toLowerCase();
      await expectScrolledTo(page, id);
    }
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });
});

test('skip link still works', async ({ page }) => {
  await page.goto('/');
  await expectSkipLinkFirstTab(page);
});

for (const size of [
  { width: 360, height: 740 },
  { width: 1440, height: 900 },
]) {
  test(`no horizontal scroll at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    for (const [id] of SECTIONS) await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('contact: mailto, secondary links and copy-email confirmation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const contact = page.locator('#contact');
  await contact.scrollIntoViewIfNeeded();
  await expect(contact.getByRole('link', { name: /Email/ })).toHaveAttribute('href', /^mailto:/);
  // A click that lands before hydration is a no-op; click again until the confirmation shows.
  await expect(async () => {
    await contact.getByRole('button', { name: /Copy email/ }).click();
    await expect(contact.getByRole('status')).toHaveText('Email copied.', { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ilay3002@gmail.com');
});

test('portrait loads with real dimensions and falls back to a monogram on failure', async ({
  page,
}) => {
  await page.goto('/');
  const img = page.locator('#about .avatar__stage img');
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(512);
  await page.route('**/images/avatar/turn/still.webp', (r) => r.abort());
  await page.reload();
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator('#about').getByRole('img', { name: /Ilay Fisher/ })).toContainText(
    'IF',
  );
});

test('structure: heading order, landmarks and accessible names', async ({ page }) => {
  await page.goto('/');
  const levels = await page.$$eval('h1,h2,h3,h4', (hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i]! - levels[i - 1]!, `heading jump at index ${i}`).toBeLessThanOrEqual(1);
  }
  await expect(page.locator('header')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('footer')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(1);
  const unnamed = await page.$$eval('a, button', (els) =>
    els
      .filter((e) => !(e.textContent ?? '').trim() && !e.getAttribute('aria-label'))
      .map((e) => e.outerHTML.slice(0, 80)),
  );
  expect(unnamed).toEqual([]);
  const noAlt = await page.$$eval('img:not([alt])', (els) => els.length);
  expect(noAlt).toBe(0);
  const badBlank = await page.$$eval(
    'a[target="_blank"]',
    (els) => els.filter((a) => !/noopener/.test(a.getAttribute('rel') ?? '')).length,
  );
  expect(badBlank).toBe(0);
});

test('reduced motion shows final bench readings', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#experience').scrollIntoViewIfNeeded();
  const texts = await page.$$eval('#experience [data-count]', (els) =>
    els.map((e) => e.textContent),
  );
  expect(texts).toEqual(expect.arrayContaining(['14.2%', '22+']));
});

import { expect, test } from '@playwright/test';
import { scrollSettled } from './helpers';

const PAGES = [
  { id: 'safesurf', h1: /SafeSurf/ },
  { id: 'drone', h1: /Obstacle-Avoidance/ },
  { id: 'xray', h1: /X-Ray Lens/ },
] as const;

test.use({ reducedMotion: 'reduce' });

for (const p of PAGES) {
  test(`the ${p.id} key on the home page opens its detail page in the same tab`, async ({
    page,
  }) => {
    await page.goto('/');
    const key = page.locator(`#${p.id}`).getByRole('link', { name: /read the case study/i });
    await expect(key).toHaveAttribute('href', `/work/${p.id}`);
    await key.click();
    await expect(page).toHaveURL(new RegExp(`/work/${p.id}$`));
    await expect(page.locator('h1')).toHaveText(p.h1);
    await expect(page).toHaveTitle(p.h1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test(`/work/${p.id} loads directly, survives a refresh and goes back to its section`, async ({
    page,
  }) => {
    await page.goto(`/work/${p.id}`);
    await expect(page.locator('h1')).toHaveText(p.h1);
    await page.reload();
    await expect(page.locator('h1')).toHaveText(p.h1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
    await page.getByRole('link', { name: /back to overview/i }).click();
    await expect(page).toHaveURL(new RegExp(`/#${p.id}$`));
    await expect(page.locator(`#${p.id}`)).toBeVisible();
    await scrollSettled(page);
    const top = await page.evaluate(
      (id) => document.getElementById(id)!.getBoundingClientRect().top,
      p.id,
    );
    expect(Math.abs(top)).toBeLessThan(200);
  });
}

test('next and previous project links walk through the three pages', async ({ page }) => {
  await page.goto('/work/safesurf');
  await page.getByRole('link', { name: /next project/i }).click();
  await expect(page).toHaveURL(/\/work\/drone$/);
  await page.getByRole('link', { name: /next project/i }).click();
  await expect(page).toHaveURL(/\/work\/xray$/);
  await page.getByRole('link', { name: /previous project/i }).click();
  await expect(page).toHaveURL(/\/work\/drone$/);
});

test('the key is a real link: it opens in a new tab on a modified click', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const key = page.locator('#drone').getByRole('link', { name: /read the case study/i });
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    key.click({ modifiers: ['ControlOrMeta'] }),
  ]);
  await popup.waitForLoadState();
  expect(new URL(popup.url()).pathname).toBe('/work/drone');
  await expect(page).toHaveURL(/\/$/);
});

test('an unknown /work slug shows a not-found page with a link home', async ({ page }) => {
  await page.goto('/work/nope');
  await expect(page.locator('h1')).toHaveText(/not found/i);
  await page.getByRole('link', { name: /back to home/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#top')).toBeVisible();
});

test('the nav on a detail page leads to the home page sections', async ({ page }) => {
  await page.goto('/work/drone');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Contact' })
    .click();
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(page.locator('#contact')).toBeVisible();
});

for (const p of PAGES) {
  test(`no horizontal scroll on /work/${p.id} at 360 and 1440`, async ({ page }) => {
    for (const size of [
      { width: 360, height: 740 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(`/work/${p.id}`);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${p.id} at ${size.width}`).toBeLessThanOrEqual(0);
    }
  });
}

test.describe('entrance with motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('the page content arrives and ends fully visible', async ({ page }) => {
    await page.goto('/work/drone');
    const intro = page.getByTestId('case-intro');
    await expect
      .poll(() => intro.evaluate((e) => getComputedStyle(e).opacity), { timeout: 5000 })
      .toBe('1');
  });
});

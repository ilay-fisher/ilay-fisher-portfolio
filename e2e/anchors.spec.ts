import { expect, test, type Page } from '@playwright/test';

// The page runs a software-GL scene, so scrolling and layout are slow.
test.setTimeout(90_000);

/** How far the section's top is from where the sticky nav leaves it, or 0 when the page simply cannot scroll further. */
async function miss(page: Page, id: string): Promise<number> {
  return page.evaluate((sid) => {
    const el = document.getElementById(sid)!;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const off = el.getBoundingClientRect().top - pad;
    const atEnd = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2;
    return atEnd && off > 0 ? 0 : off;
  }, id);
}

async function landed(page: Page, id: string) {
  await expect
    .poll(async () => Math.abs(await miss(page, id)), { timeout: 15_000 })
    .toBeLessThan(6);
  // and it stays there: nothing drifts after it settled
  await page.waitForTimeout(900);
  expect(Math.abs(await miss(page, id))).toBeLessThan(6);
}

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

test.describe('nav clicks while the layout above the target changes mid-scroll', () => {
  test('at 1440 (desktop nav)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      const s = document.createElement('div');
      s.id = 'test-spacer';
      s.style.height = '0px';
      document.getElementById('experience')?.before(s);
    });
    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name: 'Contact' })
      .click();
    await page.waitForTimeout(250);
    await page.evaluate(() => (document.getElementById('test-spacer')!.style.height = '900px'));
    await landed(page, 'contact');
  });

  test('at 390 (menu)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      const s = document.createElement('div');
      s.id = 'test-spacer';
      s.style.height = '0px';
      document.getElementById('experience')?.before(s);
    });
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name: 'Experience' })
      .click();
    await page.waitForTimeout(250);
    await page.evaluate(() => (document.getElementById('test-spacer')!.style.height = '-0px'));
    await page.evaluate(() => {
      document.getElementById('test-spacer')!.style.height = '700px';
    });
    await landed(page, 'experience');
  });
});

test('any wheel input cancels a tracked scroll (the visitor wins)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Contact' })
    .click();
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, -50);
  await page.waitForTimeout(600);
  const a = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1500);
  const b = await page.evaluate(() => window.scrollY);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(Math.abs(b - a)).toBeLessThan(8); // it stopped
  expect(b).toBeLessThan(max - 300); // and it did not carry on to the target
});

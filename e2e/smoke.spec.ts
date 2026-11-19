import { expect, test, type Page } from '@playwright/test';
import { expectScrolledTo, expectSkipLinkFirstTab } from './helpers';

const IDS = ['top', 'about', 'safesurf', 'drone', 'xray', 'experience', 'contact'];

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('loads with no console errors and has all sections in order', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  const ids = await page.$$eval('main > section', (els) => els.map((e) => e.id));
  expect(ids).toEqual(IDS);
  expect(errors).toEqual([]);
});

test('title and description are set', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ilay Fisher/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /hold up/);
});

// Where a nav click ends up is under test here, not the smooth scroll itself (that is e2e/smooth-scroll.spec.ts, in
// the serial project): under reduced motion the page jumps, so the end state is the same on any machine.
test.describe('nav links land on their section', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const [label, id] of [
    ['About', 'about'],
    ['SafeSurf', 'safesurf'],
    ['Drone', 'drone'],
    ['X-Ray', 'xray'],
    ['Experience', 'experience'],
    ['Contact', 'contact'],
  ] as const) {
    test(`nav link "${label}" scrolls to #${id}`, async ({ page }) => {
      await page.goto('/');
      await page
        .getByRole('navigation', { name: 'Sections' })
        .getByRole('link', { name: label })
        .click();
      // The last section may be unable to reach the top of the viewport; then the page is at its end.
      await expectScrolledTo(page, id);
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
    });
  }
});

test('skip link is first in tab order and targets main', async ({ page }) => {
  await page.goto('/');
  await expectSkipLinkFirstTab(page);
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toHaveAttribute('href', '#main');
});

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
  { width: 360, height: 740 },
]) {
  test(`no horizontal scroll at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('reduced motion still renders everything', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  for (const id of IDS) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  for (const t of ['hero-canvas', 'safesurf-demo', 'drone-demo', 'xray-demo']) {
    await expect(page.getByTestId(t)).toBeVisible();
  }
  const hidden = await page.$$eval(
    '[data-reveal]',
    (els) => els.filter((e) => getComputedStyle(e).opacity === '0').length,
  );
  expect(hidden).toBe(0);
  expect(errors).toEqual([]);
});

test('self-hosted fonts load and nothing is requested from other origins', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http'))
      external.push(r.url());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() =>
    document.fonts.check('800 20px "Bricolage Grotesque Variable"'),
  );
  expect(ok).toBe(true);
  expect(external).toEqual([]);
});

test('WebGL2 is available in this browser', async ({ page }) => {
  await page.goto('/');
  const ok = await page.evaluate(() =>
    Boolean(document.createElement('canvas').getContext('webgl2')),
  );
  expect(ok).toBe(true);
});

/**
 * Regression: with motion on, every `[data-reveal]` must end fully visible once scrolled in. A reveal that animates the
 * element itself (`fade`, `up`) once recorded the CSS pre-hide (opacity 0) as its end value and stayed invisible in the
 * production build; React StrictMode's second effect run hid it in the dev server, so only a preview-build run sees it.
 */
test('every reveal ends visible after scrolling in (motion on)', async ({ page }) => {
  // One page of reveals, each given time to finish on a loaded runner (a spring tween can crawl under software GL).
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const total = await page.locator('[data-reveal]').count();
  expect(total, 'the page has reveals').toBeGreaterThan(0);

  for (let i = 0; i < total; i++) {
    const el = page.locator('[data-reveal]').nth(i);
    const label = await el.evaluate(
      (e) => `${e.getAttribute('data-reveal')} ${e.className || e.tagName.toLowerCase()}`,
    );
    // Scroll again on every poll: a reveal only plays while its trigger is actually reached, and layout can still shift
    // while fonts and images load.
    await expect
      .poll(
        () =>
          el.evaluate((e) => {
            e.scrollIntoView({ block: 'center', behavior: 'instant' });
            const ops = [e, ...Array.from(e.children)].map((n) => getComputedStyle(n).opacity);
            return ops.every((o) => o === '1')
              ? 'ok'
              : `opacities ${ops.join(',')} top ${Math.round(e.getBoundingClientRect().top)} scrollY ${Math.round(scrollY)} pageH ${document.documentElement.scrollHeight}`;
          }),
        { message: `reveal #${i} (${label}) ends fully opaque`, timeout: 45_000 },
      )
      .toBe('ok');
  }

  // The thing the bug hid: the About portrait is really visible, not just rendered into an invisible wrapper.
  const stage = page.locator('#about .avatar__stage');
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toBeVisible();
  await expect
    .poll(() =>
      stage.evaluate(
        (e) =>
          e.closest<HTMLElement>('[data-reveal]') &&
          getComputedStyle(e.closest('[data-reveal]')!).opacity,
      ),
    )
    .toBe('1');
});

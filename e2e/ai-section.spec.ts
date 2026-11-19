import { expect, test } from '@playwright/test';

// The AI and agent workflows section (owner brief 2026-11-19): presence and place, the project order, the nav order
// and the meta tags. Reduced motion keeps every reveal in its finished state, so visibility is not timing-dependent.
test.use({ reducedMotion: 'reduce' });

test('the AI section sits right after the hero with four cards', async ({ page }) => {
  await page.goto('/');
  const ids = await page.$$eval('main > section', (els) => els.map((e) => e.id));
  expect(ids.slice(0, 3)).toEqual(['top', 'ai', 'about']);
  const section = page.locator('#ai');
  await expect(
    section.getByRole('heading', { level: 2, name: 'AI and agent workflows' }),
  ).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(4);
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText([
    'Release-manager agent',
    'Custom skills',
    'Manager and subagent orchestration',
    'Content plugin',
  ]);
  await expect(section.getByText('637-line release script')).toBeVisible();
  await expect(section.getByText('verify-avd')).toBeVisible();
  // the agent tooling has no public repo, so no card is a link
  await expect(cards.locator('a')).toHaveCount(0);
});

test('the projects run SafeSurf, X-Ray Lens, Drone', async ({ page }) => {
  await page.goto('/');
  const ids = await page.$$eval('main > section.project', (els) => els.map((e) => e.id));
  expect(ids).toEqual(['safesurf', 'xray', 'drone']);
  const cases = await page.$$eval('section.project [data-testid="bench-label"]', (els) =>
    els.map((e) => /CASE-\d+/.exec(e.textContent ?? '')?.[0]),
  );
  expect(cases).toEqual(['CASE-01', 'CASE-02', 'CASE-03']);
});

test('the nav lists AI, About, SafeSurf, X-Ray, Drone, Experience', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.locator('#nav-links a')).toHaveText([
    'AI',
    'About',
    'SafeSurf',
    'X-Ray',
    'Drone',
    'Experience',
  ]);
});

test('the AI nav link lands on the section', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'AI' })
    .click();
  await expect(page).toHaveURL(/#ai$/);
  await expect
    .poll(() =>
      page.evaluate(() => Math.abs(document.getElementById('ai')!.getBoundingClientRect().top)),
    )
    .toBeLessThan(160);
});

test('the case pages walk in the new order', async ({ page }) => {
  await page.goto('/work/drone');
  await expect(page.getByRole('link', { name: /next project/i })).toHaveAttribute(
    'href',
    '/work/safesurf',
  );
  await expect(page.getByRole('link', { name: /previous project/i })).toHaveAttribute(
    'href',
    '/work/xray',
  );
  await page.goto('/work/xray');
  await expect(page.getByRole('link', { name: /previous project/i })).toHaveAttribute(
    'href',
    '/work/safesurf',
  );
  await expect(page.getByRole('link', { name: /next project/i })).toHaveAttribute(
    'href',
    '/work/drone',
  );
});

test('the X-Ray and SafeSurf numbers are on the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#xray')).toContainText('2,460');
  await expect(page.locator('#xray')).toContainText('117-121');
  await expect(page.locator('#xray')).toContainText('17,838 ms to 10,034 ms');
  await expect(page.locator('#safesurf')).toContainText('36.6%');
  await expect(page.locator('#safesurf')).toContainText('7.6 ms');
});

test('title, description and Open Graph tags name AI agents and LLM', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AI agents/i);
  const meta = (sel: string) => page.locator(sel).getAttribute('content');
  for (const sel of ['meta[name="description"]', 'meta[property="og:description"]']) {
    const c = (await meta(sel))!;
    expect(c).toMatch(/AI agents/);
    expect(c).toMatch(/\bLLM\b/);
    for (const w of ['Backend', 'Android', 'Systems']) expect(c).toContain(w);
  }
  expect(await meta('meta[property="og:title"]')).toMatch(/AI agents/i);
});

for (const width of [360, 390, 665, 1024, 1440]) {
  test(`the AI section does not scroll sideways at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.locator('#ai').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const cards = await page.locator('#ai article').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return r.left >= 0 && r.right <= document.documentElement.clientWidth;
      }),
    );
    expect(cards).toEqual([true, true, true, true]);
  });
}

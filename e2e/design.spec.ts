import { expect, test } from '@playwright/test';

const radius = (selector: string) =>
  `parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(selector)})).borderTopLeftRadius)`;

test.describe('design v2: nothing is a sharp rectangle', () => {
  test('buttons, tags and stage all have a radius', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.btn');
    for (const selector of ['.btn', '.tag', '.stage', '.nav__bar']) {
      const r = await page.evaluate(radius(selector));
      expect(r, `${selector} radius`).toBeGreaterThan(0);
    }
  });

  test('the avatar is frameless: no ancestor draws a border, outline or circular clip', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('#about').scrollIntoViewIfNeeded();
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      let el: Element | null = document.querySelector('#about .avatar__frames');
      while (el && el !== document.body) {
        const c = getComputedStyle(el);
        const tag = `${el.tagName.toLowerCase()}.${String(el.className)}`;
        for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
          const w = parseFloat(c[`border${side}Width` as 'borderTopWidth']);
          if (w > 0 && c[`border${side}Style` as 'borderTopStyle'] !== 'none')
            bad.push(`${tag} border-${side}`);
        }
        if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) bad.push(`${tag} outline`);
        if (parseFloat(c.borderTopLeftRadius) > 0 && c.overflow !== 'visible')
          bad.push(`${tag} rounded clip`);
        for (const prop of [c.clipPath, c.maskImage, c.webkitMaskImage]) {
          if (prop && prop !== 'none' && /circle|ellipse|50%/.test(prop))
            bad.push(`${tag} ${prop}`);
        }
        if (
          /inset|ring/.test(c.boxShadow) &&
          c.boxShadow !== 'none' &&
          el.className.toString().includes('avatar')
        )
          bad.push(`${tag} box-shadow`);
        el = el.parentElement;
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test('no console errors while scrolling the whole page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    for (const id of ['about', 'safesurf', 'drone', 'xray', 'experience', 'contact']) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
      await page.waitForTimeout(150);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('design v2: no horizontal scroll', () => {
  const sizes: Array<[number, number]> = [
    [360, 740],
    [390, 844],
    [1440, 900],
  ];
  for (const [w, h] of sizes) {
    test(`at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await page.waitForTimeout(500);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw).toBeLessThanOrEqual(w);
    });
  }
});

test.describe('design v2: cursor', () => {
  test('appears with a fine pointer after the first mouse move and never blocks clicks', async ({
    page,
  }) => {
    await page.goto('/');
    const cursor = page.getByTestId('cursor');
    await expect(cursor).toBeAttached();
    await expect(page.locator('html')).not.toHaveClass(/has-cursor/);
    await page.mouse.move(400, 400);
    await page.mouse.move(420, 410);
    await expect(page.locator('html')).toHaveClass(/has-cursor/);
    await expect(cursor).toHaveAttribute('data-visible', 'true');
    expect(await cursor.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    // hugging a control: hover the first nav link
    const link = page.locator('.nav__links a').first();
    await link.hover();
    await expect(cursor).toHaveAttribute('data-mode', 'hug');
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    test('is absent on touch devices', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('cursor')).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveClass(/has-cursor/);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('is absent under reduced motion and content is visible', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('cursor')).toHaveCount(0);
      await expect(page.getByTestId('grain')).toHaveAttribute('data-moving', 'false');
      await expect(page.getByRole('heading', { level: 2, name: /Built alone/ })).toBeVisible();
    });
  });
});

test.describe('design v2: big figures never overflow their tile', () => {
  for (const w of [360, 390, 768, 1024, 1440]) {
    test(`at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/');
      await page.waitForTimeout(400);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        const pairs: Array<[string, string]> = [
          ['.project__numbers dt', '.project__numbers > div'],
          ['.reading__value', '.reading'],
        ];
        for (const [fig, tile] of pairs) {
          document.querySelectorAll<HTMLElement>(fig).forEach((el) => {
            const box = tile && el.closest(tile)?.getBoundingClientRect();
            if (!box) return;
            // measure the visible text runs themselves (not the hidden spoken copy), so a wide glyph run is caught
            const runs = Array.from(el.childNodes).filter(
              (n) => !(n instanceof HTMLElement && n.classList.contains('visually-hidden')),
            );
            for (const n of runs) {
              const r = document.createRange();
              r.selectNodeContents(n);
              const t = r.getBoundingClientRect();
              if (t.width > 0 && (t.right > box.right + 0.5 || t.left < box.left - 0.5))
                out.push(
                  `${fig} "${n.textContent}" ${t.left.toFixed(1)}-${t.right.toFixed(1)} vs ${box.left.toFixed(1)}-${box.right.toFixed(1)}`,
                );
            }
          });
        }
        return out;
      });
      expect(bad).toEqual([]);
    });
  }
});

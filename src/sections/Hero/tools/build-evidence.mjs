/* global process, window, document, console */
/**
 * Generates the hero's committed stills and report evidence from the real scene.
 *
 *   npm run dev -- --port 5189   (in another shell)
 *   node src/sections/Hero/tools/build-evidence.mjs
 *
 * Writes public/hero/still-{desktop,mobile}.webp (the tablet viewport only gets report images) (transparent, text hidden),
 * docs/reports/img/hero-*.png, docs/reports/video/hero.webm and prints frame times.
 * Uses the machine GPU (ANGLE Metal) so frame times are real, not software GL.
 * Needs: @playwright/test, cwebp, python3 with Pillow (contact sheets).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.HERO_URL ?? 'http://localhost:5189';
const OUT_IMG = 'docs/reports/img';
const OUT_VIDEO = 'docs/reports/video';
const OUT_STILL = 'public/hero';
const TMP = process.env.HERO_TMP ?? '/tmp/hero-evidence';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const SEED = 7;

for (const d of [OUT_IMG, OUT_VIDEO, OUT_STILL, TMP]) mkdirSync(d, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });

/** `fast` pre-settles the physics (stills); the drop, throw frames, stats and video run the live drop. */
const open = async (ctx, fast = false) => {
  const url = `${BASE}/?heroSeed=${SEED}${fast ? '&heroFast=1' : ''}`;
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('[data-testid=hero-canvas][data-ready=true]', { timeout: 60000 });
  return page;
};
const settle = (page) =>
  page.waitForSelector('[data-sleeping=true]', { timeout: 60000, state: 'attached' });

/** Throw the highest resting body in a lob towards the name, so the arc and the hit are visible. */
const throwAtName = (page) =>
  page.evaluate(() => {
    const h = window.__hero;
    const b = h.bounds();
    const from = h.snapshot().reduce((a, s) => (s.pos.y > a.pos.y ? s : a));
    const tx = (b.minX + b.maxX) / 2;
    const dx = tx - from.pos.x;
    const dz = b.minZ - from.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    h.throwBody(from.id, { x: (dx / len) * 12, y: 9, z: (dz / len) * 12 });
  });

const frames = async (page, clip, prefix, n = 8, gapMs = 100) => {
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const due = t0 + i * gapMs;
    const wait = due - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: join(TMP, `${prefix}-${i}.png`), clip });
  }
};

const sheet = (prefix, out, cols = 4) =>
  execFileSync('python3', [
    '-c',
    `
import sys
from PIL import Image
prefix,out,cols=sys.argv[1],sys.argv[2],int(sys.argv[3])
fr=[Image.open(f"${TMP}/{prefix}-{i}.png").convert("RGB") for i in range(8)]
w,h=fr[0].size
s=0.5
tw,th=int(w*s),int(h*s)
rows=(len(fr)+cols-1)//cols
img=Image.new("RGB",(tw*cols,th*rows),(10,12,15))
for i,f in enumerate(fr):
    img.paste(f.resize((tw,th),Image.LANCZOS),((i%cols)*tw,(i//cols)*th))
img.save(out)
`,
    prefix,
    out,
    String(cols),
  ]);

// 1. Settled, mid-throw, fallback, transparent stills.
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await open(ctx, true);
  await settle(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT_IMG}/hero-${vp.name}-settled.png` });

  // Transparent still: only the canvas, page background cleared.
  await page.addStyleTag({
    content: `html,body,#root,.hero,.hero__stage{background:transparent !important}
      body::before,body::after,.hero::before,.hero::after,.hero__stage::before,.hero__stage::after{display:none !important}
      body *{visibility:hidden !important} canvas.hero__canvas{visibility:visible !important}`,
  });
  const png = join(TMP, `still-${vp.name}.png`);
  await page.locator('canvas.hero__canvas').screenshot({ path: png, omitBackground: true });
  if (vp.name !== 'tablet')
    execFileSync(
      'cwebp',
      ['-q', '84', '-alpha_q', '92', '-m', '6', png, '-o', `${OUT_STILL}/still-${vp.name}.webp`],
      {
        stdio: 'ignore',
      },
    );
  await ctx.close();

  // Mid-throw.
  const ctx2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const p2 = await open(ctx2, true);
  await settle(p2);
  await throwAtName(p2);
  await p2.waitForTimeout(260);
  await p2.screenshot({ path: `${OUT_IMG}/hero-${vp.name}-throw.png` });
  await ctx2.close();

  // Fallback (reduced motion shows the committed still).
  const ctx3 = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'reduce',
  });
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/`);
  await p3.waitForSelector('img.hero__still', { state: 'visible' });
  await p3.waitForFunction(() => document.querySelector('img.hero__still')?.complete);
  await p3.waitForTimeout(300);
  await p3.screenshot({ path: `${OUT_IMG}/hero-${vp.name}-fallback.png` });
  await ctx3.close();
}

// 2. Contact sheets at 1440x900: the drop (reset) and a throw, 8 frames 100 ms apart.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await open(ctx);
  await settle(page);
  const clip = { x: 520, y: 240, width: 920, height: 600 };
  await page.evaluate(() => window.__hero.reset());
  await frames(page, clip, 'drop');
  sheet('drop', `${OUT_IMG}/hero-frames-drop.png`);
  await settle(page);
  await page.waitForTimeout(300);
  await throwAtName(page);
  await frames(page, clip, 'throw');
  sheet('throw', `${OUT_IMG}/hero-frames-throw.png`);
  await ctx.close();
}

// 3. Frame times at 1440x900 (drop + settle, then a drag/throw burst).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await open(ctx);
  await page.waitForTimeout(4000);
  const idle = await page.evaluate(() => window.__hero.stats());
  await page.evaluate(() => window.__hero.reset());
  await page.waitForTimeout(3000);
  const drop = await page.evaluate(() => window.__hero.stats());
  console.log(JSON.stringify({ frameTimes: { afterSettle: idle, afterDropAgain: drop } }));
  await ctx.close();
}

// 4. Video, about 8 s: drop, hover, drag, throw, reset.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: TMP + '/video', size: { width: 1440, height: 900 } },
  });
  const page = await open(ctx);
  await page.waitForTimeout(2600);
  const pts = await page.evaluate(() => {
    const h = window.__hero;
    return h.ids().map((id) => ({ id, ...h.project(id) }));
  });
  const a = pts[3];
  const b = pts[8];
  await page.mouse.move(a.x, a.y, { steps: 8 });
  await page.waitForTimeout(400);
  await page.mouse.down();
  await page.mouse.move(a.x - 120, a.y - 90, { steps: 14 });
  await page.mouse.move(a.x + 260, a.y - 200, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1100);
  await throwAtName(page);
  await page.waitForTimeout(1400);
  const q = await page.evaluate((id) => window.__hero.project(id), b.id);
  if (q) {
    await page.mouse.move(q.x, q.y, { steps: 6 });
    await page.mouse.down();
    await page.mouse.move(q.x + 200, q.y - 260, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(1200);
  await ctx.close();
  const f = readdirSync(TMP + '/video').find((n) => n.endsWith('.webm'));
  rmSync(`${OUT_VIDEO}/hero.webm`, { force: true });
  renameSync(join(TMP, 'video', f), `${OUT_VIDEO}/hero.webm`);
}

await browser.close();

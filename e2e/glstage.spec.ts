import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';

/** The shape of the bundle's export that this spec uses (the real class is bundled into the page below). */
type StageModule = typeof import('../src/lib/glStage');

/**
 * Bundles `src/lib/glStage.ts` (with ogl) into one IIFE string, in memory. The spec then runs against the production
 * preview server like every other spec: nothing depends on the dev server serving `/src` as modules.
 */
async function bundleGlStage(): Promise<string> {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, '../src/lib/glStage.ts'),
        formats: ['iife'],
        name: 'GlStageBundle',
        fileName: 'glstage',
      },
    },
  });
  const outputs = Array.isArray(out) ? out : [out];
  const chunk = outputs
    .flatMap((o) => ('output' in o ? o.output : []))
    .find((c) => c.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('glStage bundle produced no chunk');
  return chunk.code;
}

// Exercises GlStage against a real WebGL2 context. Every wait is a condition polled inside the page, never a fixed
// sleep, so a starved software-GL runner only makes it slower, not wrong.
test('GlStage runs, pauses on context loss and recovers on restore @gl-heavy', async ({ page }) => {
  const code = await bundleGlStage();
  await page.goto('/');
  await page.addScriptTag({ content: code });
  const result = await page.evaluate(async () => {
    const { GlStage } = (window as unknown as { GlStageBundle: StageModule }).GlStageBundle;
    const until = async (cond: () => boolean, ms = 30_000) => {
      const t0 = performance.now();
      while (!cond()) {
        if (performance.now() - t0 > ms) return false;
        await new Promise((r) => setTimeout(r, 25));
      }
      return true;
    };
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:100px';
    document.body.appendChild(host);
    const events: string[] = [];
    let frames = 0;
    const stage = GlStage.create({
      container: host,
      name: 'e2e',
      onFrame: () => {
        frames += 1;
      },
      onContextLost: () => events.push('lost'),
      onContextRestored: () => events.push('restored'),
    });
    if (!stage) return { ok: false as const };
    stage.start();
    const ranFrames = await until(() => frames > 2);
    const ready = stage.canvas.dataset.ready;
    const isWebgl2 = stage.renderer.isWebgl2;
    const framesBefore = frames;
    const ext = stage.gl.getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    await until(() => stage.status === 'lost');
    const lostStatus = stage.status;
    const probeLost = stage.canvas.dataset.webgl;
    const framesAtLoss = frames;
    // Frames must not advance while the context is lost: give the loop a few of its own ticks to prove it.
    await new Promise((r) => setTimeout(r, 300));
    const noFramesWhileLost = frames === framesAtLoss;
    ext.restoreContext();
    await until(() => stage.status === 'ok' && frames > framesAtLoss);
    const restoredStatus = stage.status;
    const framesAfter = frames;
    stage.dispose();
    return {
      ok: true as const,
      ranFrames,
      ready,
      isWebgl2,
      framesBefore,
      lostStatus,
      probeLost,
      noFramesWhileLost,
      restoredStatus,
      resumed: framesAfter > framesAtLoss,
      events,
    };
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.isWebgl2).toBe(true);
  expect(result.ranFrames).toBe(true);
  expect(result.ready).toBe('true');
  expect(result.framesBefore).toBeGreaterThan(2);
  expect(result.lostStatus).toBe('lost');
  expect(result.probeLost).toBe('lost');
  expect(result.noFramesWhileLost).toBe(true);
  expect(result.restoredStatus).toBe('ok');
  expect(result.resumed).toBe(true);
  expect(result.events).toEqual(['lost', 'restored']);
});

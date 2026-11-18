import { expect, test } from '@playwright/test';

// Exercises GlStage against a real WebGL2 context. Works because the dev server serves /src as modules.
test('GlStage runs, pauses on context loss and recovers on restore', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { GlStage } = await import(/* @vite-ignore */ '/src/lib/glStage.ts');
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
    await new Promise((r) => setTimeout(r, 400));
    const ready = stage.canvas.dataset.ready;
    const isWebgl2 = stage.renderer.isWebgl2;
    const framesBefore = frames;
    const ext = stage.gl.getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 200));
    const lostStatus = stage.status;
    const probeLost = stage.canvas.dataset.webgl;
    const framesAtLoss = frames;
    await new Promise((r) => setTimeout(r, 200));
    const noFramesWhileLost = frames === framesAtLoss;
    ext.restoreContext();
    await new Promise((r) => setTimeout(r, 400));
    const restoredStatus = stage.status;
    const framesAfter = frames;
    stage.dispose();
    return {
      ok: true as const,
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
  expect(result.ready).toBe('true');
  expect(result.framesBefore).toBeGreaterThan(2);
  expect(result.lostStatus).toBe('lost');
  expect(result.probeLost).toBe('lost');
  expect(result.noFramesWhileLost).toBe(true);
  expect(result.restoredStatus).toBe('ok');
  expect(result.resumed).toBe(true);
  expect(result.events).toEqual(['lost', 'restored']);
});

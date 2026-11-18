import { describe, expect, it } from 'vitest';
import { loadGlStage } from './lazyGl';

describe('loadGlStage', () => {
  it('resolves to the stage module and memoises the import', async () => {
    const a = loadGlStage();
    const b = loadGlStage();
    expect(a).toBe(b);
    const mod = await a;
    expect(typeof mod.GlStage.create).toBe('function');
  });
});

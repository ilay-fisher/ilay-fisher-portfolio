import { describe, expect, it } from 'vitest';
import { QualityController, isSoftwareRenderer } from './quality';

const feed = (q: QualityController, ms: number, n: number) => {
  let last = null;
  for (let i = 0; i < n; i++) last = q.record(ms) ?? last;
  return last;
};

describe('adaptive quality', () => {
  it('stays at the top level when frames are fast', () => {
    const q = new QualityController({ window: 30, budgetMs: 20 });
    expect(feed(q, 8, 200)).toBeNull();
    expect(q.level).toBe(0);
  });
  it('steps down once per slow window and never steps back up', () => {
    const q = new QualityController({ window: 30, budgetMs: 20 });
    const first = feed(q, 40, 30);
    expect(first).not.toBeNull();
    expect(q.level).toBe(1);
    expect(feed(q, 40, 29)).toBeNull();
    feed(q, 40, 1);
    expect(q.level).toBe(2);
    feed(q, 5, 300);
    expect(q.level).toBe(2);
  });
  it('bottoms out at the last level with decreasing pixel ratio and shadow size', () => {
    const q = new QualityController({ window: 10, budgetMs: 20 });
    feed(q, 60, 500);
    expect(q.level).toBe(q.maxLevel);
    expect(q.settings.dprScale).toBeLessThan(1);
    expect(q.settings.shadowSize).toBeLessThanOrEqual(1024);
  });
  it('ignores outlier spikes such as a tab return', () => {
    const q = new QualityController({ window: 30, budgetMs: 20 });
    for (let i = 0; i < 29; i++) q.record(8);
    q.record(900);
    expect(q.level).toBe(0);
  });
  it('can start at a given level (clamped to the last one)', () => {
    expect(new QualityController({ startLevel: 2 }).level).toBe(2);
    const q = new QualityController({ startLevel: 99 });
    expect(q.level).toBe(q.maxLevel);
    expect(new QualityController({ startLevel: -3 }).level).toBe(0);
  });
});

describe('isSoftwareRenderer', () => {
  it('recognises software GL names and not real GPUs', () => {
    expect(
      isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)'),
    ).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('Google SwiftShader')).toBe(true);
    expect(
      isSoftwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)'),
    ).toBe(false);
    expect(isSoftwareRenderer('')).toBe(false);
    expect(isSoftwareRenderer(null)).toBe(false);
  });
});

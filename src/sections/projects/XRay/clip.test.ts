import { describe, expect, it } from 'vitest';
import {
  clampPercent,
  handleLeft,
  springStep,
  sliderToClip,
  sliderValueText,
  sweepPath,
  sweepValue,
} from './clip';

describe('slider maths', () => {
  it('clamps and rounds', () => {
    expect(clampPercent(-4)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(50);
    expect(clampPercent(33.6)).toBe(34);
  });
  it('heatmap layer is clipped to the left part', () => {
    expect(sliderToClip(0)).toBe('inset(0 100% 0 0)');
    expect(sliderToClip(60)).toBe('inset(0 40% 0 0)');
    expect(sliderToClip(100)).toBe('inset(0 0% 0 0)');
  });
  it('handle sits at the split', () => {
    expect(handleLeft(25)).toBe('25%');
  });
  it('value text names both sides', () => {
    expect(sliderValueText(0)).toMatch(/only the target/i);
    expect(sliderValueText(100)).toMatch(/only the heatmap/i);
    expect(sliderValueText(60)).toBe('Heatmap on the left 60 percent, target on the right');
  });
  it('sweep goes 50 -> high -> low -> 50 and ends exactly at rest', () => {
    expect(sweepValue(0)).toBe(50);
    expect(sweepValue(1)).toBe(50);
    const mid = [0.2, 0.4, 0.6, 0.8].map(sweepValue);
    expect(Math.max(...mid)).toBeGreaterThan(75);
    expect(Math.min(...mid)).toBeLessThan(25);
  });
});

describe('choreographed sweep', () => {
  const sample = (stops: number[]) =>
    Array.from({ length: 401 }, (_, i) => sweepPath(i / 400, stops));

  it('rests at 50 at both ends and reaches both extremes', () => {
    expect(sweepPath(0, [30])).toBe(50);
    expect(sweepPath(1, [30])).toBe(50);
    const v = sample([30]);
    expect(Math.min(...v)).toBeLessThan(3);
    expect(Math.max(...v)).toBeGreaterThan(97);
  });

  it('eases in and out: slow at the ends, faster in the middle', () => {
    const v = sample([]);
    const early = Math.abs((v[8] ?? 0) - (v[0] ?? 0));
    const mid = Math.abs((v[204] ?? 0) - (v[196] ?? 0));
    expect(early).toBeLessThan(mid);
  });

  it('spends longer over the changed regions than over empty ground', () => {
    const inWindow = (vals: number[]) => vals.filter((x) => x > 54 && x < 66).length;
    const withStop = inWindow(sample([60]));
    const without = inWindow(sample([]));
    expect(withStop).toBeGreaterThan(without);
  });

  it('is continuous', () => {
    const v = sample([60, 30]);
    for (let i = 1; i < v.length; i++)
      expect(Math.abs((v[i] ?? 0) - (v[i - 1] ?? 0))).toBeLessThan(3);
  });
});

describe('springStep', () => {
  it('settles on the target without overshooting more than 2 percent', () => {
    let s = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      s = springStep(s, 100, 1 / 60);
      peak = Math.max(peak, s.x);
    }
    expect(s.x).toBeGreaterThan(99.5);
    expect(peak).toBeLessThanOrEqual(102);
  });

  it('moves toward the target immediately but does not jump', () => {
    const s = springStep({ x: 0, v: 0 }, 100, 1 / 60);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(20);
  });
});

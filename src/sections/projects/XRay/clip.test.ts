import { describe, expect, it } from 'vitest';
import { clampPercent, handleLeft, sliderToClip, sliderValueText, sweepValue } from './clip';

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

import { describe, expect, it } from 'vitest';
import { FixedStepper } from './fixedStep';

describe('fixed timestep', () => {
  it('accumulates and exposes an interpolation alpha', () => {
    const s = new FixedStepper(1 / 100, 8, 0.25);
    expect(s.advance(0.004)).toEqual({ steps: 0, alpha: expect.closeTo(0.4, 5) });
    const r = s.advance(0.027);
    expect(r.steps).toBe(3);
    expect(r.alpha).toBeCloseTo(0.1, 5);
  });
  it('gives the same number of steps regardless of frame rate', () => {
    const run = (hz: number) => {
      const s = new FixedStepper(1 / 120, 8, 0.25);
      let n = 0;
      for (let i = 0; i < hz * 2; i++) n += s.advance(1 / hz).steps;
      return n;
    };
    expect(Math.abs(run(60) - 240)).toBeLessThanOrEqual(1);
    expect(Math.abs(run(144) - 240)).toBeLessThanOrEqual(1);
  });
  it('clamps a huge frame (tab return) and never exceeds max steps', () => {
    const s = new FixedStepper(1 / 120, 6, 0.1);
    const r = s.advance(30);
    expect(r.steps).toBeLessThanOrEqual(6);
    expect(r.alpha).toBeGreaterThanOrEqual(0);
    expect(r.alpha).toBeLessThanOrEqual(1);
  });
  it('ignores negative and NaN deltas', () => {
    const s = new FixedStepper(1 / 60);
    expect(s.advance(-1).steps).toBe(0);
    expect(s.advance(Number.NaN).steps).toBe(0);
  });
});

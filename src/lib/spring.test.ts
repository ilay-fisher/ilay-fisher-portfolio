import { describe, expect, it } from 'vitest';
import {
  SPRING_SNAPPY,
  SPRING_SOFT,
  dampingRatio,
  isAtRest,
  settleTime,
  springEase,
  springStep,
  springToLinear,
} from './spring';

describe('springStep', () => {
  const cfg = { stiffness: 220, damping: 22 };
  it('converges on the target and stops', () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 240; i++) s = springStep(s, 100, 1 / 60, cfg);
    expect(s.x).toBeCloseTo(100, 1);
    expect(Math.abs(s.v)).toBeLessThan(0.01);
  });
  it('is a no-op when already at rest on the target', () => {
    expect(springStep({ x: 5, v: 0 }, 5, 1 / 60, cfg)).toEqual({ x: 5, v: 0 });
  });
  it('stays finite after a long frame (tab restored) by clamping dt', () => {
    const s = springStep({ x: 0, v: 0 }, 100, 5, cfg);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(200);
  });
  it('overshoots when under-damped, which is the weight we want', () => {
    let s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 120; i++) {
      s = springStep(s, 100, 1 / 60, { stiffness: 300, damping: 16 });
      max = Math.max(max, s.x);
    }
    expect(max).toBeGreaterThan(100);
  });
});

describe('isAtRest', () => {
  it('is true only when both position error and velocity are tiny', () => {
    expect(isAtRest({ x: 10.0001, v: 0.0001 }, 10)).toBe(true);
    expect(isAtRest({ x: 10, v: 5 }, 10)).toBe(false);
    expect(isAtRest({ x: 12, v: 0 }, 10)).toBe(false);
  });
});

describe('the two shared springs', () => {
  it('are both under-damped so they settle with a little overshoot', () => {
    expect(dampingRatio(SPRING_SOFT)).toBeLessThan(1);
    expect(dampingRatio(SPRING_SNAPPY)).toBeLessThan(1);
    expect(dampingRatio(SPRING_SOFT)).toBeGreaterThan(0.5);
  });
  it('snappy settles faster than soft', () => {
    expect(settleTime(SPRING_SNAPPY)).toBeLessThan(settleTime(SPRING_SOFT));
    expect(settleTime(SPRING_SOFT)).toBeLessThan(1.2);
  });
});

describe('springEase', () => {
  const soft = springEase(SPRING_SOFT);
  it('maps 0 to 0 and 1 to exactly 1', () => {
    expect(soft(0)).toBe(0);
    expect(soft(1)).toBe(1);
  });
  it('overshoots past 1 on the way (a few percent, not a wobble)', () => {
    const peak = Math.max(...Array.from({ length: 200 }, (_, i) => soft(i / 199)));
    expect(peak).toBeGreaterThan(1.01);
    expect(peak).toBeLessThan(1.12);
  });
  it('tolerates NaN and out-of-range input', () => {
    expect(soft(Number.NaN)).toBe(0);
    expect(soft(-2)).toBe(0);
    expect(soft(5)).toBe(1);
  });
});

describe('springToLinear', () => {
  it('produces a CSS linear() easing from 0, overshooting 1, ending on 1', () => {
    const css = springToLinear(SPRING_SNAPPY, 24);
    expect(css.startsWith('linear(0')).toBe(true);
    expect(css.endsWith(', 1)')).toBe(true);
    const nums = css
      .slice(7, -1)
      .split(',')
      .map((s) => Number(s.trim()));
    expect(nums).toHaveLength(24);
    expect(Math.max(...nums)).toBeGreaterThan(1);
    expect(nums[nums.length - 1]).toBe(1);
  });
});

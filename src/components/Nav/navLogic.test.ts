import { describe, expect, it } from 'vitest';
import { pickActive, scrollProgress } from './navLogic';

const order = ['about', 'safesurf', 'drone'] as const;

describe('pickActive', () => {
  it('returns null when nothing crosses the band (hero)', () => {
    expect(pickActive(order, new Set())).toBeNull();
  });
  it('returns the single intersecting id', () => {
    expect(pickActive(order, new Set(['safesurf']))).toBe('safesurf');
  });
  it('prefers the later section when two overlap the band', () => {
    expect(pickActive(order, new Set(['about', 'safesurf']))).toBe('safesurf');
  });
  it('ignores ids that are not in the order', () => {
    expect(pickActive(order, new Set(['nope']))).toBeNull();
  });
});

describe('scrollProgress', () => {
  it('is 0 at the top, 1 at the end and proportional between', () => {
    expect(scrollProgress(0, 2000, 800)).toBe(0);
    expect(scrollProgress(600, 2000, 800)).toBe(0.5);
    expect(scrollProgress(1200, 2000, 800)).toBe(1);
  });
  it('clamps and handles a page that does not scroll', () => {
    expect(scrollProgress(-5, 2000, 800)).toBe(0);
    expect(scrollProgress(9999, 2000, 800)).toBe(1);
    expect(scrollProgress(0, 700, 800)).toBe(0);
  });
});

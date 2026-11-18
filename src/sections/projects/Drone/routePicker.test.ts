import { describe, expect, it } from 'vitest';
import { mulberry32 } from './planner/rng';
import { pickObstacleOnRoute } from './routePicker';

const route = Array.from({ length: 20 }, (_, i) => 100 + i);
const free = () => true;

describe('pickObstacleOnRoute', () => {
  it('returns a cell strictly between the lookahead and the goal', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const cell = pickObstacleOnRoute(route, 4, mulberry32(seed), free, 3);
      expect(cell).toBeGreaterThanOrEqual(route[7] as number);
      expect(cell).toBeLessThanOrEqual(route[18] as number);
    }
  });

  it('never picks the start or the goal', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const cell = pickObstacleOnRoute(route, 0, mulberry32(seed), free, 0);
      expect(cell).not.toBe(route[0]);
      expect(cell).not.toBe(route[19]);
    }
  });

  it('is deterministic for a seed', () => {
    expect(pickObstacleOnRoute(route, 2, mulberry32(5), free, 3)).toBe(
      pickObstacleOnRoute(route, 2, mulberry32(5), free, 3),
    );
  });

  it('skips cells that are not free', () => {
    const only = route[10] as number;
    const cell = pickObstacleOnRoute(route, 2, mulberry32(1), (c) => c === only, 3);
    expect(cell).toBe(only);
    expect(pickObstacleOnRoute(route, 2, mulberry32(1), () => false, 3)).toBe(-1);
  });

  it('falls back to a nearer cell on a short route and returns -1 when none exists', () => {
    const short = [1, 2, 3, 4];
    const c = pickObstacleOnRoute(short, 0, mulberry32(2), free, 3);
    expect([2, 3]).toContain(c);
    expect(pickObstacleOnRoute([1, 2], 0, mulberry32(2), free, 3)).toBe(-1);
    expect(pickObstacleOnRoute([], 0, mulberry32(2), free, 3)).toBe(-1);
    expect(pickObstacleOnRoute([7], 0, mulberry32(2), free, 3)).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import { createRng, shuffled } from './rng';

describe('rng', () => {
  it('is deterministic per seed and stays in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(createRng(43)()).not.toBe(xs[0]);
  });
  it('shuffles without losing items', () => {
    const out = shuffled([1, 2, 3, 4, 5, 6], createRng(1));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

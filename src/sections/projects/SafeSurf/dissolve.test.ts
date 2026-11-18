import { describe, expect, it } from 'vitest';
import {
  bakeNoise,
  burnFieldValue,
  burnPhase,
  createBurn,
  easeBurn,
  EmberPool,
  emberSpawnCount,
  frontValue,
  pickFrontPoint,
  setBurnTarget,
  staggerMs,
  stepBurn,
} from './dissolve';

/** Deterministic RNG for tests (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('burn state machine', () => {
  it('starts gone when blocked and intact when allowed', () => {
    expect(burnPhase(createBurn(true))).toBe('gone');
    expect(burnPhase(createBurn(false))).toBe('intact');
  });

  it('goes intact, burning, gone and back through forming', () => {
    let s = createBurn(false);
    s = setBurnTarget(s, true);
    s = stepBurn(s, 100, 1000);
    expect(burnPhase(s)).toBe('burning');
    s = stepBurn(s, 5000, 1000);
    expect(s.p).toBe(1);
    expect(burnPhase(s)).toBe('gone');
    s = setBurnTarget(s, false);
    s = stepBurn(s, 100, 1000);
    expect(burnPhase(s)).toBe('forming');
    s = stepBurn(s, 5000, 1000);
    expect(burnPhase(s)).toBe('intact');
  });

  it('reverses from the current progress when interrupted mid-burn', () => {
    let s = setBurnTarget(createBurn(false), true);
    s = stepBurn(s, 400, 1000);
    expect(s.p).toBeCloseTo(0.4, 5);
    s = setBurnTarget(s, false);
    s = stepBurn(s, 100, 1000);
    expect(s.p).toBeCloseTo(0.3, 5);
    expect(burnPhase(s)).toBe('forming');
  });

  it('honours a stagger wait before moving', () => {
    let s = setBurnTarget(createBurn(false), true, 200);
    s = stepBurn(s, 150, 1000);
    expect(s.p).toBe(0);
    s = stepBurn(s, 250, 1000);
    expect(s.p).toBeCloseTo(0.2, 5);
  });

  it('returns the same object when the target does not change', () => {
    const s = createBurn(true);
    expect(setBurnTarget(s, true)).toBe(s);
  });

  it('staggers by index', () => {
    expect(staggerMs(0)).toBe(0);
    expect(staggerMs(3)).toBeGreaterThan(staggerMs(1));
  });
});

describe('progress maths', () => {
  it('eases between 0 and 1 and is monotonic', () => {
    expect(easeBurn(0)).toBe(0);
    expect(easeBurn(1)).toBe(1);
    expect(easeBurn(0.5)).toBeCloseTo(0.5, 5);
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeBurn(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('front sweeps from below the field to above it', () => {
    expect(frontValue(0, 0.06)).toBeCloseTo(-0.12, 5);
    expect(frontValue(1, 0.06)).toBeCloseTo(1.12, 5);
  });
});

describe('baked noise', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = bakeNoise(64, 7);
    const b = bakeNoise(64, 7);
    const c = bakeNoise(64, 8);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });
  it('fills the full byte range reasonably and tiles without a seam', () => {
    const n = 64;
    const d = bakeNoise(n, 3);
    let min = 255;
    let max = 0;
    for (const v of d) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(max - min).toBeGreaterThan(120);
    let seam = 0;
    let inner = 0;
    for (let y = 0; y < n; y++) {
      seam += Math.abs(d[y * n]! - d[y * n + n - 1]!);
      inner += Math.abs(d[y * n + 10]! - d[y * n + 11]!);
    }
    expect(seam / n).toBeLessThan((inner / n) * 3 + 8);
  });
});

describe('burn field and ember spawn', () => {
  const size = 64;
  const noise = bakeNoise(size, 5);

  it('burnFieldValue stays in 0..1', () => {
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const v = burnFieldValue(noise, size, r(), r(), [0.5, 0.5]);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('pickFrontPoint only returns points near the burn front', () => {
    const edge = 0.06;
    const p = 0.5;
    const r = rng(9);
    let found = 0;
    for (let i = 0; i < 60; i++) {
      const pt = pickFrontPoint(noise, size, [0.5, 0.5], p, edge, r, 24);
      if (!pt) continue;
      found++;
      const f = burnFieldValue(noise, size, pt.u, pt.v, [0.5, 0.5]);
      expect(Math.abs(f - frontValue(p, edge))).toBeLessThan(edge);
    }
    expect(found).toBeGreaterThan(10);
  });

  it('pickFrontPoint finds nothing when the burn has not started or has finished', () => {
    const r = rng(2);
    expect(pickFrontPoint(noise, size, [0.5, 0.5], 0, 0.06, r, 30)).toBeNull();
    expect(pickFrontPoint(noise, size, [0.5, 0.5], 1, 0.06, r, 30)).toBeNull();
  });

  it('emberSpawnCount accumulates fractions and spawns only while animating', () => {
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const r = emberSpawnCount('burning', 1000 / 60, carry, 90);
      carry = r.carry;
      total += r.count;
    }
    expect(total).toBeGreaterThanOrEqual(88);
    expect(total).toBeLessThanOrEqual(90);
    expect(emberSpawnCount('gone', 16, 0, 90).count).toBe(0);
    expect(emberSpawnCount('intact', 16, 0, 90).count).toBe(0);
  });
});

describe('EmberPool', () => {
  it('spawns, moves, ages out and never exceeds capacity', () => {
    const pool = new EmberPool(4, rng(1));
    for (let i = 0; i < 10; i++) pool.spawn(10 + i, 20, false);
    expect(pool.count).toBe(4);
    const y0 = pool.y[0]!;
    pool.step(100);
    expect(pool.y[0]!).toBeLessThan(y0);
    for (let i = 0; i < 40; i++) pool.step(100);
    expect(pool.count).toBe(0);
  });

  it('writes GL buffers for live embers only', () => {
    const pool = new EmberPool(8, rng(3));
    pool.spawn(5, 6, false);
    pool.spawn(7, 8, true);
    const pos = new Float32Array(16);
    const col = new Float32Array(32);
    const size = new Float32Array(8);
    const n = pool.write(pos, col, size);
    expect(n).toBe(2);
    expect(pos[0]).toBeCloseTo(5, 5);
    expect(size[0]).toBeGreaterThan(0);
  });
});

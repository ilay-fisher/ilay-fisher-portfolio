import { describe, expect, it } from 'vitest';
import { boundingRadius, buildCatalogue } from './catalogue';
import { planSpawns, spawnsOverlap } from './spawn';

const bounds = { minX: -6.5, maxX: 6.5, minZ: -1.2, maxZ: 4.2, height: 12 };
const keepOut = { minX: -6, maxX: 6, minZ: -1.2, maxZ: 0.9 };

describe('spawn plan', () => {
  const specs = buildCatalogue('desktop');
  const plan = planSpawns(specs, bounds, keepOut, 7);

  it('is deterministic for a seed and differs across seeds', () => {
    expect(planSpawns(specs, bounds, keepOut, 7)).toEqual(plan);
    expect(planSpawns(specs, bounds, keepOut, 8)).not.toEqual(plan);
  });

  it('places every body inside the bounds and outside the name keep-out', () => {
    expect(plan).toHaveLength(specs.length);
    for (const p of plan) {
      const r = boundingRadius(specs.find((s) => s.id === p.id)!);
      expect(p.x - r).toBeGreaterThanOrEqual(bounds.minX - 1e-6);
      expect(p.x + r).toBeLessThanOrEqual(bounds.maxX + 1e-6);
      expect(p.z + r).toBeLessThanOrEqual(bounds.maxZ + 1e-6);
      expect(p.z - r).toBeGreaterThanOrEqual(keepOut.maxZ - 1e-6);
      expect(p.y).toBeGreaterThan(1);
    }
  });

  it('never overlaps two bodies that arrive close together in time', () => {
    for (let i = 0; i < plan.length; i++)
      for (let j = i + 1; j < plan.length; j++) {
        const a = plan[i]!;
        const b = plan[j]!;
        if (Math.abs(a.delayMs - b.delayMs) < 700) {
          const ra = boundingRadius(specs.find((s) => s.id === a.id)!);
          const rb = boundingRadius(specs.find((s) => s.id === b.id)!);
          expect(spawnsOverlap(a, ra, b, rb)).toBe(false);
        }
      }
  });

  it('schedules the drop so it finishes arriving within about 1.4 s', () => {
    const delays = plan.map((p) => p.delayMs);
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(1400);
    expect(new Set(delays).size).toBeGreaterThan(plan.length / 2);
  });

  it('works for the mobile catalogue on a narrow floor', () => {
    const narrow = { minX: -3.8, maxX: 3.8, minZ: -1.2, maxZ: 3.6, height: 10 };
    const m = buildCatalogue('mobile');
    const p = planSpawns(m, narrow, { minX: -3.5, maxX: 3.5, minZ: -1.2, maxZ: 0.7 }, 3);
    expect(p).toHaveLength(m.length);
  });
});

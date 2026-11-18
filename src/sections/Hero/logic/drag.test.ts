import { describe, expect, it } from 'vitest';
import { VelocityTracker, clampVec, springAccel } from './drag';

describe('drag spring', () => {
  it('accelerates toward the target and is damped by velocity', () => {
    const a = springAccel({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 60, 12, 400);
    expect(a.x).toBeGreaterThan(0);
    const damped = springAccel({ x: 1, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 60, 12, 400);
    expect(damped.x).toBeLessThan(a.x);
  });
  it('clamps the acceleration so a far pointer cannot explode the body', () => {
    const a = springAccel({ x: 500, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 60, 12, 400);
    expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(400, 5);
  });
});

describe('throw velocity', () => {
  it('estimates velocity from the recent samples only', () => {
    const t = new VelocityTracker(100);
    t.push(0, { x: -50, y: 0, z: 0 });
    t.push(900, { x: 0, y: 0, z: 0 });
    t.push(950, { x: 1, y: 0, z: 0 });
    t.push(1000, { x: 2, y: 0, z: 0 });
    const v = t.estimate(30);
    expect(v.x).toBeCloseTo(20, 0);
  });
  it('is zero with fewer than two samples and clamps the speed', () => {
    const t = new VelocityTracker(100);
    expect(t.estimate(30)).toEqual({ x: 0, y: 0, z: 0 });
    t.push(0, { x: 0, y: 0, z: 0 });
    t.push(10, { x: 10, y: 0, z: 0 });
    const v = t.estimate(22);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(22, 5);
    expect(clampVec({ x: 3, y: 4, z: 0 }, 10)).toEqual({ x: 3, y: 4, z: 0 });
  });
  it('ignores a stale pointer: a held-still pointer throws nothing', () => {
    const t = new VelocityTracker(100);
    t.push(0, { x: 0, y: 0, z: 0 });
    t.push(50, { x: 5, y: 0, z: 0 });
    expect(t.estimate(30, 1000)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

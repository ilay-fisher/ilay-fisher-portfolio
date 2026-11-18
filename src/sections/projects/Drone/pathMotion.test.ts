import { describe, expect, it } from 'vitest';
import {
  Trajectory,
  cumulativeLengths,
  easeInOutCubic,
  easeOutCubic,
  samplePolyline,
  speedAt,
} from './pathMotion';

const L = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 4 },
];

describe('arc-length sampling', () => {
  it('accumulates segment lengths', () => {
    expect(cumulativeLengths(L)).toEqual([0, 3, 7]);
    expect(cumulativeLengths([])).toEqual([]);
    expect(cumulativeLengths([{ x: 1, y: 1 }])).toEqual([0]);
  });

  it('samples by distance along the line, not by index', () => {
    const cum = cumulativeLengths(L);
    expect(samplePolyline(L, cum, 0)).toMatchObject({ x: 0, y: 0, index: 0 });
    expect(samplePolyline(L, cum, 1.5)).toMatchObject({ x: 1.5, y: 0, index: 0 });
    expect(samplePolyline(L, cum, 3)).toMatchObject({ x: 3, y: 0 });
    const mid = samplePolyline(L, cum, 5);
    expect(mid.x).toBeCloseTo(3, 12);
    expect(mid.y).toBeCloseTo(2, 12);
    expect(mid.index).toBe(1);
  });

  it('reports the heading of the current segment', () => {
    const cum = cumulativeLengths(L);
    expect(samplePolyline(L, cum, 1).angle).toBeCloseTo(0, 12);
    expect(samplePolyline(L, cum, 5).angle).toBeCloseTo(Math.PI / 2, 12);
  });

  it('clamps outside the line and survives a degenerate line', () => {
    const cum = cumulativeLengths(L);
    expect(samplePolyline(L, cum, -4)).toMatchObject({ x: 0, y: 0 });
    expect(samplePolyline(L, cum, 99)).toMatchObject({ x: 3, y: 4 });
    const one = [{ x: 2, y: 2 }];
    expect(samplePolyline(one, cumulativeLengths(one), 5)).toMatchObject({ x: 2, y: 2 });
    const stacked = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ];
    const s = samplePolyline(stacked, cumulativeLengths(stacked), 0.5);
    expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.angle)).toBe(true);
  });
});

describe('easing', () => {
  it('hits 0 and 1, clamps, and is monotonic', () => {
    for (const f of [easeOutCubic, easeInOutCubic]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
      expect(f(-3)).toBe(0);
      expect(f(7)).toBe(1);
      let prev = 0;
      for (let i = 1; i <= 100; i++) {
        const v = f(i / 100);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('speed profile', () => {
  it('starts at rest, reaches cruise speed, and slows into the goal', () => {
    expect(speedAt(0, 20, 6)).toBe(0);
    expect(speedAt(0.1, 20, 6)).toBeGreaterThan(0);
    expect(speedAt(0.1, 20, 6)).toBeLessThan(6);
    expect(speedAt(2, 20, 6)).toBe(6);
    expect(speedAt(2, 0.5, 6)).toBeLessThan(6);
    expect(speedAt(2, 0.01, 6)).toBeGreaterThan(0);
  });
});

describe('Trajectory', () => {
  it('moves along the line and finishes exactly at the end', () => {
    const t = new Trajectory(L);
    expect(t.length).toBe(7);
    expect(t.done).toBe(false);
    let guard = 0;
    while (!t.done && guard++ < 10_000) t.advance(1 / 60);
    expect(t.done).toBe(true);
    expect(guard).toBeLessThan(10_000);
    expect(t.progress).toBe(7);
    expect(t.position()).toMatchObject({ x: 3, y: 4 });
  });

  it('never overshoots with a huge time step and is monotonic', () => {
    const t = new Trajectory(L);
    let last = 0;
    for (let i = 0; i < 400; i++) {
      t.advance(0.02);
      expect(t.progress).toBeGreaterThanOrEqual(last);
      expect(t.progress).toBeLessThanOrEqual(7);
      last = t.progress;
    }
    const u = new Trajectory(L);
    u.advance(1000);
    expect(u.progress).toBeLessThanOrEqual(7);
  });

  it('honours the speed factor (slower inside wind)', () => {
    const a = new Trajectory(L);
    const b = new Trajectory(L);
    for (let i = 0; i < 30; i++) {
      a.advance(1 / 60, 1);
      b.advance(1 / 60, 0.5);
    }
    expect(b.progress).toBeLessThan(a.progress);
    expect(b.progress).toBeGreaterThan(0);
  });

  it('exposes the points still ahead, starting at the current position', () => {
    const t = new Trajectory(L);
    for (let i = 0; i < 40; i++) t.advance(1 / 60);
    const ahead = t.pointsAhead();
    expect(ahead[0]).toEqual({ x: t.position().x, y: t.position().y });
    expect(ahead[ahead.length - 1]).toEqual({ x: 3, y: 4 });
    expect(ahead.length).toBeGreaterThanOrEqual(2);
  });

  it('a single point is already done', () => {
    const t = new Trajectory([{ x: 1, y: 1 }]);
    expect(t.done).toBe(true);
    expect(t.position()).toMatchObject({ x: 1, y: 1 });
  });
});

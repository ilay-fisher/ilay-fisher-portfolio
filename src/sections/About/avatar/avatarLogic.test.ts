import { describe, expect, it } from 'vitest';
import {
  DEAD_ZONE,
  IDLE_AFTER,
  avatarPose,
  indexToLook,
  initIdle,
  lookRange,
  lookToIndex,
  nearestIndex,
  pitchFromPointer,
  pointerToLook,
  scrollToLook,
  stepIdle,
} from './avatarLogic';

const COUNT = 44;
const NEUTRAL = 22;

describe('pointerToLook', () => {
  it('is 0 inside the dead zone and exactly symmetric', () => {
    expect(pointerToLook(0, 400)).toBe(0);
    expect(pointerToLook(400 * DEAD_ZONE * 0.9, 400)).toBe(0);
    expect(pointerToLook(-400 * DEAD_ZONE * 0.9, 400)).toBe(0);
    expect(pointerToLook(137, 400)).toBeCloseTo(-pointerToLook(-137, 400), 10);
  });
  it('reaches full turn at the range and clamps beyond it', () => {
    expect(pointerToLook(400, 400)).toBe(1);
    expect(pointerToLook(5000, 400)).toBe(1);
    expect(pointerToLook(-5000, 400)).toBe(-1);
  });
  it('is monotonic increasing with pointer x', () => {
    let prev = -Infinity;
    for (let dx = -600; dx <= 600; dx += 7) {
      const v = pointerToLook(dx, 400);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('survives a degenerate range', () => {
    expect(pointerToLook(10, 0)).toBe(0);
    expect(Number.isFinite(pointerToLook(Number.NaN, 400))).toBe(true);
  });
});

describe('lookRange and pitchFromPointer', () => {
  it('scales with the viewport but stays inside sane bounds', () => {
    expect(lookRange(320)).toBe(260);
    expect(lookRange(1440)).toBeCloseTo(1440 * 0.42);
    expect(lookRange(6000)).toBe(760);
  });
  it('is positive when the pointer is above the portrait and clamped', () => {
    expect(pitchFromPointer(-200, 400)).toBeGreaterThan(0);
    expect(pitchFromPointer(200, 400)).toBeLessThan(0);
    expect(pitchFromPointer(-9999, 400)).toBe(1);
    expect(pitchFromPointer(0, 400)).toBe(0);
  });
});

describe('lookToIndex', () => {
  it('maps the ends and the middle to the first, last and neutral frame', () => {
    expect(lookToIndex(1, COUNT, NEUTRAL)).toBe(0);
    expect(lookToIndex(0, COUNT, NEUTRAL)).toBe(NEUTRAL);
    expect(lookToIndex(-1, COUNT, NEUTRAL)).toBe(COUNT - 1);
  });
  it('is monotonic: further screen right never gives a higher frame index', () => {
    let prev = Infinity;
    for (let l = -1; l <= 1.0001; l += 0.01) {
      const i = lookToIndex(l, COUNT, NEUTRAL);
      // look rises from -1 to 1 so the index must fall
      expect(i).toBeLessThanOrEqual(prev + 1e-9);
      prev = i;
    }
  });
  it('clamps out-of-range looks', () => {
    expect(lookToIndex(5, COUNT, NEUTRAL)).toBe(0);
    expect(lookToIndex(-5, COUNT, NEUTRAL)).toBe(COUNT - 1);
  });
  it('round-trips through indexToLook', () => {
    for (const i of [0, 5, 13, NEUTRAL, 30, COUNT - 1]) {
      expect(lookToIndex(indexToLook(i, COUNT, NEUTRAL), COUNT, NEUTRAL)).toBeCloseTo(i, 6);
    }
  });
  it('nearestIndex rounds and stays in range', () => {
    expect(nearestIndex(3.49, COUNT)).toBe(3);
    expect(nearestIndex(3.5, COUNT)).toBe(4);
    expect(nearestIndex(-2, COUNT)).toBe(0);
    expect(nearestIndex(99, COUNT)).toBe(COUNT - 1);
  });
});

describe('avatarPose', () => {
  it('tilts only a few degrees and moves a few pixels', () => {
    const up = avatarPose(0.3, 1);
    expect(Math.abs(up.rx)).toBeLessThanOrEqual(5);
    expect(Math.abs(up.rz)).toBeLessThanOrEqual(2);
    expect(Math.abs(up.ty)).toBeLessThanOrEqual(8);
  });
  it('looking up and down are mirror images', () => {
    expect(avatarPose(0, 1).rx).toBeCloseTo(-avatarPose(0, -1).rx, 10);
    expect(avatarPose(0, 1).ty).toBeCloseTo(-avatarPose(0, -1).ty, 10);
  });
  it('is flat when facing the visitor', () => {
    expect(avatarPose(0, 0)).toEqual({ rx: 0, rz: 0, ty: 0 });
  });
});

describe('scrollToLook', () => {
  it('stays gentle and monotonic over the pass through the viewport', () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = scrollToLook(p);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.7);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(scrollToLook(0.5)).toBeCloseTo(0, 10);
  });
});

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('idle scheduler', () => {
  it('stays quiet while the pointer is active', () => {
    const rng = seq([0.5]);
    const s = initIdle(0, rng);
    const r = stepIdle(s, 5000, 4900, rng);
    expect(r.look).toBeNull();
  });
  it('looks around after idling, holds, returns to 0 and waits again', () => {
    const rng = seq([0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    let s = initIdle(0, rng);
    const seen: Array<number | null> = [];
    for (let t = 0; t <= 30000; t += 100) {
      const r = stepIdle(s, t, -1e9, rng);
      s = r.state;
      seen.push(r.look);
    }
    const looks = seen.filter((v): v is number => v !== null && v !== 0);
    expect(looks.length).toBeGreaterThan(5);
    for (const v of looks) {
      expect(Math.abs(v)).toBeGreaterThanOrEqual(0.4);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
    // returns to facing the visitor between glances
    expect(seen.some((v) => v === 0)).toBe(true);
    // never idle-looks before the first wait expires
    expect(seen.slice(0, 15).every((v) => v === 0)).toBe(true);
  });
  it('resets to waiting when the pointer moves again', () => {
    const rng = seq([0.9, 0.5, 0.5]);
    let s = initIdle(0, rng);
    for (let t = 0; t <= 6000; t += 100) s = stepIdle(s, t, -1e9, rng).state;
    const active = stepIdle(s, 6100, 6050, rng);
    expect(active.look).toBeNull();
    expect(active.state.phase).toBe('wait');
    const later = stepIdle(active.state, 6100 + IDLE_AFTER + 50, 6050, rng);
    expect(later.look).toBe(0);
  });
});

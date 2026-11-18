import { describe, expect, it } from 'vitest';
import { magnetOffset, magnetPull } from './magnetic';

describe('magnetOffset', () => {
  it('pulls toward the pointer by the strength factor and clamps', () => {
    expect(magnetOffset(10, -20, 0.3, 12)).toEqual({ x: 3, y: -6 });
    expect(magnetOffset(1000, -1000, 0.3, 12)).toEqual({ x: 12, y: -12 });
  });
});

describe('magnetPull', () => {
  const base = { halfW: 60, halfH: 22, range: 40, strength: 0.3, max: 10 };
  it('pulls when the pointer is inside the field around the element', () => {
    expect(magnetPull({ ...base, dx: 20, dy: -10 })).toEqual({ x: 6, y: -3 });
  });
  it('still pulls just outside the element, inside the range', () => {
    const p = magnetPull({ ...base, dx: 60 + 30, dy: 0 });
    expect(p.x).toBeGreaterThan(0);
  });
  it('releases (zero offset) beyond the range', () => {
    expect(magnetPull({ ...base, dx: 60 + 41, dy: 0 })).toEqual({ x: 0, y: 0 });
    expect(magnetPull({ ...base, dx: 0, dy: 22 + 41 })).toEqual({ x: 0, y: 0 });
  });
  it('never exceeds max', () => {
    const p = magnetPull({ ...base, dx: 99, dy: 60, strength: 5 });
    expect(Math.abs(p.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(10);
  });
});

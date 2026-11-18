import { describe, expect, it } from 'vitest';
import { GAP_PX, MAX_SCALE, pairLayout } from './crop';

describe('pairLayout (ported from the X-Ray Lens frontend)', () => {
  it('does not upscale a crop whose short side is at least 75 px', () => {
    const l = pairLayout({ x: 0, y: 0, w: 120, h: 90 });
    expect(l.scale).toBe(1);
    expect(l.width).toBe(2 * 120 + GAP_PX);
    expect(l.height).toBe(90);
  });
  it('upscales small crops, capped at MAX_SCALE, and never scales the gap', () => {
    const l = pairLayout({ x: 5, y: 5, w: 39, h: 25 });
    expect(l.scale).toBe(3);
    expect(l.width).toBe(2 * 39 * 3 + GAP_PX);
    expect(pairLayout({ x: 0, y: 0, w: 5, h: 5 }).scale).toBe(MAX_SCALE);
    expect(l.target.dx).toBe(39 * 3 + GAP_PX);
  });
});

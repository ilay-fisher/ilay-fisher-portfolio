import { describe, expect, it } from 'vitest';
import { layoutName } from './nameLayout';

describe('name layout', () => {
  const n = layoutName(1.5);

  it('is centred on x=0 and stands on the floor', () => {
    expect(n.width).toBeGreaterThan(8);
    const lo = Math.min(...n.colliders.map((b) => b.cx - b.hx));
    const hi = Math.max(...n.colliders.map((b) => b.cx + b.hx));
    expect((lo + hi) / 2).toBeCloseTo(0, 1);
    expect(Math.min(...n.colliders.map((b) => b.cy - b.hy))).toBeCloseTo(0, 5);
    expect(n.colliders.every((b) => b.hx > 0 && b.hy > 0 && b.hz > 0)).toBe(true);
  });

  it('has a glyph per letter of "Ilay Fisher" (ten) and a tail collider for the y', () => {
    expect(n.glyphs.map((g) => g.ch).join('')).toBe('IlayFisher');
    const y = n.glyphs.find((g) => g.ch === 'y')!;
    expect(y.tail).not.toBeNull();
    expect(n.glyphs.filter((g) => g.tail).length).toBe(1);
  });

  it('scales with cap height and exposes a keep-out rectangle for spawning', () => {
    const big = layoutName(3);
    expect(big.width / n.width).toBeCloseTo(2, 1);
    expect(n.keepOut.maxZ).toBeGreaterThan(n.keepOut.minZ);
    // Thin lettering: a readable face rather than a deep block.
    expect(n.depth).toBeLessThanOrEqual(1.5 * 0.52);
    expect(n.keepOut.maxX).toBeGreaterThan(n.width / 2 - 0.5);
  });
});

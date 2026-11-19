import { describe, expect, it } from 'vitest';
import { badgeGlyphShapes } from './geometry';

/** Bounding box of a shape's outline. */
function box(points: ReadonlyArray<{ x: number; y: number }>) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe('badge glyphs read from the official marks', () => {
  it('TypeScript yields the two letters, T and S, inside a 1 unit tile', () => {
    const g = badgeGlyphShapes('typescript', 1 / 24);
    expect(g).toHaveLength(2);
    for (const s of g) {
      const b = box(s.getPoints(6));
      expect(b.x0).toBeGreaterThanOrEqual(-0.5);
      expect(b.x1).toBeLessThanOrEqual(0.5);
      expect(b.y0).toBeGreaterThanOrEqual(-0.5);
      expect(b.y1).toBeLessThanOrEqual(0.5);
    }
  });

  it('LinkedIn yields the stem, the dot and the n of "in", left of centre to right of centre', () => {
    const g = badgeGlyphShapes('linkedin', 1 / 24);
    expect(g).toHaveLength(3);
    const all = box(g.flatMap((s) => s.getPoints(6)));
    expect(all.x0).toBeLessThan(-0.25);
    expect(all.x1).toBeGreaterThan(0.25);
  });

  it('returns nothing for an unknown mark', () => {
    expect(badgeGlyphShapes('nope', 1)).toEqual([]);
  });
});

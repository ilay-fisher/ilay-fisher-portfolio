import { describe, expect, it } from 'vitest';
import { TOKEN_SHAPES } from '../scene/tokenData';
import { buildCatalogue, boundingRadius } from './catalogue';
import { insideConvex, isConvex, tokenFootprint } from './token';

const tokenSpecs = buildCatalogue('desktop').filter((s) => s.kind === 'token');

describe('token cut lines and colliders', () => {
  it('has shape data for every token in the catalogue', () => {
    expect(tokenSpecs).toHaveLength(21);
    for (const s of tokenSpecs) expect(TOKEN_SHAPES[s.mark!], s.id).toBeDefined();
  });

  it('keeps each collider convex, small, and containing every point of the cut line', () => {
    for (const [slug, t] of Object.entries(TOKEN_SHAPES)) {
      const hull: [number, number][] = [];
      for (let i = 0; i < t.hull.length; i += 2) hull.push([t.hull[i]!, t.hull[i + 1]!]);
      expect(hull.length, slug).toBeGreaterThanOrEqual(3);
      expect(hull.length, slug).toBeLessThanOrEqual(10);
      expect(isConvex(hull), `${slug} convex`).toBe(true);
      for (const loop of t.cut)
        for (let i = 0; i < loop.length; i += 2)
          expect(insideConvex(hull, [loop[i]!, loop[i + 1]!], 0.02), `${slug} point ${i}`).toBe(
            true,
          );
    }
  });

  it('cuts a silhouette, not a rectangle: the plate is well inside its hull box for round marks', () => {
    // A circle-ish mark must not be collided as a square: the hull has to cut the corners.
    const hullArea = (slug: string) => {
      const h = TOKEN_SHAPES[slug]!.hull;
      let a = 0;
      for (let i = 0; i < h.length; i += 2) {
        const j = (i + 2) % h.length;
        a += h[i]! * h[j + 1]! - h[j]! * h[i + 1]!;
      }
      return Math.abs(a) / 2;
    };
    for (const slug of ['googlecloud', 'react', 'python', 'docker']) {
      const t = TOKEN_SHAPES[slug]!;
      expect(hullArea(slug) / (t.w * t.h), slug).toBeLessThan(0.93);
    }
  });

  it('sizes a token so its longest plate side is the requested world size', () => {
    for (const s of tokenSpecs) {
      const f = tokenFootprint(s.mark!, 2);
      expect(Math.max(f.w, f.d)).toBeCloseTo(2, 5);
      expect(f.unit).toBeGreaterThan(0);
      const r = f.hull.reduce((m, [x, z]) => Math.max(m, Math.hypot(x, z)), 0);
      expect(f.radius).toBeCloseTo(r, 5);
      for (const [x, z] of f.hull) {
        expect(Math.abs(x)).toBeLessThanOrEqual(f.w / 2 + 1e-6);
        expect(Math.abs(z)).toBeLessThanOrEqual(f.d / 2 + 1e-6);
      }
    }
  });

  it('gives the catalogue a bounding radius that contains the collider', () => {
    for (const s of tokenSpecs) {
      const f = tokenFootprint(s.mark!, Math.max(s.size.w, s.size.d) / s.scale);
      expect(boundingRadius(s)).toBeGreaterThanOrEqual(f.radius * s.scale - 1e-6);
      expect(s.size.w).toBeCloseTo(f.w * s.scale, 5);
      expect(s.size.d).toBeCloseTo(f.d * s.scale, 5);
    }
  });
});

import { TOKEN_SHAPES } from '../scene/tokenData';

/** A token's footprint in world units, centred on the plate. `hull` is the convex collider as [x, z] points. */
export interface TokenFootprint {
  /** World units per mark unit (the mark box is 24 across). */
  unit: number;
  w: number;
  d: number;
  hull: Array<[number, number]>;
  /** Largest distance from the plate centre to a collider vertex. */
  radius: number;
}

/**
 * Footprint of the die-cut token for a mark, scaled so its longest plate side is `maxDim`. Mark y (down)
 * becomes world z (toward the camera), so the mark reads upright from the front.
 */
export function tokenFootprint(slug: string, maxDim: number): TokenFootprint {
  const t = TOKEN_SHAPES[slug];
  if (!t) throw new Error(`no token shape for ${slug}`);
  // The collider can reach a hair past the plate box (its corners are extended), so size from the collider.
  let hx = 0;
  let hz = 0;
  for (let i = 0; i < t.hull.length; i += 2) {
    hx = Math.max(hx, Math.abs(t.hull[i]!));
    hz = Math.max(hz, Math.abs(t.hull[i + 1]!));
  }
  const unit = maxDim / (2 * Math.max(hx, hz));
  const hull: Array<[number, number]> = [];
  for (let i = 0; i < t.hull.length; i += 2) hull.push([t.hull[i]! * unit, t.hull[i + 1]! * unit]);
  const radius = hull.reduce((m, [x, z]) => Math.max(m, Math.hypot(x, z)), 0);
  return { unit, w: 2 * hx * unit, d: 2 * hz * unit, hull, radius };
}

const cross = (a: [number, number], b: [number, number], p: [number, number]) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

/** True when a polygon is convex (all turns go the same way), whichever way it is wound. */
export function isConvex(poly: ReadonlyArray<[number, number]>): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const c = cross(poly[i]!, poly[(i + 1) % poly.length]!, poly[(i + 2) % poly.length]!);
    if (Math.abs(c) < 1e-9) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** True when `p` lies inside a convex polygon, allowing `tol` of slack past each edge (same units as p). */
export function insideConvex(
  poly: ReadonlyArray<[number, number]>,
  p: [number, number],
  tol = 0,
): boolean {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = Math.sign(area) || 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if ((cross(a, b, p) / len) * sign < -tol) return false;
  }
  return true;
}

/**
 * Convex outline (x, z in -1..1) of a square with rounded corners: the SafeGuard app icon's collider.
 * `corner` is the corner radius as a share of the half width; each corner gets `perCorner` points on its arc
 * (at least 2, the arc's two ends).
 */
export function roundedSquareOutline(corner: number, perCorner: number): Array<[number, number]> {
  const c = 1 - corner;
  const out: Array<[number, number]> = [];
  for (let q = 0; q < 4; q++) {
    const cx = q === 0 || q === 3 ? c : -c;
    const cz = q < 2 ? c : -c;
    for (let i = 0; i < perCorner; i++) {
      const a = ((q + i / (perCorner - 1)) * Math.PI) / 2;
      out.push([cx + corner * Math.cos(a), cz + corner * Math.sin(a)]);
    }
  }
  return out;
}

/** A regular polygon of `n` sides and radius `r` (the magnifier's ring collider). */
export function regularPolygon(n: number, r: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

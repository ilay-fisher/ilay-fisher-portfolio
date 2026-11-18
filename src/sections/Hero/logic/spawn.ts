import { type ObjectSpec } from './catalogue';
import type { Bounds } from './camera';
import { createRng, shuffled } from './rng';

/** Where and when one object enters the world. Rotations are Euler angles in radians. */
export interface SpawnPlan {
  id: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  /** Start velocity toward the camera (+z), so bodies land in front of the name, not on it. */
  vz: number;
  delayMs: number;
}

/** Floor rectangle objects must not spawn over (the name). */
export interface KeepOut {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const STEP_MS = 70;
/** The whole drop arrives within this, so a crowd of bodies stays a quick shower, not a slow drizzle. */
const TOTAL_MS = 1250;
/** Air wanted between neighbouring footprints, tried from roomy to tight. */
/** Spawn spacing from the side and front walls. */
const WALL_GAP = 0.3;
const GAPS = [0.5, 0.36, 0.24, 0.12];

/** Radius of the circle a piece's footprint fits in on the floor (spawn spacing and stage fit). */
export function footprintRadius(s: ObjectSpec): number {
  return s.radius;
}

/** True when the bounding spheres of two spawn points intersect. */
export function spawnsOverlap(
  a: { x: number; y: number; z: number },
  ra: number,
  b: { x: number; y: number; z: number },
  rb: number,
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < ra + rb;
}

/**
 * Plans a choreographed drop. Every piece gets its own patch of floor in front of the name, found by
 * dart throwing (biggest first, roomy gaps first), so footprints never overlap and pieces land loosely
 * scattered with air between them. Arrival order is shuffled, about 50 ms apart. Deterministic for a seed.
 */
export function planSpawns(
  specs: readonly ObjectSpec[],
  bounds: Bounds,
  keepOut: KeepOut,
  seed: number,
): SpawnPlan[] {
  const rng = createRng(seed);
  const step = Math.min(STEP_MS, TOTAL_MS / Math.max(1, specs.length - 1));
  const order = shuffled(specs, rng);
  const spot = new Map<string, { x: number; z: number }>();
  const placed: Array<{ x: number; z: number; r: number }> = [];

  const bySize = [...order].sort((a, b) => b.radius - a.radius);
  for (const spec of bySize) {
    const r = spec.radius;
    // Stay off the walls: a flat piece that lands against one tends to lean on it instead of lying down.
    const xLo = bounds.minX + r + WALL_GAP;
    const xHi = Math.max(xLo, bounds.maxX - r - WALL_GAP);
    const zLo = keepOut.maxZ + r;
    const zHi = Math.max(zLo, bounds.maxZ - r - WALL_GAP - 0.5);
    const sample = () => ({ x: xLo + rng() * (xHi - xLo), z: zLo + rng() * (zHi - zLo) });
    const room = (c: { x: number; z: number }) =>
      placed.reduce((m, p) => Math.min(m, Math.hypot(c.x - p.x, c.z - p.z) - r - p.r), Infinity);

    let best: { x: number; z: number } | null = null;
    let bestRoom = -Infinity;
    for (const gap of GAPS) {
      for (let i = 0; i < 80; i++) {
        const c = sample();
        const m = room(c);
        if (m >= gap) {
          best = c;
          bestRoom = m;
          break;
        }
        if (m > bestRoom) {
          best = c;
          bestRoom = m;
        }
      }
      if (bestRoom >= gap) break;
    }
    // A crowded floor: take the roomiest of many more tries.
    for (let i = 0; i < 600 && bestRoom < GAPS[GAPS.length - 1]!; i++) {
      const c = sample();
      const m = room(c);
      if (m > bestRoom) {
        best = c;
        bestRoom = m;
      }
    }
    const c = best!;
    spot.set(spec.id, c);
    placed.push({ ...c, r });
  }

  return order.map((spec, i) => {
    const c = spot.get(spec.id)!;
    return {
      id: spec.id,
      x: c.x,
      y: 3 + rng() * 1.8,
      z: c.z,
      rx: (rng() - 0.5) * 0.5,
      // Mostly facing the camera so printed legends stay readable once things settle.
      ry: (rng() - 0.5) * 1.5,
      rz: (rng() - 0.5) * 0.5,
      vz: 0.6 + rng() * 0.4,
      delayMs: Math.round(i * step + rng() * 25),
    };
  });
}

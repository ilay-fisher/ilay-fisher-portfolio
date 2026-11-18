import { boundingRadius, type ObjectSpec } from './catalogue';
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
  delayMs: number;
}

/** Floor rectangle objects must not spawn over (the name). */
export interface KeepOut {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const WINDOW_MS = 700;
const STEP_MS = 70;

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
 * Plans a choreographed drop: objects arrive one after another about 70 ms apart, each above a
 * free spot in front of the name. Bodies that arrive within 700 ms of each other never start
 * overlapping. Deterministic for a seed.
 */
export function planSpawns(
  specs: readonly ObjectSpec[],
  bounds: Bounds,
  keepOut: KeepOut,
  seed: number,
): SpawnPlan[] {
  const rng = createRng(seed);
  const order = shuffled(specs, rng);
  const plans: SpawnPlan[] = [];
  const radius = new Map<string, number>();

  order.forEach((spec, i) => {
    const r = boundingRadius(spec);
    radius.set(spec.id, r);
    const xLo = bounds.minX + r;
    const xHi = Math.max(xLo, bounds.maxX - r);
    const zLo = keepOut.maxZ + r;
    const zHi = Math.max(zLo, bounds.maxZ - r);
    const delayMs = Math.round(i * STEP_MS + rng() * 30);
    const near = plans.filter((p) => Math.abs(p.delayMs - delayMs) < WINDOW_MS);
    const clear = (c: { x: number; y: number; z: number }) =>
      near.every((p) => !spawnsOverlap(c, r, p, radius.get(p.id)!));

    let cand = { x: 0, y: 0, z: 0 };
    let found = false;
    for (let attempt = 0; attempt < 120 && !found; attempt++) {
      cand = {
        x: xLo + rng() * (xHi - xLo),
        y: 3.2 + rng() * 1.6,
        z: zLo + rng() * (zHi - zLo),
      };
      found = clear(cand);
    }
    for (let bump = 0; bump < 30 && !found; bump++) {
      cand.y += 1.1;
      found = clear(cand);
    }
    plans.push({
      id: spec.id,
      ...cand,
      rx: (rng() - 0.5) * 1.2,
      ry: rng() * Math.PI * 2,
      rz: (rng() - 0.5) * 1.2,
      delayMs,
    });
  });
  return plans;
}

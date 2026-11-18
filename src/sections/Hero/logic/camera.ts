/** Pure camera maths: pointer rays, floor intersection, world bounds. No three.js, so it is unit tested. */

/** A 3D vector (plain object, so tests and workers can use it without a library). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Everything that defines the perspective camera, including the lens shift that frames the play region. */
export interface Rig {
  position: Vec3;
  target: Vec3;
  fovDeg: number;
  aspect: number;
  /** Where the framed target appears on screen, in NDC (the play region's centre). */
  shiftNdcX: number;
  shiftNdcY: number;
}

/** A sub-rectangle of the canvas in NDC (-1..1) where the floor must be playable. */
export interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Playable floor rectangle in world space plus the ceiling height. */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** A world-space ray. `dir` is unit length. */
export interface Ray {
  origin: Vec3;
  dir: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

function basis(rig: Rig) {
  const f = norm(sub(rig.target, rig.position));
  const right = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const up = cross(right, f);
  const tanY = Math.tan((rig.fovDeg * Math.PI) / 360);
  return { f, right, up, tanY, tanX: tanY * rig.aspect };
}

/** World ray through a screen point given in NDC (x right, y up), honouring the lens shift. */
export function rayFromNdc(rig: Rig, ndcX: number, ndcY: number): Ray {
  const { f, right, up, tanX, tanY } = basis(rig);
  const ux = ndcX - rig.shiftNdcX;
  const uy = ndcY - rig.shiftNdcY;
  const dir = norm({
    x: f.x + right.x * ux * tanX + up.x * uy * tanY,
    y: f.y + right.y * ux * tanX + up.y * uy * tanY,
    z: f.z + right.z * ux * tanX + up.z * uy * tanY,
  });
  return { origin: rig.position, dir };
}

/** Where a ray meets the horizontal plane `y`, or null when it points away or runs parallel. */
export function intersectPlaneY(ray: Ray, y: number): Vec3 | null {
  if (Math.abs(ray.dir.y) < 1e-6) return null;
  const t = (y - ray.origin.y) / ray.dir.y;
  if (t < 0) return null;
  return {
    x: ray.origin.x + ray.dir.x * t,
    y,
    z: ray.origin.z + ray.dir.z * t,
  };
}

/** Projects a world point to NDC (inverse of {@link rayFromNdc}). `behind` is true when it is behind the camera. */
export function projectToNdc(rig: Rig, p: Vec3): { x: number; y: number; behind: boolean } {
  const { f, right, up, tanX, tanY } = basis(rig);
  const v = sub(p, rig.position);
  const z = dot(v, f);
  return {
    x: dot(v, right) / (z * tanX) + rig.shiftNdcX,
    y: dot(v, up) / (z * tanY) + rig.shiftNdcY,
    behind: z <= 0,
  };
}

/** Inputs for {@link fitRig}. */
export interface FitOptions {
  aspect: number;
  region: Region;
  /** Floor width, in world units, that should span the region at the target depth. */
  worldWidth: number;
  elevationDeg: number;
  fovDeg: number;
  targetZ: number;
}

/**
 * Chooses a camera distance so `worldWidth` fills the region across, then shifts the lens so the
 * target sits in the middle of the region. This is how the scene shares the viewport with the text.
 */
export function fitRig(o: FitOptions): Rig {
  const tanY = Math.tan((o.fovDeg * Math.PI) / 360);
  const halfRegion = (o.region.x1 - o.region.x0) / 2;
  const dist = o.worldWidth / 2 / (halfRegion * tanY * o.aspect);
  const e = (o.elevationDeg * Math.PI) / 180;
  const target = { x: 0, y: 0.3, z: o.targetZ };
  return {
    position: {
      x: 0,
      y: target.y + dist * Math.sin(e),
      z: target.z + dist * Math.cos(e),
    },
    target,
    fovDeg: o.fovDeg,
    aspect: o.aspect,
    shiftNdcX: (o.region.x0 + o.region.x1) / 2,
    shiftNdcY: (o.region.y0 + o.region.y1) / 2,
  };
}

/**
 * Largest axis-aligned floor rectangle that stays inside the region on screen. The back edge is
 * fixed (just behind the name); the front edge is where the region's bottom edge meets the floor.
 */
export function computeBounds(rig: Rig, region: Region, backZ: number, planeY = 0): Bounds {
  const hit = (x: number, y: number) =>
    intersectPlaneY(rayFromNdc(rig, x, y), planeY) ?? { x: 0, y: planeY, z: -40 };
  const bl = hit(region.x0, region.y0);
  const br = hit(region.x1, region.y0);
  const tl = hit(region.x0, region.y1);
  const tr = hit(region.x1, region.y1);
  return {
    minX: Math.max(bl.x, tl.x),
    maxX: Math.min(br.x, tr.x),
    minZ: backZ,
    maxZ: Math.min(bl.z, br.z) - 0.1,
    height: 7,
  };
}

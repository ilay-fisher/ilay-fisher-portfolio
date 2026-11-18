import { computeBounds, fitRig, projectToNdc, type Bounds, type Region, type Rig } from './camera';
import type { Breakpoint } from './catalogue';
import { layoutName, type NameLayout } from './nameLayout';
import { breakpointFor, computeRegion } from './region';

/** How the camera frames the play area at each breakpoint. */
export interface Tuning {
  worldWidth: number;
  elevationDeg: number;
  fovDeg: number;
  targetZ: number;
  /** Floor depth in front of the name that must exist even when the screen region is shorter. */
  minFront: number;
}

export const TUNING: Record<Breakpoint, Tuning> = {
  desktop: { worldWidth: 15.5, elevationDeg: 42, fovDeg: 26, targetZ: 1.7, minFront: 4.4 },
  mobile: { worldWidth: 11.8, elevationDeg: 40, fovDeg: 30, targetZ: 1.5, minFront: 4.4 },
};

/** Share of the world width the name occupies. */
export const NAME_SHARE = 0.92;

/** Everything about the stage that depends on the canvas and the text block: camera, floor, name. */
export interface Stage {
  bp: Breakpoint;
  aspect: number;
  region: Region;
  rig: Rig;
  bounds: Bounds;
  /** Cap height of the name in world units. */
  cap: number;
  layout: NameLayout;
}

export interface StageInput {
  /** Canvas size in CSS px. */
  canvas: { width: number; height: number };
  /** Right and bottom edges of the text block, in px relative to the canvas. */
  text: { right: number; bottom: number };
  windowWidth: number;
}

/** Cap height of the name for a breakpoint (the name spans NAME_SHARE of the floor width). */
export function nameCap(bp: Breakpoint): number {
  const tune = TUNING[bp];
  return Math.min(2, Math.max(0.5, (NAME_SHARE * tune.worldWidth * 0.94) / layoutName(1).width));
}

/** Camera, floor bounds and name layout for a canvas. Pure, so it is unit tested at every width. */
export function computeStage(i: StageInput): Stage {
  const bp = breakpointFor(i.windowWidth);
  const tune = TUNING[bp];
  const region = computeRegion(i.canvas, i.text, bp === 'mobile');
  const aspect = i.canvas.width / i.canvas.height;
  const rig = fitRig({ aspect, region, ...tune });
  const cap = nameCap(bp);
  const layout = layoutName(cap);
  const raw = computeBounds(rig, region, -layout.depth / 2 - 0.35);
  const bounds = { ...raw, maxZ: Math.max(raw.maxZ, layout.keepOut.maxZ + tune.minFront) };
  return { bp, aspect, region, rig, bounds, cap, layout };
}

/** The name's bounding box projected to the screen, in NDC (x right, y up). */
export function nameScreenRect(st: Stage): { x0: number; x1: number; y0: number; y1: number } {
  const { width, height, depth } = st.layout;
  const slab = st.layout.slabs[0]!;
  const hz = Math.max(depth / 2, slab.hz);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const x of [-width / 2, width / 2])
    for (const y of [0, height])
      for (const z of [-hz, hz]) {
        const p = projectToNdc(st.rig, { x, y, z });
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
  return { x0, x1, y0, y1 };
}

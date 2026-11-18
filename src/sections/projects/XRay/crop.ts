/**
 * Layout of the composite the real system sends to the model: baseline | gap | target, both
 * cropped to the same box. Ported from the owner's frontend (`frontend/src/lib/crop.ts` in
 * github.com/ilay-fisher/multimodal-visual-qa-xray-lens), minus the canvas encoding.
 */

/** Width in pixels of the neutral gap between the two crops. Never scaled. */
export const GAP_PX = 8;
/** Crops whose short side is below this are upscaled so the model gets enough pixels. */
export const MIN_SIDE = 75;
/** Upper bound of the integer upscale factor. */
export const MAX_SCALE = 4;

interface Rect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** Upscale factor, composite size and both draw rects for a box. */
export function pairLayout(box: { x: number; y: number; w: number; h: number }): {
  scale: number;
  width: number;
  height: number;
  baseline: Rect;
  target: Rect;
} {
  const scale = Math.min(MAX_SCALE, Math.max(1, Math.ceil(MIN_SIDE / Math.min(box.w, box.h))));
  const dw = box.w * scale;
  const dh = box.h * scale;
  const rect = (dx: number): Rect => ({
    sx: box.x,
    sy: box.y,
    sw: box.w,
    sh: box.h,
    dx,
    dy: 0,
    dw,
    dh,
  });
  return {
    scale,
    width: 2 * dw + GAP_PX,
    height: dh,
    baseline: rect(0),
    target: rect(dw + GAP_PX),
  };
}

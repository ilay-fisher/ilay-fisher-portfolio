import type { Region } from './camera';
import type { Breakpoint } from './catalogue';

/** Width at which the layout switches from text-beside-scene to text-above-scene. */
export const DESKTOP_MIN_WIDTH = 900;

/** Bottom strip of a stacked (phone) canvas kept clear for the hint, hit counter and reset button. */
export const MOBILE_TOOLS_PX = 170;

/** Layout class for a viewport width. */
export function breakpointFor(width: number): Breakpoint {
  return width >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile';
}

/**
 * The part of the canvas where objects may live, in NDC. Beside the text column on wide screens
 * (the canvas still bleeds under it), below the text block when stacked.
 * @param canvas canvas size in CSS px
 * @param text right and bottom edges of the text block, in px relative to the canvas
 */
export function computeRegion(
  canvas: { width: number; height: number },
  text: { right: number; bottom: number },
  stacked = false,
): Region {
  if (stacked) {
    return {
      x0: -0.97,
      x1: 0.97,
      y0: -1 + (2 * MOBILE_TOOLS_PX) / canvas.height,
      y1: 1 - (2 * text.bottom) / canvas.height,
    };
  }
  return { x0: -1 + (2 * text.right) / canvas.width, x1: 0.98, y0: -0.84, y1: 0.9 };
}

import type { Region } from './camera';
import type { Breakpoint } from './catalogue';

/** Width at which the layout switches from text-beside-scene to text-above-scene. */
export const DESKTOP_MIN_WIDTH = 900;

/** Bottom strip of a stacked (phone) canvas kept clear for the hint, hit counter and reset button. */
export const MOBILE_TOOLS_PX = 170;

/**
 * Stage height a stacked (phone) hero always keeps under the text block. Hero.css sets the same value as the
 * layout's bottom padding and lets the hero grow with the text, so where iOS wraps the copy onto more lines the
 * stage moves down with it instead of the 3D name being pushed up into the buttons.
 */
export const MOBILE_SCENE_PX = 420;

/**
 * Clear space between the end of the text and the top of a stacked stage. The drawn lettering reaches a little above
 * its computed box (the lit top faces in perspective), so this is real air, not a rounding margin.
 */
export const MOBILE_TEXT_GAP_PX = 48;

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
      y1: 1 - (2 * (text.bottom + MOBILE_TEXT_GAP_PX)) / canvas.height,
    };
  }
  return { x0: -1 + (2 * text.right) / canvas.width, x1: 0.98, y0: -0.84, y1: 0.9 };
}

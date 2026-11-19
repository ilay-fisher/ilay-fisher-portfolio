/**
 * The real SafeGuard launcher icon ("Guarded Grid", light variant), as numbers. DOM-free.
 *
 * Source of truth is the app's `design/launcher-icon/guarded_grid_light.svg` (108 x 108 viewBox, white
 * background, art scaled 0.74 about the centre). Only the drawing is kept here, none of the file's metadata.
 * The scene builds it as real geometry: a ceramic white face, three raised blue tiles and a raised gold shield.
 */

/** Edge of the square face in artwork units: the 72 unit area an Android launcher shows of the 108 canvas. */
export const ICON_VIEW = 72;
/** Centre of the artwork canvas. */
const CENTRE = 54;
/** Scale of the art about the centre, as in the launcher's foreground layer. */
const ART_SCALE = 0.74;

/** Corner radius of the face as a share of its half width (a launcher squircle, drawn as a rounded square). */
export const ICON_FACE_CORNER = 0.44;

/** Top-left corners of the three blue tiles. */
export const ICON_TILES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 29, y: 29 },
  { x: 57, y: 29 },
  { x: 29, y: 57 },
];
/** Side of a tile. */
export const ICON_TILE_SIZE = 22;
/** Corner radius of a tile. */
export const ICON_TILE_RADIUS = 6.5;

/** Path commands of the shield, in artwork units (absolute). */
export type ShieldSegment =
  | { op: 'M' | 'L'; to: [number, number] }
  | { op: 'C'; c1: [number, number]; c2: [number, number]; to: [number, number] };

/** The gold shield in the fourth cell: `M68 57 C72.5 58.6 76 59.4 79 59.6 V68 C79 74.5 74.5 78.5 68 81 ...`. */
export const ICON_SHIELD = {
  x0: 57,
  x1: 79,
  y0: 57,
  y1: 81,
  path: [
    { op: 'M', to: [68, 57] },
    { op: 'C', c1: [72.5, 58.6], c2: [76, 59.4], to: [79, 59.6] },
    { op: 'L', to: [79, 68] },
    { op: 'C', c1: [79, 74.5], c2: [74.5, 78.5], to: [68, 81] },
    { op: 'C', c1: [61.5, 78.5], c2: [57, 74.5], to: [57, 68] },
    { op: 'L', to: [57, 59.6] },
    { op: 'C', c1: [60, 59.4], c2: [63.5, 58.6], to: [68, 57] },
  ] as ShieldSegment[],
} as const;

/** Blue tile gradient, start (29,29) to end (79,79). */
export const TILE_STOPS = ['#2E2A9E', '#3D7BF0'] as const;
/** Gold shield gradient, top to bottom of the shield. */
export const GOLD_STOPS = ['#FFD27A', '#FFC14A'] as const;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Position 0..1 along the blue gradient for an artwork point. */
export function tileAt(u: number, v: number): number {
  // Projection on the (29,29) to (79,79) diagonal.
  return clamp01((u - 29 + (v - 29)) / 100);
}

/** Position 0..1 along the gold gradient for an artwork y. */
export function goldAt(v: number): number {
  return clamp01((v - ICON_SHIELD.y0) / (ICON_SHIELD.y1 - ICON_SHIELD.y0));
}

/**
 * Artwork point to the face: centred on the face, art scale applied, y down becoming +z (toward the camera).
 * The result is in artwork units, so the face spans -36 to 36.
 */
export function iconToFace(u: number, v: number): { x: number; z: number } {
  return { x: (u - CENTRE) * ART_SCALE, z: (v - CENTRE) * ART_SCALE };
}

/** Inverse of `iconToFace`: a point on the face back to artwork coordinates (for colouring vertices). */
export function faceToIcon(x: number, z: number): { u: number; v: number } {
  return { u: x / ART_SCALE + CENTRE, v: z / ART_SCALE + CENTRE };
}

import { NAME_GLYPHS } from '../scene/nameGlyphs';

/** An axis-aligned box in world space (centre and half extents), used for static colliders. */
export interface Box {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
}

/** One letter placed in world space. `d` is an SVG-like path in em units; scale it by `scale`. */
export interface PlacedGlyph {
  ch: string;
  d: string;
  /** World x of the glyph origin. */
  ox: number;
  /** World y of the baseline (top of the plinth). */
  oy: number;
  scale: number;
  depth: number;
  /** Collider for the descender, when the letter has one (the y). */
  tail: Box | null;
}

/** The name as solid lettering: glyphs, plinth slabs, colliders, and where spawning must stay out. */
export interface NameLayout {
  width: number;
  height: number;
  depth: number;
  plinth: number;
  glyphs: PlacedGlyph[];
  /** Plinth slabs the letters stand on (static, same material family as the letters). */
  slabs: Box[];
  /** Every static collider (letters, tail, slabs) centred on x=0, z=0, standing on y=0. */
  colliders: Box[];
  keepOut: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const WORD_GAP_EM = 0.3;
const DESCENDER_MIN = -0.05;
const PAD_EM = 0.05;

/**
 * Lays out "Ilay Fisher" as heavy standing letters on low plinth slabs. The y keeps its tail:
 * the slab stops short of it so the tail reaches the floor. Everything is centred on x=0, z=0.
 */
export function layoutName(capHeight: number): NameLayout {
  const em = capHeight / NAME_GLYPHS.capHeight;
  const depth = capHeight * 0.66;
  const { Ilay, Fisher } = NAME_GLYPHS.words;
  const ilayRight = Math.max(...Ilay.map((g) => g.bbox[2]));
  const fisherOffset = ilayRight + WORD_GAP_EM - Fisher[0]!.bbox[0];
  const tails = [...Ilay, ...Fisher].filter((g) => g.tail && g.tail[1] < DESCENDER_MIN);
  const plinth = -Math.min(...tails.map((g) => g.tail![1])) * em;

  const placed = [
    ...Ilay.map((g) => ({ g, off: 0 })),
    ...Fisher.map((g) => ({ g, off: fisherOffset })),
  ];
  const colliders: Box[] = [];
  const glyphs: PlacedGlyph[] = [];
  const raw: { g: (typeof placed)[number]['g']; x: number }[] = placed.map(({ g, off }) => ({
    g,
    x: off,
  }));

  const box = (x0: number, x1: number, y0: number, y1: number, hz: number): Box => ({
    cx: ((x0 + x1) / 2) * em,
    cy: plinth + ((y0 + y1) / 2) * em,
    cz: 0,
    hx: ((x1 - x0) / 2) * em,
    hy: ((y1 - y0) / 2) * em,
    hz,
  });

  for (const { g, x } of raw) {
    const body = g.body ?? g.bbox;
    colliders.push(box(body[0] + x, body[2] + x, 0, body[3], depth / 2));
    let tail: Box | null = null;
    if (g.tail && g.tail[1] < DESCENDER_MIN) {
      tail = box(g.tail[0] + x, g.tail[2] + x, g.tail[1], 0, depth / 2);
      colliders.push(tail);
    }
    glyphs.push({ ch: g.ch, d: g.d, ox: x * em, oy: plinth, scale: em, depth, tail });
  }

  // Slabs: under "Ila" up to the y's tail, and under all of "Fisher".
  const slabDepth = depth + capHeight * 0.2;
  const yg = raw.find((r) => r.g.ch === 'y')!;
  const ilaStart = Ilay[0]!.bbox[0] - PAD_EM;
  const ilaEnd = yg.g.tail![0] + yg.x - 0.03;
  const fisherStart = Fisher[0]!.bbox[0] + fisherOffset - PAD_EM;
  const fisherEnd = Math.max(...Fisher.map((g) => g.bbox[2])) + fisherOffset + PAD_EM;
  const slabBox = (x0: number, x1: number): Box => ({
    cx: ((x0 + x1) / 2) * em,
    cy: plinth / 2,
    cz: 0,
    hx: ((x1 - x0) / 2) * em,
    hy: plinth / 2,
    hz: slabDepth / 2,
  });
  const slabs = [slabBox(ilaStart, ilaEnd), slabBox(fisherStart, fisherEnd)];
  colliders.push(...slabs);

  // Centre on x = 0 (ink plus slabs) and report the keep-out for spawning.
  const lo = Math.min(...colliders.map((b) => b.cx - b.hx));
  const hi = Math.max(...colliders.map((b) => b.cx + b.hx));
  const shift = -(lo + hi) / 2;
  for (const b of colliders) b.cx += shift;
  for (const g of glyphs) g.ox += shift;

  return {
    width: hi - lo,
    height: capHeight + plinth,
    depth,
    plinth,
    glyphs,
    slabs,
    colliders,
    keepOut: {
      minX: -(hi - lo) / 2 - 0.3,
      maxX: (hi - lo) / 2 + 0.3,
      minZ: -slabDepth / 2 - 0.1,
      maxZ: slabDepth / 2 + 0.35,
    },
  };
}

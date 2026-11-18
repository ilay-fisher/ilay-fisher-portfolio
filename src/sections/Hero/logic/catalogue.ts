/** The set of physical objects in the hero: what they are, how big, how heavy. DOM-free. */

/** The only words ever printed on a key: what Ilay works in (docs/CONTENT.md). */
export const LEGENDS = [
  'Kotlin',
  'Java',
  'C',
  'C++',
  'Python',
  'TypeScript',
  'React',
  'WASM',
  'TFLite',
  'PyTorch',
  'Firebase',
  'Node',
] as const;

/** One of the allowed key legends. */
export type Legend = (typeof LEGENDS)[number];
/** Layout class: phones get fewer, the same sized objects on a narrower floor. */
export type Breakpoint = 'desktop' | 'mobile';
/** Object families; each has its own geometry and collision shape. */
export type Kind = 'key' | 'dial' | 'toggle' | 'shield' | 'lock';
/** Surface treatment of the body. */
export type Finish = 'anodised' | 'ceramic' | 'alloy';

/** Everything the scene and physics need to build one object. Sizes are world units (a keycap is about 1). */
export interface ObjectSpec {
  id: string;
  kind: Kind;
  /** Accessible name, announced by the keyboard path ("Kotlin key"). */
  label: string;
  /** Printed legend for keys, otherwise null. */
  legend: Legend | null;
  size: { w: number; h: number; d: number };
  mass: number;
  /** Body (not just legend) carries the accent colour: two or three caps. */
  accentBody: boolean;
  /** Legend printed in the accent colour. */
  accentLegend: boolean;
  finish: Finish;
  /** 0..1 deterministic variation in roughness and tone so no two caps look identical. */
  shade: number;
}

const ACCENT_BODY: ReadonlySet<string> = new Set(['Kotlin', 'WASM', 'Node']);
const ACCENT_LEGEND: ReadonlySet<string> = new Set(['Python', 'React', 'TFLite', 'Firebase', 'C++']);
const FINISHES: Finish[] = ['anodised', 'ceramic', 'alloy', 'anodised', 'ceramic'];
const DENSITY = 2.2;
const KEY_HEIGHT = 0.62;

/** Key width grows with the legend so long words stay legible. */
function keyWidth(legend: string): number {
  if (legend.length <= 3) return 1;
  if (legend.length <= 5) return 1.25;
  if (legend.length <= 7) return 1.6;
  return 2;
}

const key = (legend: Legend, i: number): ObjectSpec => {
  const w = keyWidth(legend);
  return {
    id: `key-${legend.toLowerCase().replace(/\+/g, 'p')}`,
    kind: 'key',
    label: `${legend} key`,
    legend,
    size: { w, h: KEY_HEIGHT, d: 1 },
    mass: w * KEY_HEIGHT * DENSITY,
    accentBody: ACCENT_BODY.has(legend),
    accentLegend: ACCENT_LEGEND.has(legend),
    finish: FINISHES[i % FINISHES.length]!,
    shade: ((i * 37) % 100) / 100,
  };
};

const hardware = (
  kind: Exclude<Kind, 'key'>,
  label: string,
  w: number,
  h: number,
  d: number,
  finish: Finish,
  shade: number,
): ObjectSpec => ({
  id: kind,
  kind,
  label,
  legend: null,
  size: { w, h, d },
  mass: w * h * d * DENSITY * 0.9,
  accentBody: false,
  accentLegend: false,
  finish,
  shade,
});

const MOBILE_LEGENDS: Legend[] = [
  'Kotlin',
  'Python',
  'TypeScript',
  'React',
  'WASM',
  'TFLite',
  'Firebase',
  'Node',
  'C++',
];

/** Builds the object list for a breakpoint: legend keys first, then the hardware pieces. */
export function buildCatalogue(bp: Breakpoint): ObjectSpec[] {
  const legends: readonly Legend[] = bp === 'desktop' ? LEGENDS : MOBILE_LEGENDS;
  const pieces: ObjectSpec[] = [
    hardware('dial', 'Dial', 1.6, 0.62, 1.6, 'alloy', 0.3),
    hardware('toggle', 'Toggle switch', 1.7, 0.95, 1.1, 'anodised', 0.6),
    hardware('shield', 'Shield block', 1.3, 0.5, 1.55, 'ceramic', 0.45),
  ];
  if (bp === 'desktop') pieces.push(hardware('lock', 'Lock block', 1.3, 0.85, 1, 'anodised', 0.8));
  return [...legends.map(key), ...pieces];
}

/** Radius of a sphere that contains the object; used for spawn spacing and bounds. */
export function boundingRadius(s: ObjectSpec): number {
  return Math.hypot(s.size.w, s.size.d) / 2;
}

/** The set of physical objects in the hero: what they are, how big, how heavy. DOM-free. */

/** Importance tier: A is the owner's top skills (largest, accent), B the next three, C everything else. */
export type Tier = 'A' | 'B' | 'C';

/** One technology the owner works in (or a tool he names). The only things ever printed on a key. */
export interface Skill {
  id: string;
  /** Full name, used for the accessible label and the hover chip. */
  name: string;
  tier: Tier;
  /** simple-icons slug of the self-hosted mark (scene/marks.ts), or null when a text legend is used. */
  mark: string | null;
  /** Text printed instead of a mark, where no usable mark exists. */
  legend: string | null;
}

const skill = (
  id: string,
  name: string,
  tier: Tier,
  mark: string | null,
  legend: string | null = null,
): Skill => ({ id, name, tier, mark, legend });

/**
 * Importance order: the top of the owner's LinkedIn skills (Android Development to Python), then the rest
 * of the real stack from docs/CONTENT.md, then the tools he names. Nothing else may be added.
 */
export const SKILLS: readonly Skill[] = [
  skill('android', 'Android Development', 'A', 'android'),
  skill('java', 'Java', 'A', null, 'Java'),
  skill('kotlin', 'Kotlin', 'A', 'kotlin'),
  skill('ml', 'Machine Learning', 'A', null, 'ML'),
  skill('react', 'React', 'A', 'react'),
  skill('tflite', 'TensorFlow Lite', 'A', 'tensorflow'),
  skill('firebase', 'Firebase', 'A', 'firebase'),
  skill('c', 'C', 'B', null, 'C'),
  skill('git', 'Git', 'B', 'git'),
  skill('python', 'Python', 'B', 'python'),
  skill('compose', 'Jetpack Compose', 'C', 'jetpackcompose'),
  skill('typescript', 'TypeScript', 'C', 'typescript'),
  skill('node', 'Node.js', 'C', 'nodedotjs'),
  skill('pytorch', 'PyTorch', 'C', 'pytorch'),
  skill('onnx', 'ONNX', 'C', 'onnx'),
  skill('cpp', 'C++', 'C', 'cplusplus'),
  skill('wasm', 'WebAssembly', 'C', 'webassembly'),
  skill('docker', 'Docker', 'C', 'docker'),
  skill('postgresql', 'PostgreSQL', 'C', 'postgresql'),
  skill('fastapi', 'FastAPI', 'C', 'fastapi'),
  skill('opencv', 'OpenCV', 'C', 'opencv'),
  skill('github', 'GitHub', 'C', 'github'),
  skill('vscode', 'VS Code', 'C', null, 'VS Code'),
  skill('googlecloud', 'Google Cloud', 'C', 'googlecloud'),
  skill('claude', 'Claude', 'C', 'claude'),
];

/** Skill ids in importance order. */
export const IMPORTANCE: readonly string[] = SKILLS.map((s) => s.id);

/** Layout class: phones get fewer, the same sized objects on a narrower floor. */
export type Breakpoint = 'desktop' | 'mobile';
/** Object families; each has its own geometry and collision shape. */
export type Kind = 'key' | 'dial' | 'toggle' | 'shield' | 'lock' | 'phone' | 'drone' | 'lens';
/** Surface treatment of the body. */
export type Finish = 'anodised' | 'ceramic' | 'alloy';

/** Everything the scene and physics need to build one object. Sizes are world units (a keycap is about 1). */
export interface ObjectSpec {
  id: string;
  kind: Kind;
  /** Accessible name, announced by the keyboard path ("Kotlin key"). */
  label: string;
  /** Longer accessible description; for project pieces it says double-click or Enter jumps to the section. */
  description: string;
  /** Name shown in the hover chip. */
  name: string;
  /** simple-icons slug of the mark printed on a key, otherwise null. */
  mark: string | null;
  /** Text printed on a key that has no mark, otherwise null. */
  legend: string | null;
  /** Importance tier for keys, otherwise null. */
  tier: Tier | null;
  /** Position in the importance order (keys 0..24), hardware after the keys. */
  rank: number;
  /** In-page section a double-click or Enter scrolls to (project pieces), otherwise null. */
  href: string | null;
  size: { w: number; h: number; d: number };
  mass: number;
  /** Body (not just legend) carries the accent colour: the top three caps. */
  accentBody: boolean;
  /** Mark or legend printed in the accent colour: the top tier. */
  accentLegend: boolean;
  finish: Finish;
  /** 0..1 deterministic variation in roughness and tone so no two caps look identical. */
  shade: number;
}

const ACCENT_BODY: ReadonlySet<string> = new Set(['android', 'java', 'kotlin']);
const FINISHES: Finish[] = ['anodised', 'ceramic', 'alloy', 'anodised', 'ceramic'];
const DENSITY = 2.2;
/** Cap footprint (square side) and height per tier; heavier brass-weighted caps for the top tier. */
const TIER_SIZE: Record<Tier, { side: number; h: number; weight: number }> = {
  A: { side: 1.5, h: 0.7, weight: 1.25 },
  B: { side: 1.2, h: 0.62, weight: 1 },
  C: { side: 1, h: 0.6, weight: 1 },
};

const key = (s: Skill, rank: number): ObjectSpec => {
  const t = TIER_SIZE[s.tier];
  // Text legends of more than three characters on the small tier get a wider cap so they stay legible.
  const w = s.legend && s.legend.length > 3 && s.tier === 'C' ? 1.5 : t.side;
  return {
    id: `key-${s.id}`,
    kind: 'key',
    label: `${s.name} key`,
    description: `${s.name}, one of the technologies Ilay works with.`,
    name: s.name,
    mark: s.mark,
    legend: s.legend,
    tier: s.tier,
    rank,
    href: null,
    size: { w, h: t.h, d: t.side },
    mass: w * t.side * t.h * DENSITY * t.weight,
    accentBody: ACCENT_BODY.has(s.id),
    accentLegend: s.tier === 'A',
    finish: FINISHES[rank % FINISHES.length]!,
    shade: ((rank * 37) % 100) / 100,
  };
};

interface HardwareDef {
  kind: Exclude<Kind, 'key'>;
  label: string;
  /** What it is, in a sentence. */
  about: string;
  href: string | null;
  size: { w: number; h: number; d: number };
  /** Share of the bounding volume that is solid (a drone is mostly air). */
  fill: number;
  finish: Finish;
  shade: number;
}

const JUMP = ' Double-click or press Enter to jump to its section.';

const HARDWARE: Record<Exclude<Kind, 'key'>, HardwareDef> = {
  dial: {
    kind: 'dial',
    label: 'Dial',
    about: 'A machined alloy dial.',
    href: null,
    size: { w: 1.6, h: 0.62, d: 1.6 },
    fill: 0.9,
    finish: 'alloy',
    shade: 0.3,
  },
  toggle: {
    kind: 'toggle',
    label: 'Toggle switch',
    about: 'An anodised toggle switch.',
    href: null,
    size: { w: 1.7, h: 0.95, d: 1.1 },
    fill: 0.9,
    finish: 'anodised',
    shade: 0.6,
  },
  shield: {
    kind: 'shield',
    label: 'Shield block',
    about:
      'A shield block for SafeGuard, the device-owner app that locks the device around SafeSurf.',
    href: '#safesurf',
    size: { w: 1.3, h: 0.5, d: 1.55 },
    fill: 0.9,
    finish: 'ceramic',
    shade: 0.45,
  },
  lock: {
    kind: 'lock',
    label: 'Lock block',
    about: 'A lock block for SafeGuard, which locks the settings that allow bypass.',
    href: '#safesurf',
    size: { w: 1.3, h: 0.9, d: 1 },
    fill: 0.9,
    finish: 'anodised',
    shade: 0.8,
  },
  phone: {
    kind: 'phone',
    label: 'Phone slab',
    about: 'A small phone slab for SafeSurf, the filtered browser for Android.',
    href: '#safesurf',
    size: { w: 0.95, h: 0.24, d: 1.7 },
    fill: 0.9,
    finish: 'ceramic',
    shade: 0.55,
  },
  drone: {
    kind: 'drone',
    label: 'Quadcopter',
    about: 'A small quadcopter for the drone route sandbox.',
    href: '#drone',
    size: { w: 1.7, h: 0.42, d: 1.7 },
    fill: 0.3,
    finish: 'alloy',
    shade: 0.35,
  },
  lens: {
    kind: 'lens',
    label: 'Lens',
    about: 'A magnifier lens for X-Ray.',
    href: '#xray',
    size: { w: 1.2, h: 0.3, d: 2.1 },
    fill: 0.5,
    finish: 'anodised',
    shade: 0.5,
  },
};

const hardware = (kind: Exclude<Kind, 'key'>, rank: number): ObjectSpec => {
  const h = HARDWARE[kind];
  return {
    id: kind,
    kind,
    label: h.label,
    description: h.about + (h.href ? JUMP : ' Click to nudge it.'),
    name: h.label,
    mark: null,
    legend: null,
    tier: null,
    rank,
    href: h.href,
    size: { ...h.size },
    mass: h.size.w * h.size.h * h.size.d * DENSITY * h.fill,
    accentBody: false,
    accentLegend: false,
    finish: h.finish,
    shade: h.shade,
  };
};

/** Skills kept in each set, always in importance order (the top ten are in every set). */
const KEY_COUNT: Record<Breakpoint, { full: number; lite: number }> = {
  desktop: { full: 25, lite: 15 },
  mobile: { full: 13, lite: 10 },
};
/** Skills that fill the places after the top ten in the reduced sets, by importance. */
const EXTRA_KEYS: Record<Breakpoint, Record<'full' | 'lite', readonly string[]>> = {
  desktop: { full: [], lite: ['compose', 'typescript', 'node', 'github', 'claude'] },
  mobile: { full: ['compose', 'typescript', 'github'], lite: [] },
};
const HARDWARE_SETS: Record<Breakpoint, Record<'full' | 'lite', Exclude<Kind, 'key'>[]>> = {
  desktop: {
    full: ['dial', 'toggle', 'shield', 'lock', 'phone', 'drone', 'lens'],
    lite: ['shield', 'lock', 'phone', 'drone', 'lens'],
  },
  mobile: {
    full: ['toggle', 'shield', 'phone', 'drone', 'lens'],
    lite: ['shield', 'phone', 'drone', 'lens'],
  },
};

/**
 * Builds the object list for a breakpoint: skill keys in importance order, then the hardware pieces.
 * `lite` is the reduced set for software renderers and the lowest quality levels.
 */
export function buildCatalogue(bp: Breakpoint, lite = false): ObjectSpec[] {
  const set = lite ? 'lite' : 'full';
  const top = SKILLS.slice(0, 10);
  const want = new Set<string>([...top.map((s) => s.id), ...EXTRA_KEYS[bp][set]]);
  const skills = bp === 'desktop' && !lite ? SKILLS : SKILLS.filter((s) => want.has(s.id));
  const keys = skills.map((s) => key(s, IMPORTANCE.indexOf(s.id)));
  if (keys.length !== KEY_COUNT[bp][set]) throw new Error('catalogue key count drifted');
  const pieces = HARDWARE_SETS[bp][set].map((k, i) => hardware(k, SKILLS.length + i));
  return [...keys, ...pieces];
}

/** Text of the hover/grab chip: the name, with a hint on project pieces that open a section. */
export function chipLabel(s: ObjectSpec): string {
  return s.href ? `${s.name} · double-click to open` : s.name;
}

/** Radius of a sphere that contains the object; used for spawn spacing and bounds. */
export function boundingRadius(s: ObjectSpec): number {
  return Math.hypot(s.size.w, s.size.d) / 2;
}

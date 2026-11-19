/** The set of physical objects in the hero: what they are, how big, how heavy. DOM-free. */

import { profile } from '../../../content/profile';
import {
  BADGE_CORNER,
  DISC_PLATE_RADIUS,
  FILLED_TOKENS,
  roundedSquareOutline,
  tokenFootprint,
} from './token';

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
  skill('java', 'Java', 'A', 'java'),
  skill('kotlin', 'Kotlin', 'A', 'kotlin'),
  skill('ml', 'Machine Learning', 'A', null, 'ML'),
  skill('react', 'React', 'A', 'react'),
  skill('tflite', 'TensorFlow Lite', 'A', 'tensorflow'),
  skill('firebase', 'Firebase', 'A', 'firebase'),
  skill('c', 'C', 'B', 'c'),
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
/**
 * Object families; each has its own geometry and collision shape. A skill is a die-cut `token` (its logo's
 * silhouette extruded like an enamel pin), a `badge` (a logo that is itself a rounded tile, TypeScript and
 * LinkedIn: a bevelled tile in the brand colour with the letters raised) or a `key` (a keycap, for marks with
 * no usable outline). The rest are the owner's projects.
 */
export type Kind = 'key' | 'token' | 'badge' | 'shield' | 'logo' | 'drone' | 'lens';
export type ProjectKind = Exclude<Kind, 'key' | 'token' | 'badge'>;
/** Surface treatment of the body. */
export type Finish = 'anodised' | 'ceramic' | 'alloy';

/** Everything the scene and physics need to build one object. Sizes are world units (a keycap is about 0.6). */
export interface ObjectSpec {
  id: string;
  kind: Kind;
  /** Accessible name, announced by the keyboard path ("Kotlin token"). */
  label: string;
  /** Longer accessible description; for project pieces it says double-click or Enter jumps to the section. */
  description: string;
  /** Name shown in the hover chip. */
  name: string;
  /** simple-icons slug of the mark on a key or token, otherwise null. */
  mark: string | null;
  /** Text printed on a key that has no mark, otherwise null. */
  legend: string | null;
  /** Importance tier for keys and tokens, otherwise null. */
  tier: Tier | null;
  /** Position in the importance order (skills 0..24), project pieces after them. */
  rank: number;
  /** In-page section a double-click or Enter scrolls to (project pieces), otherwise null. */
  href: string | null;
  /** Profile a double-click or Enter opens in a new tab (GitHub, LinkedIn), otherwise null. Taken from the profile. */
  url: string | null;
  /** Final size in world units (already multiplied by `scale`). */
  size: { w: number; h: number; d: number };
  /** The breakpoint's piece scale that was applied to the size. */
  scale: number;
  /** Radius of the floor circle the footprint fits in (spawn spacing, stage fit). */
  radius: number;
  mass: number;
  /** Body (not just legend) carries the accent colour. No piece uses it now; kept for the keycap path. */
  accentBody: boolean;
  /** Mark or legend printed in the accent colour: the top tier. */
  accentLegend: boolean;
  finish: Finish;
  /** 0..1 deterministic variation in roughness and tone so no two pieces look identical. */
  shade: number;
}

/**
 * Pieces are this share of the original keycap size (1.0 to 1.5 units): small enough that thirty of them
 * lie loose on the floor instead of stacking on each other. The phone floor is narrower, so it keeps them
 * relatively larger.
 */
export const PIECE_SCALE: Record<Breakpoint, number> = { desktop: 0.6, mobile: 0.6 };

/** Skills printed on a keycap: those with no usable logo outline (ML and VS Code have no mark at all). */
const KEYCAPS: ReadonlySet<string> = new Set(['ml', 'vscode']);
/** Skills whose logo is itself a rounded tile: built as a badge, not a die-cut silhouette. */
const BADGES: ReadonlySet<string> = new Set(['typescript']);
/** Skill pieces that open the owner's profile, by the key of `profile.links`. */
const SKILL_LINKS: Readonly<Record<string, 'github' | 'linkedin'>> = { github: 'github' };
const FINISHES: Finish[] = ['anodised', 'ceramic', 'alloy', 'anodised', 'ceramic'];
const DENSITY = 2.2;
/** Longest plate side (token) or cap side (keycap) and height per tier, before PIECE_SCALE; top tier is heavier. */
const TIER_SIZE: Record<Tier, { side: number; h: number; weight: number }> = {
  A: { side: 1.5, h: 0.66, weight: 1.25 },
  B: { side: 1.2, h: 0.54, weight: 1 },
  C: { side: 1, h: 0.46, weight: 1 },
};
/** Token thickness as a share of the cap height: a chunky pin, thinner than a keycap. */
const TOKEN_THICK = 0.62;
/** Share of a token plate's bounding box that is solid, for mass. */
const TOKEN_FILL = 0.62;

/** Text of the hint on a piece that opens a profile (also the accessible description). */
const OPEN_PROFILE = (name: string) =>
  `Double-click or press Enter to open my ${name} profile in a new tab.`;

/** Edge of a badge tile and its thickness, from a tier's size. */
const badgeSize = (side: number, h: number, scale: number) => {
  const w = side * scale;
  const outline = roundedSquareOutline(BADGE_CORNER, 3);
  const radius = outline.reduce((m, [x, z]) => Math.max(m, Math.hypot(x, z)), 0) * (w / 2);
  return { size: { w, h: h * scale, d: w }, radius };
};

const skillPiece = (s: Skill, rank: number, scale: number): ObjectSpec => {
  const t = TIER_SIZE[s.tier];
  const isBadge = BADGES.has(s.id) && !!s.mark;
  const isKey = !isBadge && (KEYCAPS.has(s.id) || !s.mark);
  const link = SKILL_LINKS[s.id];
  const common = {
    label: link ? s.name : `${s.name} ${isKey ? 'key' : isBadge ? 'badge' : 'token'}`,
    description: link
      ? OPEN_PROFILE(s.name)
      : `${s.name}, one of the technologies Ilay works with.`,
    name: s.name,
    mark: s.mark,
    legend: s.legend,
    tier: s.tier,
    rank,
    href: null,
    url: link ? profile.links[link] : null,
    scale,
    accentLegend: s.tier === 'A',
    finish: FINISHES[rank % FINISHES.length]!,
    shade: ((rank * 37) % 100) / 100,
  };
  if (isKey) {
    // Text legends of more than three characters on the small tier get a wider cap so they stay legible.
    const w = (s.legend && s.legend.length > 3 && s.tier === 'C' ? 1.5 : t.side) * scale;
    const d = t.side * scale;
    const h = t.h * scale;
    return {
      ...common,
      id: `key-${s.id}`,
      kind: 'key',
      size: { w, h, d },
      radius: Math.hypot(w, d) / 2,
      mass: w * d * h * DENSITY * t.weight,
      accentBody: false,
    };
  }
  if (isBadge) {
    const b = badgeSize(t.side, t.h * 0.8, scale);
    return {
      ...common,
      id: `badge-${s.id}`,
      kind: 'badge',
      size: b.size,
      radius: b.radius,
      mass: b.size.w * b.size.d * b.size.h * DENSITY * t.weight * 0.9,
      accentBody: false,
    };
  }
  // A filled disc (GitHub) is sized by its plate diameter to match the LinkedIn tile's side (tier B).
  const tb = FILLED_TOKENS.has(s.mark!) ? TIER_SIZE.B : t;
  const unit1 = tokenFootprint(s.mark!, 1).unit;
  const maxDim = FILLED_TOKENS.has(s.mark!)
    ? (tb.side * scale) / (2 * DISC_PLATE_RADIUS * unit1)
    : t.side * scale;
  const f = tokenFootprint(s.mark!, maxDim);
  const h = tb.h * TOKEN_THICK * scale;
  return {
    ...common,
    id: `token-${s.id}`,
    kind: 'token',
    size: { w: f.w, h, d: f.d },
    radius: f.radius,
    mass: f.w * f.d * h * DENSITY * t.weight * TOKEN_FILL,
    accentBody: false,
  };
};

interface ProjectDef {
  kind: ProjectKind;
  /** Accessible name. */
  label: string;
  /** Name in the hover chip: the project it stands for. */
  name: string;
  /** What it is, in a sentence. */
  about: string;
  href: string;
  /** Size before PIECE_SCALE. */
  size: { w: number; h: number; d: number };
  /** Footprint circle radius before PIECE_SCALE. */
  radius: number;
  /** Share of the bounding volume that is solid (a drone is mostly air). */
  fill: number;
  finish: Finish;
  shade: number;
}

const JUMP = ' Double-click or press Enter to jump to its section.';

const PROJECTS: Record<ProjectKind, ProjectDef> = {
  shield: {
    kind: 'shield',
    label: 'SafeGuard app icon',
    name: 'SafeGuard',
    about:
      'The launcher icon of SafeGuard, the device-owner app that locks the device around SafeSurf: three blue tiles and a gold shield.',
    href: '#safesurf',
    size: { w: 1.7, h: 0.42, d: 1.7 },
    radius: 1.05,
    fill: 0.9,
    finish: 'ceramic',
    shade: 0.45,
  },
  logo: {
    kind: 'logo',
    label: 'SafeSurf logo',
    name: 'SafeSurf',
    about: 'The SafeSurf logo, the filtered browser for Android.',
    href: '#safesurf',
    size: { w: 1.9, h: 0.4, d: 1.9 },
    radius: 0.97,
    fill: 0.8,
    finish: 'ceramic',
    shade: 0.55,
  },
  drone: {
    kind: 'drone',
    label: 'Drone Sandbox quadcopter',
    name: 'Drone Sandbox',
    about: 'A quadcopter for Drone Sandbox, the browser drone route simulator.',
    href: '#drone',
    size: { w: 1.9, h: 0.42, d: 1.9 },
    radius: 1.2,
    fill: 0.3,
    finish: 'alloy',
    shade: 0.35,
  },
  lens: {
    kind: 'lens',
    label: 'X-Ray magnifier',
    name: 'X-Ray',
    about: 'A magnifier over a circuit for X-Ray, the PCB inspection demo.',
    href: '#xray',
    size: { w: 1.35, h: 0.34, d: 2.2 },
    radius: 1.15,
    fill: 0.5,
    finish: 'anodised',
    shade: 0.5,
  },
};

const projectPiece = (kind: ProjectKind, rank: number, scale: number): ObjectSpec => {
  const h = PROJECTS[kind];
  const size = { w: h.size.w * scale, h: h.size.h * scale, d: h.size.d * scale };
  return {
    id: kind,
    kind,
    label: h.label,
    description: h.about + JUMP,
    name: h.name,
    mark: null,
    legend: null,
    tier: null,
    rank,
    href: h.href,
    url: null,
    size,
    scale,
    radius: h.radius * scale,
    mass: size.w * size.h * size.d * DENSITY * h.fill,
    accentBody: false,
    accentLegend: false,
    finish: h.finish,
    shade: h.shade,
  };
};

/**
 * The LinkedIn piece: the official mark is a rounded blue tile with a white "in", so it is a badge, sized like a
 * tier B token. It is not a skill (no tier), it opens the owner's profile.
 */
const linkedinPiece = (rank: number, scale: number): ObjectSpec => {
  const t = TIER_SIZE.B;
  const b = badgeSize(t.side, t.h * 0.8, scale);
  return {
    id: 'linkedin',
    kind: 'badge',
    label: 'LinkedIn',
    description: OPEN_PROFILE('LinkedIn'),
    name: 'LinkedIn',
    mark: 'linkedin',
    legend: null,
    tier: null,
    rank,
    href: null,
    url: profile.links.linkedin,
    size: b.size,
    scale,
    radius: b.radius,
    mass: b.size.w * b.size.d * b.size.h * DENSITY * t.weight * 0.9,
    accentBody: false,
    accentLegend: false,
    finish: 'ceramic',
    shade: 0.5,
  };
};

/** Skills kept in each set, always in importance order (the top ten are in every set, bar one on a phone's lite set). */
const KEY_COUNT: Record<Breakpoint, { full: number; lite: number }> = {
  desktop: { full: 25, lite: 15 },
  mobile: { full: 13, lite: 10 },
};
/**
 * How many of the top ten skills each set keeps. A phone's lite set is the tightest floor: GitHub joins it (it is
 * a link piece, in every layout), so Python, the last of the top ten, is the one skill piece given up.
 */
const TOP_COUNT: Record<Breakpoint, Record<'full' | 'lite', number>> = {
  desktop: { full: 10, lite: 10 },
  mobile: { full: 10, lite: 9 },
};
/** Skills that fill the places after the top ten in the reduced sets, by importance. */
const EXTRA_KEYS: Record<Breakpoint, Record<'full' | 'lite', readonly string[]>> = {
  desktop: { full: [], lite: ['compose', 'typescript', 'node', 'github', 'claude'] },
  mobile: { full: ['compose', 'typescript', 'github'], lite: ['github'] },
};
const PROJECT_SETS: Record<Breakpoint, Record<'full' | 'lite', ProjectKind[]>> = {
  desktop: {
    full: ['shield', 'logo', 'drone', 'lens'],
    lite: ['shield', 'logo', 'drone', 'lens'],
  },
  mobile: {
    full: ['shield', 'logo', 'drone', 'lens'],
    lite: ['shield', 'logo', 'drone', 'lens'],
  },
};

/**
 * Builds the object list for a breakpoint: skill tokens and keys in importance order, then the project pieces.
 * `lite` is the reduced set for software renderers and the lowest quality levels.
 */
export function buildCatalogue(bp: Breakpoint, lite = false): ObjectSpec[] {
  const set = lite ? 'lite' : 'full';
  const top = SKILLS.slice(0, TOP_COUNT[bp][set]);
  const want = new Set<string>([...top.map((s) => s.id), ...EXTRA_KEYS[bp][set]]);
  const skills = bp === 'desktop' && !lite ? SKILLS : SKILLS.filter((s) => want.has(s.id));
  const scale = PIECE_SCALE[bp];
  const keys = skills.map((s) => skillPiece(s, IMPORTANCE.indexOf(s.id), scale));
  if (keys.length !== KEY_COUNT[bp][set]) throw new Error('catalogue key count drifted');
  const pieces = PROJECT_SETS[bp][set].map((k, i) => projectPiece(k, SKILLS.length + i, scale));
  return [...keys, ...pieces, linkedinPiece(SKILLS.length + pieces.length, scale)];
}

/** True for a piece a double-click or Enter does something with: a project section or a profile. */
export function isOpenable(s: ObjectSpec): boolean {
  return s.href !== null || s.url !== null;
}

/** Text of the hover/grab chip: the name, with a hint on pieces that open a section or a profile. */
export function chipLabel(s: ObjectSpec): string {
  if (s.url) return `${s.name} · double-click to open profile`;
  return s.href ? `${s.name} · double-click to open` : s.name;
}

/** Radius of a sphere about the object's centre that contains it; used for bounds and spawn height. */
export function boundingRadius(s: ObjectSpec): number {
  return s.radius;
}

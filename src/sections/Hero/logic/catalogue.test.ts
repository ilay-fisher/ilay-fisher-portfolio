import { describe, expect, it } from 'vitest';
import { MARKS } from '../scene/marks';
import {
  boundingRadius,
  buildCatalogue,
  chipLabel,
  IMPORTANCE,
  PIECE_SCALE,
  SKILLS,
  type ObjectSpec,
} from './catalogue';

/** Importance order given by the owner (top of his LinkedIn skills), then the rest of the real stack, then tools. */
const TOP_TEN = [
  'android',
  'java',
  'kotlin',
  'ml',
  'react',
  'tflite',
  'firebase',
  'c',
  'git',
  'python',
];
const OTHER_STACK = [
  'compose',
  'typescript',
  'node',
  'pytorch',
  'onnx',
  'cpp',
  'wasm',
  'docker',
  'postgresql',
  'fastapi',
  'opencv',
];
const TOOLS = ['github', 'vscode', 'googlecloud', 'claude'];
const ALLOWED = [...TOP_TEN, ...OTHER_STACK, ...TOOLS];

/** Every piece that stands for a skill: a die-cut token or a keycap. */
const keys = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'key' || s.kind === 'token');
const keycaps = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'key');
const tokens = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'token');
const hardware = (list: ObjectSpec[]) => list.filter((s) => s.kind !== 'key' && s.kind !== 'token');
/** Skill ids as they appear in piece ids, which are prefixed `key-` or `token-`. */
const skillOf = (s: ObjectSpec) => s.id.replace(/^(key|token)-/, '');

describe('catalogue allowed list and importance order', () => {
  it('only ever contains what the owner works in (no invented skills)', () => {
    expect(SKILLS.map((s) => s.id)).toEqual(ALLOWED);
    expect(IMPORTANCE).toEqual(ALLOWED);
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true])
        for (const s of keys(buildCatalogue(bp, lite))) expect(ALLOWED).toContain(skillOf(s));
  });

  it('keeps the owner order: the first ten are his top skills, in order', () => {
    const desk = keys(buildCatalogue('desktop')).map(skillOf);
    expect(desk.slice(0, 10)).toEqual(TOP_TEN);
    expect(desk).toEqual(ALLOWED);
    const ranks = keys(buildCatalogue('desktop')).map((s) => s.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('every smaller catalogue keeps the top skills first and in the same order', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true]) {
        const ids = keys(buildCatalogue(bp, lite)).map(skillOf);
        expect(ids.slice(0, 10)).toEqual(TOP_TEN);
        const order = ids.map((id) => ALLOWED.indexOf(id));
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
  });
});

describe('body counts per breakpoint', () => {
  const PROJECT_PIECES = ['drone', 'lens', 'lock', 'phone', 'shield'];

  it('desktop has 30 bodies: 25 skill pieces plus the 5 project pieces, nothing generic', () => {
    const c = buildCatalogue('desktop');
    expect(c).toHaveLength(30);
    expect(keys(c)).toHaveLength(25);
    expect(
      hardware(c)
        .map((s) => s.kind)
        .sort(),
    ).toEqual(PROJECT_PIECES);
  });

  it('mobile has 17 bodies, fewer than desktop, and still has the project pieces', () => {
    const c = buildCatalogue('mobile');
    expect(c).toHaveLength(17);
    expect(keys(c)).toHaveLength(13);
    const kinds = hardware(c).map((s) => s.kind);
    for (const k of ['phone', 'shield', 'drone', 'lens']) expect(kinds).toContain(k);
  });

  it('lite sets (software renderers, lowest quality) are smaller still', () => {
    expect(buildCatalogue('desktop', true)).toHaveLength(20);
    expect(buildCatalogue('mobile', true)).toHaveLength(14);
    expect(buildCatalogue('desktop', true).length).toBeLessThan(buildCatalogue('desktop').length);
    expect(buildCatalogue('mobile', true).length).toBeLessThan(buildCatalogue('mobile').length);
  });

  it('never contains a generic piece: only technologies and projects (no dial, no toggle)', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true])
        for (const s of buildCatalogue(bp, lite))
          expect(['key', 'token', 'shield', 'lock', 'phone', 'drone', 'lens']).toContain(s.kind);
  });

  it('has unique ids and positive masses and sizes', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true]) {
        const c = buildCatalogue(bp, lite);
        expect(new Set(c.map((s) => s.id)).size).toBe(c.length);
        for (const s of c) {
          expect(s.mass).toBeGreaterThan(0);
          expect(s.size.w).toBeGreaterThan(0);
          expect(s.size.h).toBeGreaterThan(0);
          expect(s.size.d).toBeGreaterThan(0);
          expect(boundingRadius(s)).toBeGreaterThan(0.3);
        }
      }
  });
});

describe('piece sizes per breakpoint', () => {
  it('shrinks desktop pieces to about 55-65 percent of the old keycap sizes', () => {
    expect(PIECE_SCALE.desktop).toBeGreaterThanOrEqual(0.55);
    expect(PIECE_SCALE.desktop).toBeLessThanOrEqual(0.65);
    const caps = keycaps(buildCatalogue('desktop'));
    const widest = Math.max(...caps.map((s) => Math.max(s.size.w, s.size.d)));
    // The old widest keycap was 1.5 world units.
    expect(widest).toBeLessThanOrEqual(1.5 * 0.65 + 1e-9);
    expect(widest).toBeGreaterThanOrEqual(1.5 * 0.55 - 1e-9);
  });

  it('keeps pieces smaller on desktop than the old 1.0-1.5 caps at every breakpoint', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const s of buildCatalogue(bp)) {
        expect(Math.max(s.size.w, s.size.d)).toBeLessThan(1.5);
        expect(boundingRadius(s)).toBeLessThan(1.2);
      }
  });

  it('makes tokens and keycaps shrink by tier: A larger than B larger than C', () => {
    const c = buildCatalogue('desktop');
    const dim = (s: ObjectSpec) => Math.max(s.size.w, s.size.d);
    for (const group of [keycaps(c), tokens(c)]) {
      const by = (t: string) => group.filter((s) => s.tier === t).map(dim);
      const min = (a: number[]) => Math.min(...a);
      const max = (a: number[]) => Math.max(...a);
      if (by('B').length) expect(min(by('A'))).toBeGreaterThan(max(by('B')) - 1e-9);
      if (by('B').length) expect(min(by('B'))).toBeGreaterThan(max(by('C')) - 1e-9);
      expect(min(by('A'))).toBeGreaterThan(max(by('C')));
    }
  });

  it('keeps the phone, drone and lens big enough to read at a glance (at least a tier B token)', () => {
    const c = buildCatalogue('desktop');
    const dim = (s: ObjectSpec) => Math.max(s.size.w, s.size.d);
    const tierB = Math.min(
      ...tokens(c)
        .filter((s) => s.tier === 'B')
        .map(dim),
    );
    for (const kind of ['phone', 'drone', 'lens', 'shield', 'lock'])
      expect(dim(c.find((s) => s.kind === kind)!)).toBeGreaterThanOrEqual(tierB);
  });
});

describe('importance drives size, weight and accent', () => {
  const k = keys(buildCatalogue('desktop'));
  const tier = (t: string) => k.filter((s) => s.tier === t);

  it('puts the top seven in tier A, the next three in B and everything else in C', () => {
    expect(tier('A').map((s) => s.id.replace(/^(key|token)-/, ''))).toEqual(TOP_TEN.slice(0, 7));
    expect(tier('B').map((s) => s.id.replace(/^(key|token)-/, ''))).toEqual(TOP_TEN.slice(7));
    expect(tier('C')).toHaveLength(15);
  });

  it('makes tier A the heaviest, then B, then C', () => {
    const avg = (a: ObjectSpec[]) => a.reduce((n, s) => n + s.mass, 0) / a.length;
    expect(avg(tier('A'))).toBeGreaterThan(avg(tier('B')));
    expect(avg(tier('B'))).toBeGreaterThan(avg(tier('C')));
  });

  it('gives the accent body to the keycap caps of tier A only (tokens wear their own brand colours)', () => {
    for (const s of tier('A')) expect(s.accentLegend).toBe(true);
    expect(
      tier('A')
        .filter((s) => s.accentBody)
        .map((s) => s.id),
    ).toEqual(['key-java']);
    for (const s of [...tier('B'), ...tier('C')]) {
      expect(s.accentLegend).toBe(false);
      expect(s.accentBody).toBe(false);
    }
  });
});

describe('die-cut tokens and keycaps', () => {
  const all = buildCatalogue('desktop');
  const k = keys(all);
  const byId = (id: string) => k.find((s) => s.id.endsWith(`-${id}`))!;

  it('turns every skill that has a usable logo into a die-cut token, except two kept as keys for variety', () => {
    expect(
      tokens(all)
        .map((s) => s.id.replace(/^token-/, ''))
        .sort(),
    ).toEqual(
      [
        'android',
        'kotlin',
        'tflite',
        'react',
        'firebase',
        'git',
        'python',
        'compose',
        'node',
        'pytorch',
        'onnx',
        'cpp',
        'wasm',
        'docker',
        'postgresql',
        'fastapi',
        'opencv',
        'googlecloud',
        'claude',
      ].sort(),
    );
    for (const s of tokens(all)) {
      expect(s.mark).toBeTruthy();
      expect(s.legend).toBeNull();
    }
  });

  it('keeps a handful of real keycaps: the four skills without a mark, plus TypeScript and GitHub', () => {
    expect(keycaps(all).map((s) => s.id.replace(/^key-/, ''))).toEqual([
      'java',
      'ml',
      'c',
      'typescript',
      'github',
      'vscode',
    ]);
    expect(keycaps(all).length).toBeGreaterThanOrEqual(4);
    expect(keycaps(all).length).toBeLessThanOrEqual(7);
    expect(tokens(all).length).toBeGreaterThan(keycaps(all).length * 2);
  });

  it('prints exactly one of a logo mark or a text legend on every keycap, and a mark on every token', () => {
    for (const s of keycaps(all)) expect(Boolean(s.mark) !== Boolean(s.legend)).toBe(true);
    for (const s of hardware(all)) {
      expect(s.mark).toBeNull();
      expect(s.legend).toBeNull();
    }
  });

  it('uses a text legend only where no mark is available or the owner has none', () => {
    const text = keycaps(all)
      .filter((s) => s.legend)
      .map((s) => s.id.replace(/^key-/, ''));
    expect(text).toEqual(['java', 'ml', 'c', 'vscode']);
    expect(byId('java').legend).toBe('Java');
    expect(byId('vscode').legend).toBe('VS Code');
    expect(byId('ml').legend).toBe('ML');
    expect(byId('c').legend).toBe('C');
  });

  it('has a self-hosted mark for every mark reference, with source and licence recorded', () => {
    const marked = k.filter((s) => s.mark);
    expect(marked).toHaveLength(21);
    for (const s of marked) {
      const m = MARKS[s.mark!];
      expect(m, `mark ${s.mark}`).toBeDefined();
      expect(m!.path.length).toBeGreaterThan(15);
      expect(m!.hex).toMatch(/^[0-9A-F]{6}$/);
      expect(m!.source).toMatch(/^https:\/\//);
      expect(m!.licence.length).toBeGreaterThan(2);
    }
  });
});

describe('accessible names and project pieces', () => {
  it('gives every object an accessible name and a description', () => {
    for (const s of buildCatalogue('desktop')) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.description.length).toBeGreaterThan(s.label.length);
    }
    const k = keys(buildCatalogue('desktop'));
    expect(k[0]!.label).toBe('Android Development token');
    expect(k.find((s) => s.id === 'token-tflite')!.label).toBe('TensorFlow Lite token');
    expect(k.find((s) => s.id === 'key-java')!.label).toBe('Java key');
  });

  it('links the project pieces to their sections and says so in the description', () => {
    const h = (kind: string) => hardware(buildCatalogue('desktop')).find((s) => s.kind === kind)!;
    expect(h('phone').href).toBe('#safesurf');
    expect(h('shield').href).toBe('#safesurf');
    expect(h('lock').href).toBe('#safesurf');
    expect(h('drone').href).toBe('#drone');
    expect(h('lens').href).toBe('#xray');
    for (const kind of ['phone', 'shield', 'lock', 'drone', 'lens'])
      expect(h(kind).description).toMatch(/double-click or press enter/i);
    for (const s of keys(buildCatalogue('desktop'))) expect(s.href).toBeNull();
  });

  it('words the hover chip: the name, plus a hint on project pieces', () => {
    const all = buildCatalogue('desktop');
    expect(chipLabel(all.find((s) => s.id === 'token-kotlin')!)).toBe('Kotlin');
    expect(chipLabel(all.find((s) => s.id === 'phone')!)).toBe('SafeSurf · double-click to open');
    expect(chipLabel(all.find((s) => s.id === 'shield')!)).toBe('SafeGuard · double-click to open');
    expect(chipLabel(all.find((s) => s.id === 'lock')!)).toBe('SafeGuard · double-click to open');
    expect(chipLabel(all.find((s) => s.id === 'drone')!)).toBe(
      'Drone Sandbox · double-click to open',
    );
    expect(chipLabel(all.find((s) => s.id === 'lens')!)).toBe('X-Ray · double-click to open');
  });
});

import { describe, expect, it } from 'vitest';
import { profile } from '../../../content/profile';
import { MARKS } from '../scene/marks';
import {
  boundingRadius,
  buildCatalogue,
  chipLabel,
  IMPORTANCE,
  isOpenable,
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

/** Every piece that stands for a skill: a die-cut token, a logo badge or a keycap (they all carry a tier). */
const keys = (list: ObjectSpec[]) => list.filter((s) => s.tier !== null);
const keycaps = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'key');
const tokens = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'token');
const badges = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'badge' && s.tier !== null);
/** The owner's projects: no tier, not the LinkedIn piece. */
const hardware = (list: ObjectSpec[]) => list.filter((s) => s.tier === null && s.id !== 'linkedin');
/** Skill ids as they appear in piece ids, which are prefixed `key-`, `token-` or `badge-`. */
const skillOf = (s: ObjectSpec) => s.id.replace(/^(key|token|badge)-/, '');

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
        // The phone's reduced set gives up Python, the last of the top ten, to make room for GitHub.
        const top = bp === 'mobile' && lite ? 9 : 10;
        expect(ids.slice(0, top)).toEqual(TOP_TEN.slice(0, top));
        const order = ids.map((id) => ALLOWED.indexOf(id));
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
  });
});

describe('body counts per breakpoint', () => {
  const PROJECT_PIECES = ['drone', 'lens', 'logo', 'shield'];

  it('desktop has 30 bodies: 25 skill pieces, the LinkedIn piece and the 4 project pieces, nothing generic', () => {
    const c = buildCatalogue('desktop');
    expect(c).toHaveLength(30);
    expect(keys(c)).toHaveLength(25);
    expect(
      hardware(c)
        .map((s) => s.kind)
        .sort(),
    ).toEqual(PROJECT_PIECES);
  });

  it('mobile has 18 bodies, fewer than desktop, and still has the project pieces', () => {
    const c = buildCatalogue('mobile');
    expect(c).toHaveLength(18);
    expect(keys(c)).toHaveLength(13);
    const kinds = hardware(c).map((s) => s.kind);
    for (const k of ['logo', 'shield', 'drone', 'lens']) expect(kinds).toContain(k);
  });

  it('lite sets (software renderers, lowest quality) are smaller still', () => {
    expect(buildCatalogue('desktop', true)).toHaveLength(20);
    expect(buildCatalogue('mobile', true)).toHaveLength(15);
    expect(buildCatalogue('desktop', true).length).toBeLessThan(buildCatalogue('desktop').length);
    expect(buildCatalogue('mobile', true).length).toBeLessThan(buildCatalogue('mobile').length);
  });

  it('never contains a generic piece: only technologies and projects (no dial, no toggle)', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true])
        for (const s of buildCatalogue(bp, lite))
          expect(['key', 'token', 'badge', 'shield', 'logo', 'drone', 'lens']).toContain(s.kind);
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

  it('keeps every skill piece under the old 1.5 cap at every breakpoint, and project pieces modest', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const s of buildCatalogue(bp)) {
        const dim = Math.max(s.size.w, s.size.d);
        if (s.tier !== null || s.id === 'linkedin') expect(dim).toBeLessThan(1.5);
        else expect(dim).toBeLessThan(2);
        expect(boundingRadius(s)).toBeLessThan(1.2);
      }
  });

  it('makes tokens and keycaps shrink by tier: A larger than B larger than C', () => {
    const c = buildCatalogue('desktop');
    // GitHub is a filled disc sized to the LinkedIn tile on purpose, so it is outside the tier ladder.
    for (const group of [keycaps(c), tokens(c).filter((s) => s.mark !== 'github')]) {
      // A keycap's size is its depth (a wide legend only stretches the width); a token's is its longest side.
      const dim = (s: ObjectSpec) => (s.kind === 'key' ? s.size.d : Math.max(s.size.w, s.size.d));
      const by = (t: string) => group.filter((s) => s.tier === t).map(dim);
      const min = (a: number[]) => Math.min(...a);
      const max = (a: number[]) => Math.max(...a);
      if (by('B').length) expect(min(by('A'))).toBeGreaterThan(max(by('B')) - 1e-9);
      if (by('B').length) expect(min(by('B'))).toBeGreaterThan(max(by('C')) - 1e-9);
      expect(min(by('A'))).toBeGreaterThan(max(by('C')));
    }
  });

  it('sizes the GitHub disc to the LinkedIn tile: plate diameter equals its side, collider follows', () => {
    const c = buildCatalogue('desktop');
    const gh = c.find((s) => s.id === 'token-github')!;
    const li = c.find((s) => s.id === 'linkedin')!;
    // The plate is 25.9 mark units of a collider that spans 27.2.
    const plate = Math.max(gh.size.w, gh.size.d) * (25.9 / 27.2);
    expect(plate).toBeCloseTo(li.size.w, 2);
    expect(gh.radius).toBeGreaterThanOrEqual(plate / 2);
  });

  it('keeps the logo, drone, lens and shield big enough to read at a glance (at least a tier B token)', () => {
    const c = buildCatalogue('desktop');
    const dim = (s: ObjectSpec) => Math.max(s.size.w, s.size.d);
    const tierB = Math.min(
      ...tokens(c)
        .filter((s) => s.tier === 'B')
        .map(dim),
    );
    for (const kind of ['logo', 'drone', 'lens', 'shield'])
      expect(dim(c.find((s) => s.kind === kind)!)).toBeGreaterThanOrEqual(tierB);
  });

  it('makes the SafeSurf logo one of the larger pieces, at least as large as any tier A token', () => {
    const c = buildCatalogue('desktop');
    const dim = (s: ObjectSpec) => Math.max(s.size.w, s.size.d);
    const tierA = Math.max(
      ...tokens(c)
        .filter((s) => s.tier === 'A')
        .map(dim),
    );
    expect(dim(c.find((s) => s.kind === 'logo')!)).toBeGreaterThan(tierA);
  });
});

describe('importance drives size, weight and accent', () => {
  const k = keys(buildCatalogue('desktop'));
  const tier = (t: string) => k.filter((s) => s.tier === t);

  it('puts the top seven in tier A, the next three in B and everything else in C', () => {
    expect(tier('A').map(skillOf)).toEqual(TOP_TEN.slice(0, 7));
    expect(tier('B').map(skillOf)).toEqual(TOP_TEN.slice(7));
    expect(tier('C')).toHaveLength(15);
  });

  it('makes tier A the heaviest, then B, then C', () => {
    const avg = (a: ObjectSpec[]) => a.reduce((n, s) => n + s.mass, 0) / a.length;
    expect(avg(tier('A'))).toBeGreaterThan(avg(tier('B')));
    expect(avg(tier('B'))).toBeGreaterThan(avg(tier('C')));
  });

  it('gives the accent legend to tier A only (tokens wear their own brand colours)', () => {
    for (const s of tier('A')) expect(s.accentLegend).toBe(true);
    expect(tier('A').filter((s) => s.accentBody)).toEqual([]);
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

  it('turns every skill that has a usable logo into a die-cut token, except a few kept as keys for variety', () => {
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
        'java',
        'c',
        'wasm',
        'docker',
        'postgresql',
        'fastapi',
        'opencv',
        'googlecloud',
        'claude',
        'github',
      ].sort(),
    );
    for (const s of tokens(all)) {
      expect(s.mark).toBeTruthy();
      expect(s.legend).toBeNull();
    }
  });

  it('keeps only two real keycaps, the ones with no usable mark: ML and VS Code', () => {
    expect(keycaps(all).map((s) => s.id.replace(/^key-/, ''))).toEqual(['ml', 'vscode']);
    expect(tokens(all).length).toBeGreaterThan(keycaps(all).length * 2);
  });

  it('makes TypeScript a blue logo badge with no box and no link', () => {
    const ts = badges(all);
    expect(ts.map(skillOf)).toEqual(['typescript']);
    expect(ts[0]!.id).toBe('badge-typescript');
    expect(ts[0]!.mark).toBe('typescript');
    expect(ts[0]!.legend).toBeNull();
    expect(MARKS.typescript!.hex).toBe('3178C6');
    expect(isOpenable(ts[0]!)).toBe(false);
    expect(ts[0]!.size.w).toBeCloseTo(ts[0]!.size.d, 9);
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
    expect(text).toEqual(['ml', 'vscode']);
    expect(byId('vscode').legend).toBe('VS Code');
    expect(byId('ml').legend).toBe('ML');
    expect(byId('java').mark).toBe('java');
    expect(byId('c').mark).toBe('c');
  });

  it('has a self-hosted mark for every mark reference, with source and licence recorded', () => {
    const marked = k.filter((s) => s.mark);
    expect(marked).toHaveLength(23);
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

describe('one piece per project', () => {
  it('has exactly one piece for each of SafeSurf, SafeGuard, Drone Sandbox and X-Ray at every size', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true]) {
        const names = hardware(buildCatalogue(bp, lite)).map((s) => s.name);
        expect(names.sort()).toEqual(['Drone Sandbox', 'SafeGuard', 'SafeSurf', 'X-Ray']);
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
    for (const s of buildCatalogue('desktop')) expect(s.label.length).toBeGreaterThan(2);
    expect(k.find((s) => s.id === 'token-tflite')!.label).toBe('TensorFlow Lite token');
    expect(k.find((s) => s.id === 'token-java')!.label).toBe('Java token');
  });

  it('links the project pieces to their sections and says so in the description', () => {
    const h = (kind: string) => hardware(buildCatalogue('desktop')).find((s) => s.kind === kind)!;
    expect(h('logo').href).toBe('#safesurf');
    expect(h('shield').href).toBe('#safesurf');
    expect(h('drone').href).toBe('#drone');
    expect(h('lens').href).toBe('#xray');
    for (const kind of ['logo', 'shield', 'drone', 'lens'])
      expect(h(kind).description).toMatch(/double-click or press enter/i);
    for (const s of keys(buildCatalogue('desktop'))) expect(s.href).toBeNull();
    expect(buildCatalogue('desktop').find((s) => s.id === 'linkedin')!.href).toBeNull();
  });

  it('describes the SafeGuard piece as the real app icon, factually', () => {
    const s = buildCatalogue('desktop').find((x) => x.id === 'shield')!;
    expect(s.label).toBe('SafeGuard app icon');
    expect(s.name).toBe('SafeGuard');
    expect(s.description).toMatch(/launcher icon/i);
    expect(s.description).not.toMatch(/shield for/i);
  });

  it('makes the SafeGuard icon a square tile that sits next to the SafeSurf logo without jamming it', () => {
    for (const bp of ['desktop', 'mobile'] as const) {
      const c = buildCatalogue(bp);
      const icon = c.find((x) => x.id === 'shield')!;
      const logo = c.find((x) => x.id === 'logo')!;
      expect(icon.size.w).toBeCloseTo(icon.size.d, 9);
      expect(icon.size.h).toBeGreaterThan(0.1);
      // About the logo's footprint: no wider than it, and a similar collision radius.
      expect(icon.size.w).toBeLessThanOrEqual(logo.size.w + 1e-9);
      expect(icon.radius / logo.radius).toBeGreaterThan(0.85);
      expect(icon.radius / logo.radius).toBeLessThan(1.25);
      // The radius contains the rounded-square collider's corners.
      expect(icon.radius).toBeGreaterThanOrEqual(Math.hypot(icon.size.w, icon.size.d) / 2 - 0.2);
      expect(c.filter((x) => x.kind === 'shield')).toHaveLength(1);
    }
  });

  it('words the hover chip: the name, plus a hint on project pieces', () => {
    const all = buildCatalogue('desktop');
    expect(chipLabel(all.find((s) => s.id === 'token-kotlin')!)).toBe('Kotlin');
    expect(chipLabel(all.find((s) => s.id === 'logo')!)).toBe('SafeSurf · double-click to open');
    expect(chipLabel(all.find((s) => s.id === 'shield')!)).toBe('SafeGuard · double-click to open');
    expect(chipLabel(all.find((s) => s.id === 'drone')!)).toBe(
      'Drone Sandbox · double-click to open',
    );
    expect(chipLabel(all.find((s) => s.id === 'lens')!)).toBe('X-Ray · double-click to open');
  });
});

describe('GitHub and LinkedIn pieces open the owner profiles', () => {
  const layouts = [
    ['desktop', false],
    ['desktop', true],
    ['mobile', false],
    ['mobile', true],
  ] as const;

  it('puts exactly one GitHub piece and one LinkedIn piece in every layout', () => {
    for (const [bp, lite] of layouts) {
      const c = buildCatalogue(bp, lite);
      expect(
        c.filter((s) => s.id === 'token-github'),
        `${bp} lite=${lite}`,
      ).toHaveLength(1);
      expect(
        c.filter((s) => s.id === 'linkedin'),
        `${bp} lite=${lite}`,
      ).toHaveLength(1);
      expect(new Set(c.map((s) => s.id)).size).toBe(c.length);
    }
  });

  it('makes GitHub a die-cut token (the mark is the body) and LinkedIn a badge, neither a keycap', () => {
    const c = buildCatalogue('desktop');
    const gh = c.find((s) => s.id === 'token-github')!;
    const li = c.find((s) => s.id === 'linkedin')!;
    expect(gh.kind).toBe('token');
    expect(gh.mark).toBe('github');
    expect(gh.legend).toBeNull();
    expect(li.kind).toBe('badge');
    expect(li.mark).toBe('linkedin');
    expect(MARKS.linkedin!.hex).toBe('0A66C2');
    expect(c.some((s) => s.kind === 'key' && /github|linkedin/.test(s.id))).toBe(false);
  });

  it('takes the target of each piece from the profile, never a literal', () => {
    for (const [bp, lite] of layouts) {
      const c = buildCatalogue(bp, lite);
      expect(c.find((s) => s.id === 'token-github')!.url).toBe(profile.links.github);
      expect(c.find((s) => s.id === 'linkedin')!.url).toBe(profile.links.linkedin);
      // Nothing else opens a page; the project pieces still open sections.
      expect(
        c
          .filter((s) => s.url !== null)
          .map((s) => s.id)
          .sort(),
      ).toEqual(['linkedin', 'token-github']);
      for (const s of c) expect(isOpenable(s)).toBe(s.href !== null || s.url !== null);
    }
  });

  it('says what each piece is and what it does, in plain words', () => {
    const c = buildCatalogue('desktop');
    const gh = c.find((s) => s.id === 'token-github')!;
    const li = c.find((s) => s.id === 'linkedin')!;
    expect(gh.description).toBe(
      'Double-click or press Enter to open my GitHub profile in a new tab.',
    );
    expect(li.description).toBe(
      'Double-click or press Enter to open my LinkedIn profile in a new tab.',
    );
    expect(chipLabel(gh)).toBe('GitHub · double-click to open profile');
    expect(chipLabel(li)).toBe('LinkedIn · double-click to open profile');
    expect(gh.label).toBe('GitHub');
    expect(li.label).toBe('LinkedIn');
  });

  it('sizes the LinkedIn badge like a tier B token, so it neither jams nor shrinks the others', () => {
    for (const bp of ['desktop', 'mobile'] as const) {
      const c = buildCatalogue(bp);
      const li = c.find((s) => s.id === 'linkedin')!;
      const tierB = Math.max(
        ...tokens(c)
          .filter((s) => s.tier === 'B')
          .map((s) => Math.max(s.size.w, s.size.d)),
      );
      expect(li.size.w).toBeCloseTo(li.size.d, 9);
      expect(li.size.w).toBeLessThanOrEqual(tierB + 1e-9);
      expect(li.size.w).toBeGreaterThan(0.5);
      expect(li.radius).toBeGreaterThanOrEqual(li.size.w / 2);
      expect(li.radius).toBeLessThan(1.2);
    }
  });

  it('leaves the Claude piece exactly where it was: desktop lite and full only', () => {
    const has = (bp: 'desktop' | 'mobile', lite: boolean) =>
      buildCatalogue(bp, lite).some((s) => s.id === 'token-claude');
    expect(has('desktop', false)).toBe(true);
    expect(has('desktop', true)).toBe(true);
    expect(has('mobile', false)).toBe(false);
    expect(has('mobile', true)).toBe(false);
  });
});

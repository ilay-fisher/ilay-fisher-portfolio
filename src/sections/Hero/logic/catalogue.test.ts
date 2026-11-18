import { describe, expect, it } from 'vitest';
import { MARKS } from '../scene/marks';
import { boundingRadius, buildCatalogue, IMPORTANCE, SKILLS, type ObjectSpec } from './catalogue';

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

const keys = (list: ObjectSpec[]) => list.filter((s) => s.kind === 'key');
const hardware = (list: ObjectSpec[]) => list.filter((s) => s.kind !== 'key');
const keyId = (id: string) => `key-${id}`;

describe('catalogue allowed list and importance order', () => {
  it('only ever contains what the owner works in (no invented skills)', () => {
    expect(SKILLS.map((s) => s.id)).toEqual(ALLOWED);
    expect(IMPORTANCE).toEqual(ALLOWED);
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true])
        for (const s of keys(buildCatalogue(bp, lite)))
          expect(ALLOWED).toContain(s.id.replace(/^key-/, ''));
  });

  it('keeps the owner order: the first ten are his top skills, in order', () => {
    const desk = keys(buildCatalogue('desktop')).map((s) => s.id);
    expect(desk.slice(0, 10)).toEqual(TOP_TEN.map(keyId));
    expect(desk).toEqual(ALLOWED.map(keyId));
    const ranks = keys(buildCatalogue('desktop')).map((s) => s.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('every smaller catalogue keeps the top skills first and in the same order', () => {
    for (const bp of ['desktop', 'mobile'] as const)
      for (const lite of [false, true]) {
        const ids = keys(buildCatalogue(bp, lite)).map((s) => s.id.replace(/^key-/, ''));
        expect(ids.slice(0, 10)).toEqual(TOP_TEN);
        const order = ids.map((id) => ALLOWED.indexOf(id));
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
  });
});

describe('body counts per breakpoint', () => {
  it('desktop has 32 bodies: 25 keys plus 7 hardware pieces', () => {
    const c = buildCatalogue('desktop');
    expect(c).toHaveLength(32);
    expect(keys(c)).toHaveLength(25);
    expect(
      hardware(c)
        .map((s) => s.kind)
        .sort(),
    ).toEqual(['dial', 'drone', 'lens', 'lock', 'phone', 'shield', 'toggle'].sort());
  });

  it('mobile has 18 bodies, fewer than desktop, and still has the project pieces', () => {
    const c = buildCatalogue('mobile');
    expect(c).toHaveLength(18);
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
          expect(boundingRadius(s)).toBeGreaterThan(0.4);
        }
      }
  });
});

describe('importance drives size, weight and accent', () => {
  const k = keys(buildCatalogue('desktop'));
  const tier = (t: string) => k.filter((s) => s.tier === t);

  it('puts the top seven in tier A, the next three in B and everything else in C', () => {
    expect(tier('A').map((s) => s.id)).toEqual(TOP_TEN.slice(0, 7).map(keyId));
    expect(tier('B').map((s) => s.id)).toEqual(TOP_TEN.slice(7).map(keyId));
    expect(tier('C')).toHaveLength(15);
  });

  it('makes tier A the largest and heaviest caps, then B, then C', () => {
    const minD = (a: ObjectSpec[]) => Math.min(...a.map((s) => s.size.d));
    const maxD = (a: ObjectSpec[]) => Math.max(...a.map((s) => s.size.d));
    expect(minD(tier('A'))).toBeGreaterThanOrEqual(1.4);
    expect(minD(tier('A'))).toBeGreaterThan(maxD(tier('B')));
    expect(minD(tier('B'))).toBeGreaterThan(maxD(tier('C')));
    const avg = (a: ObjectSpec[]) => a.reduce((n, s) => n + s.mass, 0) / a.length;
    expect(avg(tier('A'))).toBeGreaterThan(avg(tier('B')));
    expect(avg(tier('B'))).toBeGreaterThan(avg(tier('C')));
  });

  it('gives the accent to tier A only: accent ink on all, accent body on the top three', () => {
    for (const s of tier('A')) expect(s.accentLegend).toBe(true);
    expect(
      tier('A')
        .filter((s) => s.accentBody)
        .map((s) => s.id),
    ).toEqual(['android', 'java', 'kotlin'].map(keyId));
    for (const s of [...tier('B'), ...tier('C')]) {
      expect(s.accentLegend).toBe(false);
      expect(s.accentBody).toBe(false);
    }
  });
});

describe('marks and text legends', () => {
  const k = keys(buildCatalogue('desktop'));
  const byId = (id: string) => k.find((s) => s.id === keyId(id))!;

  it('prints exactly one of a logo mark or a text legend on every key, and neither on hardware', () => {
    for (const s of k) expect(Boolean(s.mark) !== Boolean(s.legend)).toBe(true);
    for (const s of hardware(buildCatalogue('desktop'))) {
      expect(s.mark).toBeNull();
      expect(s.legend).toBeNull();
    }
  });

  it('uses a text legend only where no mark is available or the owner has none', () => {
    const text = k.filter((s) => s.legend).map((s) => s.id.replace(/^key-/, ''));
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
    expect(k[0]!.label).toBe('Android Development key');
    expect(k.find((s) => s.id === keyId('tflite'))!.label).toBe('TensorFlow Lite key');
  });

  it('links the project pieces to their sections and says so in the description', () => {
    const h = (kind: string) => hardware(buildCatalogue('desktop')).find((s) => s.kind === kind)!;
    expect(h('phone').href).toBe('#safesurf');
    expect(h('shield').href).toBe('#safesurf');
    expect(h('lock').href).toBe('#safesurf');
    expect(h('drone').href).toBe('#drone');
    expect(h('lens').href).toBe('#xray');
    expect(h('dial').href).toBeNull();
    expect(h('toggle').href).toBeNull();
    for (const kind of ['phone', 'shield', 'lock', 'drone', 'lens'])
      expect(h(kind).description).toMatch(/double-click or press enter/i);
    for (const s of keys(buildCatalogue('desktop'))) expect(s.href).toBeNull();
  });
});

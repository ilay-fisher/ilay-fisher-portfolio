/* global process, console, document, Path2D */
// Dev-time generator (not shipped). For every mark that becomes a die-cut token it computes, from the
// official 24x24 path data in simple-icons:
//   - the cut line: the mark's silhouette grown by a thin margin with its holes filled, traced to a
//     simplified polygon (this is the outline of the token's plate);
//   - a convex collider: the convex hull of the cut line, reduced to a few vertices by an enclosing
//     reduction, so the collider always contains the silhouette.
// Run from the repo root with the dev tooling available (Playwright's Chromium rasterises the path):
//   node src/sections/Hero/tools/build-tokens.mjs > src/sections/Hero/scene/tokenData.ts
import * as si from 'simple-icons';
import { chromium } from '@playwright/test';
import { vendorMarks } from './vendor.mjs';

const SLUGS = [
  'android',
  'kotlin',
  'tensorflow',
  'react',
  'firebase',
  'git',
  'python',
  'jetpackcompose',
  'nodedotjs',
  'pytorch',
  'onnx',
  'cplusplus',
  'webassembly',
  'docker',
  'postgresql',
  'fastapi',
  'opencv',
  'googlecloud',
  'claude',
  'github',
  'c',
  'java',
];
const EXTRA = vendorMarks();
/** Width of the die-cut margin around the silhouette, in mark units (the mark box is 24 wide). */
const MARGIN = 0.95;
const PX = 40; // raster pixels per mark unit
const PAD = 4; // empty border around the mark box, in mark units
const HULL_MAX = 10;

const cap = (s) => 'si' + s[0].toUpperCase() + s.slice(1);

const browser = await chromium.launch();
const page = await browser.newPage();

/** Rasterise in the page: returns closed loops (arrays of [x, y] in mark units) of the grown silhouette. */
const trace = (d) =>
  page.evaluate(
    ({ d, MARGIN, PX, PAD }) => {
      const size = Math.round((24 + PAD * 2) * PX);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.setTransform(PX, 0, 0, PX, PAD * PX, PAD * PX);
      const p = new Path2D(d);
      ctx.fillStyle = '#000';
      ctx.fill(p);
      ctx.lineWidth = MARGIN * 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      ctx.stroke(p);
      const img = ctx.getImageData(0, 0, size, size).data;
      const ink = new Uint8Array(size * size);
      for (let i = 0; i < ink.length; i++) ink[i] = img[i * 4 + 3] > 127 ? 1 : 0;
      // Exterior flood fill: anything not reachable from the border is solid (holes are filled).
      const ext = new Uint8Array(size * size);
      const stack = [0];
      ext[0] = 1;
      while (stack.length) {
        const i = stack.pop();
        const x = i % size;
        const y = (i / size) | 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const j = ny * size + nx;
          if (ext[j] || ink[j]) continue;
          ext[j] = 1;
          stack.push(j);
        }
      }
      const solid = (x, y) =>
        x < 0 || y < 0 || x >= size || y >= size ? 0 : ext[y * size + x] ? 0 : 1;
      // Crack following: directed pixel edges with the solid on the right, joined into loops.
      const out = new Map();
      const add = (x0, y0, x1, y1) => {
        const k = y0 * (size + 1) + x0;
        const e = [x1, y1];
        const l = out.get(k);
        if (l) l.push(e);
        else out.set(k, [e]);
      };
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          if (!solid(x, y)) continue;
          if (!solid(x, y - 1)) add(x, y, x + 1, y);
          if (!solid(x + 1, y)) add(x + 1, y, x + 1, y + 1);
          if (!solid(x, y + 1)) add(x + 1, y + 1, x, y + 1);
          if (!solid(x - 1, y)) add(x, y + 1, x, y);
        }
      const loops = [];
      for (const [k0, list] of out) {
        while (list.length) {
          const start = [k0 % (size + 1), (k0 / (size + 1)) | 0];
          const loop = [start];
          let cur = list.pop();
          let guard = 0;
          while (cur && guard++ < 1e6) {
            if (cur[0] === start[0] && cur[1] === start[1]) break;
            loop.push(cur);
            const l = out.get(cur[1] * (size + 1) + cur[0]);
            cur = l && l.length ? l.pop() : null;
          }
          if (loop.length > 8) loops.push(loop);
        }
      }
      return loops.map((l) => l.map(([x, y]) => [x / PX - PAD, y / PX - PAD]));
    },
    { d, MARGIN, PX, PAD },
  );

/** Ramer-Douglas-Peucker on a closed loop. */
function rdp(pts, eps) {
  const dist = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const rec = (a, b, arr) => {
    let m = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = dist(arr[i], arr[a], arr[b]);
      if (d > m) {
        m = d;
        idx = i;
      }
    }
    if (m > eps) return [...rec(a, idx, arr).slice(0, -1), ...rec(idx, b, arr)];
    return [arr[a], arr[b]];
  };
  // Split the loop at its two farthest-apart points so both halves are open polylines.
  let i0 = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[i0][0]) i0 = i;
  let i1 = 0;
  let best = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i0][0], pts[i][1] - pts[i0][1]);
    if (d > best) {
      best = d;
      i1 = i;
    }
  }
  const [a, b] = i0 < i1 ? [i0, i1] : [i1, i0];
  const h1 = pts.slice(a, b + 1);
  const h2 = [...pts.slice(b), ...pts.slice(0, a + 1)];
  return [...rec(0, h1.length - 1, h1).slice(0, -1), ...rec(0, h2.length - 1, h2).slice(0, -1)];
}

const area = (p) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
};

/** Convex hull (monotone chain), counter-clockwise in a y-up frame. */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/**
 * Reduces a convex polygon to at most `max` vertices while only ever growing it: the edge whose removal
 * adds the least area is dropped and its neighbours are extended until they meet. Contains the original.
 */
function enclose(poly, max) {
  let h = poly.slice();
  const meet = (a, b, c, d) => {
    const r = [b[0] - a[0], b[1] - a[1]];
    const s = [d[0] - c[0], d[1] - c[1]];
    const den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    // The extended edges must meet beyond the removed edge on both sides.
    if (t < 1 - 1e-9 || u < 1 - 1e-9) return null;
    return [a[0] + r[0] * t, a[1] + r[1] * t];
  };
  while (h.length > max) {
    const n = h.length;
    let best = null;
    for (let i = 0; i < n; i++) {
      const a = h[(i - 1 + n) % n];
      const b = h[i];
      const c = h[(i + 1) % n];
      const d = h[(i + 2) % n];
      const p = meet(a, b, d, c);
      if (!p) continue;
      const add = Math.abs((b[0] - p[0]) * (c[1] - p[1]) - (b[1] - p[1]) * (c[0] - p[0])) / 2;
      if (!best || add < best.add) best = { add, i, p };
    }
    if (!best) break;
    const next = [];
    for (let k = 0; k < n; k++) {
      if (k === best.i) next.push(best.p);
      else if (k === (best.i + 1) % n) continue;
      else next.push(h[k]);
    }
    h = next;
  }
  return h;
}

const r2 = (v) => Math.round(v * 100) / 100;
const flat = (pts) => pts.flatMap(([x, y]) => [r2(x), r2(y)]);

const out = [];
out.push(
  '// GENERATED by tools/build-tokens.mjs from the simple-icons path data. Do not edit by hand.',
);
out.push(
  '// Cut lines are the official marks grown by a thin margin; colliders are convex hulls that contain them.',
);
out.push('');
out.push(
  '/** The die-cut outline and collider of one token, in mark units (24 across), centred on the plate. */',
);
out.push('export interface TokenShape {');
out.push(
  "  /** Where the plate centre sits in the mark's own 24x24 box (the origin of the cut line). */",
);
out.push('  cx: number;');
out.push('  cy: number;');
out.push('  /** Plate size (width and height of the cut line). */');
out.push('  w: number;');
out.push('  h: number;');
out.push(
  '  /** Cut line loops, each a flat [x, y, x, y, ...] list around the plate centre (y down, as in SVG). */',
);
out.push('  cut: number[][];');
out.push('  /** Convex collider outline, flat [x, y, ...], containing every cut-line point. */');
out.push('  hull: number[];');
out.push('}');
out.push('');
out.push('export const TOKEN_SHAPES: Record<string, TokenShape> = {');

for (const slug of SLUGS) {
  const icon = EXTRA[slug] ?? si[cap(slug)];
  if (!icon) throw new Error('missing mark ' + slug);
  const raw = await trace(icon.path);
  const loops = raw
    .map((l) => rdp(l, 0.045))
    .filter((l) => l.length >= 3 && Math.abs(area(l)) > 1.5)
    .sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const all = loops.flat();
  const x0 = Math.min(...all.map((p) => p[0]));
  const x1 = Math.max(...all.map((p) => p[0]));
  const y0 = Math.min(...all.map((p) => p[1]));
  const y1 = Math.max(...all.map((p) => p[1]));
  const cx = r2((x0 + x1) / 2);
  const cy = r2((y0 + y1) / 2);
  const rel = loops.map((l) => l.map(([x, y]) => [x - cx, y - cy]));
  const h = enclose(hull(rel.flat().map(([x, y]) => [x, -y])), HULL_MAX).map(([x, y]) => [x, -y]);
  out.push(`  ${JSON.stringify(slug)}: {`);
  out.push(`    cx: ${cx},`);
  out.push(`    cy: ${cy},`);
  out.push(`    w: ${r2(x1 - x0)},`);
  out.push(`    h: ${r2(y1 - y0)},`);
  out.push(`    cut: ${JSON.stringify(rel.map(flat))},`);
  out.push(`    hull: ${JSON.stringify(flat(h))},`);
  out.push('  },');
  console.error(
    slug,
    'loops',
    loops.length,
    'points',
    loops.reduce((n, l) => n + l.length, 0),
    'hull',
    h.length,
  );
}
out.push('};');
out.push('');
process.stdout.write(out.join('\n'));
await browser.close();

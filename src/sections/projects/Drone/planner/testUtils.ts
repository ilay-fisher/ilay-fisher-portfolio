/**
 * Test-only helpers: an independent reference implementation of the movement rules
 * (deliberately not sharing code with `grid.ts`) and a plain Dijkstra, so the planners are
 * checked against something that cannot share their bugs.
 */
import { mulberry32 } from './rng';

export const R_FREE = 0;
export const R_WALL = 1;
export const R_WIND = 2;

/** A tiny grid description used by the reference search. */
export interface RefGrid {
  width: number;
  height: number;
  cells: Uint8Array;
}

/** Builds a grid from ASCII rows: `#` wall, `~` wind, anything else free. */
export function gridFromAscii(rows: string[]): RefGrid {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      cells[y * width + x] = ch === '#' ? R_WALL : ch === '~' ? R_WIND : R_FREE;
    });
  });
  return { width, height, cells };
}

/** Seeded random grid with the given wall and wind densities. */
export function randomGrid(
  seed: number,
  width: number,
  height: number,
  wallP: number,
  windP: number,
): RefGrid {
  const rng = mulberry32(seed);
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    const r = rng();
    cells[i] = r < wallP ? R_WALL : r < wallP + windP ? R_WIND : R_FREE;
  }
  return { width, height, cells };
}

/** Cost of one move from (x,y) to the neighbour (nx,ny), or Infinity when it is not allowed. */
export function refMoveCost(g: RefGrid, x: number, y: number, nx: number, ny: number): number {
  if (nx < 0 || ny < 0 || nx >= g.width || ny >= g.height) return Infinity;
  const target = g.cells[ny * g.width + nx];
  if (target === R_WALL) return Infinity;
  const diagonal = nx !== x && ny !== y;
  if (diagonal && (g.cells[y * g.width + nx] === R_WALL || g.cells[ny * g.width + x] === R_WALL)) {
    return Infinity;
  }
  const base = diagonal ? Math.SQRT2 : 1;
  return target === R_WIND ? base * 4 : base;
}

/** Plain O(n^2) Dijkstra from start to goal. Infinity when unreachable. */
export function dijkstraCost(g: RefGrid, sx: number, sy: number, gx: number, gy: number): number {
  const n = g.width * g.height;
  const s = sy * g.width + sx;
  const t = gy * g.width + gx;
  if (g.cells[s] === R_WALL || g.cells[t] === R_WALL) return Infinity;
  const dist = new Float64Array(n).fill(Infinity);
  const done = new Uint8Array(n);
  dist[s] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = dist[i] ?? Infinity;
      if (!done[i] && d < best) {
        best = d;
        u = i;
      }
    }
    if (u < 0) return Infinity;
    if (u === t) return best;
    done[u] = 1;
    const ux = u % g.width;
    const uy = Math.floor(u / g.width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const c = refMoveCost(g, ux, uy, ux + dx, uy + dy);
        if (c === Infinity) continue;
        const v = (uy + dy) * g.width + ux + dx;
        if (best + c < (dist[v] ?? Infinity)) dist[v] = best + c;
      }
    }
  }
}

/**
 * Checks that `path` is a legal route start to goal and returns its cost computed with the
 * reference move rules. Throws a descriptive error when a step is illegal.
 */
export function validatePath(
  g: RefGrid,
  path: ArrayLike<number>,
  start: number,
  goal: number,
): number {
  if (path.length === 0) throw new Error('empty path');
  if (path[0] !== start) throw new Error('path does not begin at the start');
  if (path[path.length - 1] !== goal) throw new Error('path does not end at the goal');
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as number;
    const b = path[i] as number;
    const ax = a % g.width;
    const ay = Math.floor(a / g.width);
    const bx = b % g.width;
    const by = Math.floor(b / g.width);
    if (Math.abs(ax - bx) > 1 || Math.abs(ay - by) > 1 || a === b) {
      throw new Error(`step ${i} is not between neighbours`);
    }
    const c = refMoveCost(g, ax, ay, bx, by);
    if (c === Infinity) throw new Error(`step ${i} enters a wall or cuts a corner`);
    total += c;
  }
  return total;
}

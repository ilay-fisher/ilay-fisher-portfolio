import { describe, expect, it } from 'vitest';
import { AStar } from './astar';
import { DStarLite } from './dstar';
import { Grid, FREE, WALL, WIND, octile, pathCost } from './grid';
import { mulberry32, randInt } from './rng';
import { dijkstraCost, gridFromAscii, randomGrid, validatePath, type RefGrid } from './testUtils';

/** Copies a reference grid into a live `Grid`. */
function toGrid(r: RefGrid): Grid {
  const g = new Grid(r.width, r.height);
  for (let i = 0; i < r.cells.length; i++) {
    g.set(i % r.width, Math.floor(i / r.width), r.cells[i] as 0 | 1 | 2);
  }
  return g;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

describe('octile heuristic', () => {
  it('is the diagonal-then-straight distance', () => {
    expect(octile(0, 0, 0, 0)).toBe(0);
    expect(octile(0, 0, 5, 0)).toBe(5);
    expect(octile(0, 0, 3, 3)).toBeCloseTo(3 * Math.SQRT2, 12);
    expect(octile(0, 0, 5, 2)).toBeCloseTo(3 + 2 * Math.SQRT2, 12);
    expect(octile(4, 7, 1, 3)).toBe(octile(1, 3, 4, 7));
  });
  it('never overestimates the true cost on an open grid', () => {
    const g = new Grid(12, 12);
    const a = new AStar(g);
    for (const [gx, gy] of [[11, 11], [11, 0], [3, 9], [0, 7]] as const) {
      const r = a.plan(0, 0, gx, gy);
      expect(r.cost).toBeGreaterThanOrEqual(octile(0, 0, gx, gy) - 1e-9);
    }
  });
});

describe('movement rules', () => {
  it('does not cut a corner between a wall and a free cell', () => {
    // The diagonal (0,0)->(1,1) passes the wall at (1,0), so the drone must go round it.
    const r = gridFromAscii(['.#', '..']);
    const res = new AStar(toGrid(r)).plan(0, 0, 1, 1);
    expect(res.found).toBe(true);
    expect(Array.from(res.path)).toEqual([0, 2, 3]);
    expect(res.cost).toBeCloseTo(2, 12);
  });

  it('cannot squeeze diagonally between two touching walls', () => {
    const r = gridFromAscii(['.#.', '#..', '...']);
    expect(new AStar(toGrid(r)).plan(0, 0, 2, 2).found).toBe(false);
    expect(new DStarLite(toGrid(r)).plan(0, 0, 2, 2).found).toBe(false);
  });

  it('takes a plain diagonal when both corners are free', () => {
    const res = new AStar(new Grid(4, 4)).plan(0, 0, 3, 3);
    expect(res.cost).toBeCloseTo(3 * Math.SQRT2, 12);
    expect(res.path.length).toBe(4);
  });

  it('charges 4x to enter a wind cell and routes around a wind band when that is cheaper', () => {
    const rows = ['.......', '..~~~..', '..~~~..', '..~~~..', '.......'];
    const open = gridFromAscii(rows.map((r) => r.replace(/~/g, '.')));
    const windy = gridFromAscii(rows);
    const start = [0, 2] as const;
    const goal = [6, 2] as const;
    const straight = new AStar(toGrid(open)).plan(start[0], start[1], goal[0], goal[1]);
    const detour = new AStar(toGrid(windy)).plan(start[0], start[1], goal[0], goal[1]);
    expect(straight.cost).toBeCloseTo(6, 12);
    // Crossing three wind cells would cost 4 + 3*4 + ... = 16; the cheaper way goes round.
    expect(detour.cost).toBeLessThan(16);
    expect(detour.cost).toBeGreaterThan(straight.cost);
    const windCells = new Set([9, 10, 11, 16, 17, 18, 23, 24, 25]);
    expect(Array.from(detour.path).some((c) => windCells.has(c))).toBe(false);
  });

  it('crosses wind when going round costs more', () => {
    // A one-cell-high corridor: the only way through is the wind cell, cost 4.
    const r = gridFromAscii(['#####', '.~...', '#####']);
    const res = new AStar(toGrid(r)).plan(0, 1, 4, 1);
    expect(res.found).toBe(true);
    expect(res.cost).toBeCloseTo(4 + 3, 12);
  });

  it('pathCost agrees with the planner cost', () => {
    const r = randomGrid(11, 20, 14, 0.2, 0.15);
    const g = toGrid(r);
    const res = new AStar(g).plan(0, 0, 19, 13);
    if (res.found) expect(pathCost(g, res.path)).toBeCloseTo(res.cost, 9);
  });
});

describe('edge cases', () => {
  it('reports no path when the goal is walled in, for both algorithms', () => {
    // Wall the goal cell (2,2) in completely.
    const g = toGrid(gridFromAscii(['.....', '.###.', '.#.#.', '.###.', '.....']));
    const a = new AStar(g).plan(0, 0, 2, 2);
    const d = new DStarLite(g).plan(0, 0, 2, 2);
    expect(a.found).toBe(false);
    expect(a.path.length).toBe(0);
    expect(a.cost).toBe(-1);
    expect(d.found).toBe(false);
    expect(d.path.length).toBe(0);
  });

  it('start equals goal gives a one-cell path of cost 0', () => {
    const g = new Grid(5, 5);
    for (const planner of [new AStar(g), new DStarLite(g)]) {
      const res = planner.plan(2, 2, 2, 2);
      expect(res.found).toBe(true);
      expect(Array.from(res.path)).toEqual([12]);
      expect(res.cost).toBe(0);
    }
  });

  it('no path when start or goal is a wall or out of bounds', () => {
    const g = toGrid(gridFromAscii(['.#.', '...']));
    expect(new AStar(g).plan(1, 0, 2, 1).found).toBe(false);
    expect(new AStar(g).plan(0, 0, 1, 0).found).toBe(false);
    expect(new AStar(g).plan(-1, 0, 2, 1).found).toBe(false);
    expect(new DStarLite(g).plan(0, 0, 9, 9).found).toBe(false);
  });

  it('ignores out-of-bounds and no-op cell writes', () => {
    const g = new Grid(3, 3);
    expect(g.set(5, 5, WALL)).toBe(false);
    expect(g.set(1, 1, FREE)).toBe(false);
    expect(g.set(1, 1, WIND)).toBe(true);
    expect(g.get(1, 1)).toBe(WIND);
    expect(g.get(-1, 0)).toBe(WALL);
  });

  it('counts the nodes it expands and keeps a visit map', () => {
    const g = new Grid(10, 10);
    const a = new AStar(g);
    const res = a.plan(0, 0, 9, 9);
    expect(res.expanded).toBeGreaterThan(0);
    expect(res.expanded).toBeLessThanOrEqual(100);
    let visited = 0;
    for (const v of a.visits) if (v > 0) visited++;
    expect(visited).toBeGreaterThan(0);
    expect(res.ms).toBeGreaterThanOrEqual(0);
  });
});

describe('A* is optimal', () => {
  it('matches Dijkstra on 300 seeded random grids and returns legal paths', () => {
    let reachable = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed * 7919);
      const w = 4 + randInt(rng, 14);
      const h = 4 + randInt(rng, 10);
      const r = randomGrid(seed, w, h, rng() * 0.4, rng() * 0.25);
      const sx = randInt(rng, w);
      const sy = randInt(rng, h);
      const gx = randInt(rng, w);
      const gy = randInt(rng, h);
      const ref = dijkstraCost(r, sx, sy, gx, gy);
      const res = new AStar(toGrid(r)).plan(sx, sy, gx, gy);
      if (ref === Infinity) {
        expect(res.found, `seed ${seed}`).toBe(false);
      } else {
        reachable++;
        expect(res.found, `seed ${seed}`).toBe(true);
        expect(close(res.cost, ref), `seed ${seed}: ${res.cost} vs ${ref}`).toBe(true);
        const recomputed = validatePath(r, res.path, sy * w + sx, gy * w + gx);
        expect(close(recomputed, ref), `seed ${seed} path cost`).toBe(true);
      }
    }
    expect(reachable).toBeGreaterThan(150);
  });

  it('is reusable: planning twice on the same instance gives the same answer', () => {
    const r = randomGrid(5, 15, 10, 0.25, 0.1);
    const a = new AStar(toGrid(r));
    const one = a.plan(0, 0, 14, 9);
    const two = a.plan(0, 0, 14, 9);
    expect(two.found).toBe(one.found);
    expect(two.cost).toBe(one.cost);
    expect(two.expanded).toBe(one.expanded);
  });
});

describe('D* Lite matches A* after changes', () => {
  it('equals Dijkstra and A* cost over change sequences on 120 seeded grids', () => {
    let plans = 0;
    let reachablePlans = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const rng = mulberry32(seed * 104729);
      const w = 6 + randInt(rng, 16);
      const h = 5 + randInt(rng, 10);
      const r = randomGrid(seed, w, h, rng() * 0.3, rng() * 0.2);
      const grid = toGrid(r);
      const a = new AStar(grid);
      const d = new DStarLite(grid);
      let sx = 0;
      let sy = 0;
      let gx = w - 1;
      let gy = h - 1;
      grid.set(sx, sy, FREE);
      grid.set(gx, gy, FREE);
      r.cells[sy * w + sx] = FREE;
      r.cells[gy * w + gx] = FREE;
      for (let step = 0; step < 25; step++) {
        const edits = 1 + randInt(rng, 5);
        for (let e = 0; e < edits; e++) {
          const x = randInt(rng, w);
          const y = randInt(rng, h);
          if ((x === sx && y === sy) || (x === gx && y === gy)) continue;
          const v = [FREE, WALL, WIND][randInt(rng, 3)] as 0 | 1 | 2;
          grid.set(x, y, v);
          r.cells[y * w + x] = v;
        }
        const ref = dijkstraCost(r, sx, sy, gx, gy);
        const ar = a.plan(sx, sy, gx, gy);
        const dr = d.plan(sx, sy, gx, gy);
        plans++;
        expect(ar.found, `seed ${seed} step ${step} A*`).toBe(ref !== Infinity);
        expect(dr.found, `seed ${seed} step ${step} D*`).toBe(ref !== Infinity);
        if (ref !== Infinity) {
          reachablePlans++;
          expect(close(ar.cost, ref), `seed ${seed} step ${step} A* ${ar.cost} vs ${ref}`).toBe(true);
          expect(close(dr.cost, ref), `seed ${seed} step ${step} D* ${dr.cost} vs ${ref}`).toBe(true);
          const c = validatePath(r, dr.path, sy * w + sx, gy * w + gx);
          expect(close(c, ref), `seed ${seed} step ${step} D* path`).toBe(true);
          // The drone moves: sometimes advance the start along the path, sometimes move the goal.
          const roll = rng();
          if (roll < 0.5 && dr.path.length > 2) {
            const k = 1 + randInt(rng, Math.min(3, dr.path.length - 1));
            const cell = dr.path[k] as number;
            sx = cell % w;
            sy = Math.floor(cell / w);
          } else if (roll < 0.6) {
            const nx = randInt(rng, w);
            const ny = randInt(rng, h);
            if (r.cells[ny * w + nx] !== WALL) {
              gx = nx;
              gy = ny;
            }
          }
        }
      }
    }
    expect(plans).toBe(120 * 25);
    expect(reachablePlans).toBeGreaterThan(1500);
  });

  it('expands fewer nodes than A* when one cell on the route is blocked', () => {
    const g = new Grid(40, 24);
    for (let x = 8; x < 14; x++) g.set(x, 11, WALL);
    const a = new AStar(g);
    const d = new DStarLite(g);
    a.plan(2, 12, 37, 12);
    d.plan(2, 12, 37, 12);
    const route = Array.from(d.plan(2, 12, 37, 12).path);
    const cell = route[Math.floor(route.length / 2)] as number;
    g.set(cell % 40, Math.floor(cell / 40), WALL);
    const ar = a.plan(2, 12, 37, 12);
    const dr = d.plan(2, 12, 37, 12);
    expect(dr.cost).toBeCloseTo(ar.cost, 9);
    expect(dr.expanded).toBeLessThan(ar.expanded);
  });

  it('re-initialises when the goal moves', () => {
    const g = toGrid(randomGrid(21, 12, 12, 0.15, 0.1));
    g.set(0, 0, FREE);
    g.set(11, 11, FREE);
    g.set(3, 8, FREE);
    const d = new DStarLite(g);
    const a = new AStar(g);
    expect(d.plan(0, 0, 11, 11).cost).toBeCloseTo(a.plan(0, 0, 11, 11).cost, 9);
    expect(d.plan(0, 0, 3, 8).cost).toBeCloseTo(a.plan(0, 0, 3, 8).cost, 9);
  });
});

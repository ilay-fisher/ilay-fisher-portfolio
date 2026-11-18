import { IndexedHeap } from './heap';
import { DX, DY, Grid, WALL, noPath, octile, pathCost, type PlanResult } from './grid';

/**
 * A*: searches from scratch on every call. 8-connected, octile heuristic, no corner cutting,
 * wind 4x. Optimal because the heuristic is consistent.
 *
 * Ported from the owner's drone-obstacle-sandbox (MIT, web/src/engine/tsPlanner.ts), split out
 * of the combined planner class so it can run beside D* Lite without sharing a queue.
 */
export class AStar {
  /** Per-cell expansion count of the last plan (0 = never expanded), capped at 255. */
  readonly visits: Uint8Array;
  /** Cells in the order the last plan first expanded them; only the first `orderLength` count. */
  readonly order: Int32Array;
  /** How many distinct cells the last plan expanded. */
  orderLength = 0;
  private readonly heap: IndexedHeap;
  private readonly g: Float64Array;
  private readonly parent: Int32Array;
  private readonly closed: Uint8Array;

  constructor(private readonly grid: Grid) {
    const n = grid.width * grid.height;
    this.visits = new Uint8Array(n);
    this.order = new Int32Array(n);
    this.heap = new IndexedHeap(n);
    this.g = new Float64Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Uint8Array(n);
  }

  /** Plans from (sx, sy) to (gx, gy). */
  plan(sx: number, sy: number, gx: number, gy: number): PlanResult {
    const t0 = performance.now();
    const grid = this.grid;
    const w = grid.width;
    this.visits.fill(0);
    this.orderLength = 0;
    if (
      !grid.inBounds(sx, sy) ||
      !grid.inBounds(gx, gy) ||
      grid.get(sx, sy) === WALL ||
      grid.get(gx, gy) === WALL
    ) {
      return noPath(0, performance.now() - t0);
    }
    const s = sy * w + sx;
    const goal = gy * w + gx;
    const q = this.heap;
    q.clear();
    this.g.fill(Infinity);
    this.closed.fill(0);
    this.g[s] = 0;
    const h0 = octile(sx, sy, gx, gy);
    q.set(s, h0, h0);
    let expanded = 0;
    while (q.size > 0) {
      const u = q.top();
      q.remove(u);
      this.closed[u] = 1;
      expanded++;
      const seen = this.visits[u] as number;
      if (seen === 0) this.order[this.orderLength++] = u;
      if (seen < 255) this.visits[u] = seen + 1;
      if (u === goal) break;
      const ux = u % w;
      const uy = (u / w) | 0;
      const gu = this.g[u] as number;
      for (let k = 0; k < 8; k++) {
        const c = grid.moveCost(ux, uy, k);
        if (c < 0) continue;
        const vx = ux + (DX[k] as number);
        const vy = uy + (DY[k] as number);
        const v = vy * w + vx;
        if (this.closed[v]) continue;
        const ng = gu + c;
        if (ng < (this.g[v] as number)) {
          this.g[v] = ng;
          this.parent[v] = u;
          const hv = octile(vx, vy, gx, gy);
          q.set(v, ng + hv, hv);
        }
      }
    }
    q.clear();
    if (!this.closed[goal]) return noPath(expanded, performance.now() - t0);
    const rev: number[] = [];
    for (let v = goal; v !== s; v = this.parent[v] as number) rev.push(v);
    rev.push(s);
    rev.reverse();
    const path = Int32Array.from(rev);
    return { found: true, path, cost: pathCost(grid, path), expanded, ms: performance.now() - t0 };
  }
}

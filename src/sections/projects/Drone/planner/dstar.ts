import { IndexedHeap } from './heap';
import { DX, DY, Grid, WALL, noPath, octile, type PlanResult, pathCost } from './grid';

/** Slack for the D* Lite stop test (see `plan`). */
const KEY_EPS = 1e-9;

/**
 * Incremental D* Lite (Koenig and Likhachev, 2002), searching backward from the goal so the
 * values survive the drone moving. It keeps g/rhs between calls and, when the grid changes,
 * repairs only the vertices around the changed cells instead of searching again.
 * Same movement rules and costs as {@link AStar}, so both return the same optimal cost.
 *
 * Ported from the owner's drone-obstacle-sandbox (MIT, web/src/engine/tsPlanner.ts), with its
 * own queue and buffers, and change tracking through `Grid.onChange`.
 */
export class DStarLite {
  /** Per-cell expansion count of the last plan (0 = never expanded), capped at 255. */
  readonly visits: Uint8Array;
  private readonly heap: IndexedHeap;
  private readonly g: Float64Array;
  private readonly rhs: Float64Array;
  private readonly dirty: Uint8Array;
  private readonly dirtyList: Int32Array;
  private dirtyCount = 0;
  private inited = false;
  private goalCell = -1;
  private km = 0;
  private sx = 0;
  private sy = 0;
  private expanded = 0;

  constructor(private readonly grid: Grid) {
    const n = grid.width * grid.height;
    this.visits = new Uint8Array(n);
    this.heap = new IndexedHeap(n);
    this.g = new Float64Array(n);
    this.rhs = new Float64Array(n);
    this.dirty = new Uint8Array(n);
    this.dirtyList = new Int32Array(n);
    grid.onChange((i) => {
      if (this.inited && !this.dirty[i]) {
        this.dirty[i] = 1;
        this.dirtyList[this.dirtyCount++] = i;
      }
    });
  }

  /** Forgets everything learned; the next plan searches from scratch. */
  reset(): void {
    this.inited = false;
    this.goalCell = -1;
    this.dirty.fill(0);
    this.dirtyCount = 0;
  }

  private key(u: number): void {
    const m = Math.min(this.g[u] as number, this.rhs[u] as number);
    const w = this.grid.width;
    this.heap.set(u, m + octile(this.sx, this.sy, u % w, (u / w) | 0) + this.km, m);
  }

  private updateVertex(u: number): void {
    const w = this.grid.width;
    const ux = u % w;
    const uy = (u / w) | 0;
    if (u !== this.goalCell) {
      let best = Infinity;
      if (this.grid.cells[u] !== WALL) {
        for (let k = 0; k < 8; k++) {
          const c = this.grid.moveCost(ux, uy, k);
          if (c < 0) continue;
          const t = c + (this.g[(uy + (DY[k] as number)) * w + ux + (DX[k] as number)] as number);
          if (t < best) best = t;
        }
      }
      this.rhs[u] = best;
    }
    if (this.g[u] !== this.rhs[u]) this.key(u);
    else this.heap.remove(u);
  }

  private updateNeighbours(u: number): void {
    const w = this.grid.width;
    const ux = u % w;
    const uy = (u / w) | 0;
    for (let k = 0; k < 8; k++) {
      const px = ux + (DX[k] as number);
      const py = uy + (DY[k] as number);
      if (this.grid.inBounds(px, py)) this.updateVertex(py * w + px);
    }
  }

  private bump(i: number): void {
    const seen = this.visits[i] as number;
    if (seen < 255) this.visits[i] = seen + 1;
    this.expanded++;
  }

  /**
   * Plans from (sx, sy) to (gx, gy). The first call, or one with a new goal, is a full search;
   * later calls repair the previous solution using the cells changed since.
   */
  plan(sx: number, sy: number, gx: number, gy: number): PlanResult {
    const t0 = performance.now();
    const grid = this.grid;
    const w = grid.width;
    this.visits.fill(0);
    this.expanded = 0;
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
    if (!this.inited || this.goalCell !== goal) {
      q.clear();
      this.g.fill(Infinity);
      this.rhs.fill(Infinity);
      this.dirty.fill(0);
      this.dirtyCount = 0;
      this.inited = true;
      this.goalCell = goal;
      this.km = 0;
      this.sx = sx;
      this.sy = sy;
      this.rhs[goal] = 0;
      this.key(goal);
    } else {
      this.km += octile(this.sx, this.sy, sx, sy);
      this.sx = sx;
      this.sy = sy;
      for (let n = 0; n < this.dirtyCount; n++) {
        const c = this.dirtyList[n] as number;
        this.dirty[c] = 0;
        this.updateVertex(c);
        this.updateNeighbours(c);
      }
      this.dirtyCount = 0;
    }
    while (q.size > 0) {
      const u = q.top();
      const a = q.k1[u] as number;
      const b = q.k2[u] as number;
      const gs = this.g[s] as number;
      const sk1 = Math.min(gs, this.rhs[s] as number) + this.km; // h(start, start) = 0
      // Stop test with slack: costs are sums of sqrt(2) terms while h is a closed form, so
      // equal keys can differ by a few ulps. The queue stays exactly ordered; only this test
      // is relaxed, so a vertex whose key ties the start key is expanded instead of skipped.
      if (!(a < sk1 + KEY_EPS) && gs === this.rhs[s]) break;
      const mu = Math.min(this.g[u] as number, this.rhs[u] as number);
      const nk1 = mu + octile(this.sx, this.sy, u % w, (u / w) | 0) + this.km;
      if (a < nk1 || (a === nk1 && b < mu)) {
        q.set(u, nk1, mu);
      } else if ((this.g[u] as number) > (this.rhs[u] as number)) {
        this.bump(u);
        this.g[u] = this.rhs[u] as number;
        q.remove(u);
        this.updateNeighbours(u);
      } else {
        this.bump(u);
        this.g[u] = Infinity;
        this.updateVertex(u);
        this.updateNeighbours(u);
      }
    }
    if (this.g[s] === Infinity) return noPath(this.expanded, performance.now() - t0);
    // Greedy descent on c(u,v) + g(v) yields the optimal path from the start.
    const path: number[] = [s];
    let u = s;
    while (u !== goal) {
      const ux = u % w;
      const uy = (u / w) | 0;
      let best = Infinity;
      let next = -1;
      for (let k = 0; k < 8; k++) {
        const c = grid.moveCost(ux, uy, k);
        if (c < 0) continue;
        const v = (uy + (DY[k] as number)) * w + ux + (DX[k] as number);
        const t = c + (this.g[v] as number);
        if (t < best) {
          best = t;
          next = v;
        }
      }
      if (next < 0 || path.length >= w * grid.height) {
        return noPath(this.expanded, performance.now() - t0);
      }
      path.push(next);
      u = next;
    }
    const arr = Int32Array.from(path);
    return {
      found: true,
      path: arr,
      cost: pathCost(grid, arr),
      expanded: this.expanded,
      ms: performance.now() - t0,
    };
  }
}

/**
 * The map the planners search: a flat `Uint8Array` of cells, 8-connected movement, no corner
 * cutting, wind zones that cost 4x to enter. Pure data, no DOM.
 */

/** An open cell. */
export const FREE = 0;
/** A building or obstacle: impassable. */
export const WALL = 1;
/** A wind zone: passable but 4x the cost to enter. */
export const WIND = 2;
/** What a cell can hold. */
export type CellValue = 0 | 1 | 2;
/** Multiplier for entering a wind cell. */
export const WIND_COST = 4;

const SQ2 = Math.SQRT2;
/** The eight neighbour offsets: four straight, then four diagonal. */
export const DX = [1, -1, 0, 0, 1, 1, -1, -1] as const;
export const DY = [0, 0, 1, -1, 1, -1, 1, -1] as const;

/**
 * Octile distance: the exact cost of the cheapest route on an empty grid. Because every
 * real step costs at least this much, it never overestimates, so A* stays optimal.
 */
export function octile(x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.abs(x0 - x1);
  const dy = Math.abs(y0 - y1);
  return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
}

/** A width x height map. Both planners read it; writes notify listeners (D* Lite uses this). */
export class Grid {
  readonly cells: Uint8Array;
  private readonly listeners: ((index: number) => void)[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = new Uint8Array(width * height);
  }

  /** Whether (x, y) is on the map. */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Cell value, with everything off the map counting as a wall. */
  get(x: number, y: number): CellValue {
    return this.inBounds(x, y) ? (this.cells[y * this.width + x] as CellValue) : WALL;
  }

  /** Writes a cell. Returns false when nothing changed (off the map, or same value). */
  set(x: number, y: number, v: CellValue): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = y * this.width + x;
    if (this.cells[i] === v) return false;
    this.cells[i] = v;
    for (const fn of this.listeners) fn(i);
    return true;
  }

  /** Registers a callback fired with the cell index after every real change. */
  onChange(fn: (index: number) => void): void {
    this.listeners.push(fn);
  }

  /** Empties the map without notifying (callers that do this re-create their planners). */
  clear(): void {
    this.cells.fill(FREE);
  }

  /**
   * Cost of stepping from (x, y) in direction `k`, or -1 when the move is not allowed:
   * off the map, into a wall, or a diagonal that would cut the corner of a wall.
   */
  moveCost(x: number, y: number, k: number): number {
    const nx = x + (DX[k] as number);
    const ny = y + (DY[k] as number);
    if (!this.inBounds(nx, ny)) return -1;
    const v = this.cells[ny * this.width + nx];
    if (v === WALL) return -1;
    let base = 1;
    if (nx !== x && ny !== y) {
      if (this.cells[y * this.width + nx] === WALL || this.cells[ny * this.width + x] === WALL) {
        return -1;
      }
      base = SQ2;
    }
    return v === WIND ? base * WIND_COST : base;
  }
}

/** Cost of a path of cell indices, recomputed from the grid (not taken from a planner). */
export function pathCost(grid: Grid, path: ArrayLike<number>): number {
  let c = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as number;
    const b = path[i] as number;
    const diagonal =
      a % grid.width !== b % grid.width && Math.floor(a / grid.width) !== Math.floor(b / grid.width);
    c += (diagonal ? SQ2 : 1) * (grid.cells[b] === WIND ? WIND_COST : 1);
  }
  return c;
}

/** What a planner returns for one plan. `path` is a fresh copy, safe to keep. */
export interface PlanResult {
  found: boolean;
  /** Cell indices from start to goal inclusive; empty when not found. */
  path: Int32Array;
  /** Total path cost, or -1 when not found. */
  cost: number;
  /** Nodes expanded by this plan (measured, not estimated). */
  expanded: number;
  /** Wall-clock milliseconds the plan took, from `performance.now()`. */
  ms: number;
}

/** The result for "no route". */
export function noPath(expanded: number, ms: number): PlanResult {
  return { found: false, path: new Int32Array(0), cost: -1, expanded, ms };
}

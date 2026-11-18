import { createLogger } from '../../../lib/logger';
import { AStar } from './planner/astar';
import { DStarLite } from './planner/dstar';
import { FREE, Grid, WALL, WIND, octile, type PlanResult } from './planner/grid';
import { mulberry32, randInt } from './planner/rng';
import { Trajectory, type Point } from './pathMotion';
import { describeOutcome, type OutcomeKind } from './readout';
import { pickObstacleOnRoute } from './routePicker';
import { buildCity, type City } from './scene';

const log = createLogger('drone');

/** The two planners the rig can drive the drone with. */
export type Algo = 'astar' | 'dstar';
/** What the drone is doing. */
export type Status = 'flying' | 'arrived' | 'blocked';
/** What the painting tool puts down. */
export type Tool = 'obstacle' | 'wind';

/** What one plan measured. All values come from the planner, none are estimated. */
export interface PlanStats {
  algo: Algo;
  found: boolean;
  expanded: number;
  cost: number;
  ms: number;
}

/** The result of an action: the sentence to announce and whether a plan ran. */
export interface Outcome {
  kind: OutcomeKind;
  text: string;
  replanned: boolean;
}

/** Construction options. */
export interface ModelOptions {
  cols: number;
  rows: number;
  seed?: number;
  algo?: Algo;
  /** Milliseconds to wait after arriving before picking a new goal. 0 (default) never does. */
  regoalMs?: number;
}

/** A snapshot for tests and the e2e probe. */
export interface ModelState {
  cols: number;
  rows: number;
  replans: number;
  status: Status;
  algo: Algo;
  obstacles: number;
  wind: number;
  route: number[];
  goal: { x: number; y: number };
  drone: { x: number; y: number };
}

/** Milliseconds between idle-run obstacle drops. */
const AUTO_INTERVAL_MS = 3200;
/** Idle-run starts early so the section is not static on arrival. */
const AUTO_FIRST_MS = 1500;
const MAX_AUTO_WALLS = 8;
/** Largest simulation step; a long frame (tab restored) must not teleport the drone. */
const MAX_STEP_MS = 100;
/** The drone moves at this fraction of cruise speed inside a wind zone. */
const WIND_SPEED_FACTOR = 0.45;

type Pending = { index: number; kind: 'wall' | 'wind' | 'remove' };

/**
 * Everything the rig simulates, with no DOM: the grid, both planners, the drone's position
 * and route, counters and the idle-run behaviour. The React component only forwards input and
 * draws this state, which keeps the behaviour unit testable.
 *
 * Both planners run on every re-plan (they share one grid and have separate queues), so the
 * readout can show a real expanded-node comparison. The selected algorithm decides the route.
 */
export class DroneModel {
  readonly cols: number;
  readonly rows: number;
  readonly grid: Grid;
  algo: Algo;
  status: Status = 'flying';
  goal: { x: number; y: number };
  legStart: { x: number; y: number };
  pos: Point;
  route: number[] = [];
  routeIdx = 0;
  replans = 0;
  lastPlan: PlanStats | null = null;
  compare: { astar: PlanStats | null; dstar: PlanStats | null } = { astar: null, dstar: null };
  totals = { astar: 0, dstar: 0 };
  /** When true the rig drops obstacles on the route by itself. */
  autoplay = false;
  /** Increments on every grid change; the renderer rebuilds its static layer on it. */
  gridVersion = 0;
  /** Increments on every plan; the renderer rebuilds its heat layer on it. */
  planVersion = 0;
  /** Simulation clock in ms (advances only in `step`). */
  simTime = 0;
  /** Simulation time of the last plan, for the re-plan flash. */
  lastPlanAt = -1e9;

  private readonly seed: number;
  private readonly regoalMs: number;
  private readonly astar: AStar;
  private readonly dstar: DStarLite;
  private rng: () => number;
  private city: City;
  private trajectory: Trajectory | null = null;
  private originCell: number;
  private pending: Pending[] = [];
  private autoWalls: number[] = [];
  private autoTimer = AUTO_INTERVAL_MS - AUTO_FIRST_MS;
  private autoTicks = 0;
  private arrivedFor = 0;

  constructor(opts: ModelOptions) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.seed = opts.seed ?? 1;
    this.algo = opts.algo ?? 'astar';
    this.regoalMs = opts.regoalMs ?? 0;
    this.grid = new Grid(this.cols, this.rows);
    this.astar = new AStar(this.grid);
    this.dstar = new DStarLite(this.grid);
    this.grid.onChange(() => {
      this.gridVersion++;
    });
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.city = buildCity(this.cols, this.rows, this.seed);
    this.goal = { ...this.city.goal };
    this.legStart = { ...this.city.start };
    this.pos = { ...this.city.start };
    this.originCell = this.cellOf(this.pos.x, this.pos.y);
    this.loadScene();
    this.plan('none', false);
    log.info('model created', { cols: this.cols, rows: this.rows, seed: this.seed });
  }

  // ---- queries ----

  /** Number of wall cells. */
  get obstacleCount(): number {
    let n = 0;
    for (const v of this.grid.cells) if (v === WALL) n++;
    return n;
  }

  /** Number of wind cells. */
  get windCount(): number {
    let n = 0;
    for (const v of this.grid.cells) if (v === WIND) n++;
    return n;
  }

  /** Whether the cell index is passable (not a wall). */
  isFreeCell(i: number): boolean {
    return this.grid.cells[i] !== WALL;
  }

  /** The visited-cell counts of the last plan by the selected algorithm. */
  heat(): Uint8Array {
    return this.algo === 'astar' ? this.astar.visits : this.dstar.visits;
  }

  /** The cell index the drone is nearest to. */
  droneCell(): number {
    return this.cellOf(this.pos.x, this.pos.y);
  }

  /** The route cells still ahead of the drone (empty when none). */
  routeAhead(): number[] {
    return this.route.slice(this.routeIdx);
  }

  /** The drone's heading in radians, from the current trajectory segment. */
  heading(): number {
    return this.trajectory ? this.trajectory.position().angle : 0;
  }

  /** The polyline from the drone to the goal, in cell units. Empty when there is no route. */
  pathAhead(): Point[] {
    return this.trajectory ? this.trajectory.pointsAhead() : [];
  }

  /** 1 right after a plan, fading to 0 over `ms` of simulation time. */
  flash(ms = 380): number {
    return Math.max(0, 1 - (this.simTime - this.lastPlanAt) / ms);
  }

  /** A plain snapshot for tests and the e2e probe. */
  state(): ModelState {
    return {
      cols: this.cols,
      rows: this.rows,
      replans: this.replans,
      status: this.status,
      algo: this.algo,
      obstacles: this.obstacleCount,
      wind: this.windCount,
      route: [...this.route],
      goal: { ...this.goal },
      drone: { x: this.pos.x, y: this.pos.y },
    };
  }

  // ---- simulation ----

  /** Advances the simulation by `dtMs` and returns an outcome when something notable happened. */
  step(dtMs: number): Outcome | null {
    const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
    this.simTime += dt;
    let event: Outcome | null = null;
    if (this.status === 'flying' && this.trajectory) {
      const here = this.grid.get(Math.round(this.pos.x), Math.round(this.pos.y));
      this.trajectory.advance(dt / 1000, here === WIND ? WIND_SPEED_FACTOR : 1);
      const p = this.trajectory.position();
      this.pos = { x: p.x, y: p.y };
      this.routeIdx = Math.min(p.index, Math.max(0, this.route.length - 1));
      if (this.trajectory.done) {
        this.pos = { x: this.goal.x, y: this.goal.y };
        this.status = 'arrived';
        this.trajectory = null;
        this.route = [];
        this.routeIdx = 0;
        this.arrivedFor = 0;
        log.info('arrived', { replans: this.replans });
        event = { kind: 'arrived', text: 'The drone reached the goal.', replanned: false };
      }
    } else if (this.status === 'arrived' && this.regoalMs > 0) {
      this.arrivedFor += dt;
      if (this.arrivedFor >= this.regoalMs) {
        this.arrivedFor = 0;
        event = this.newGoal();
      }
    }
    if (this.autoplay) {
      this.autoTimer += dt;
      if (this.autoTimer >= AUTO_INTERVAL_MS) {
        this.autoTimer = 0;
        event = this.autoTick() ?? event;
      }
    }
    return event;
  }

  private autoTick(): Outcome | null {
    this.autoTicks++;
    if (this.status === 'blocked') {
      for (const i of this.autoWalls) this.grid.set(i % this.cols, Math.floor(i / this.cols), FREE);
      this.autoWalls = [];
      this.pending = [{ index: 0, kind: 'remove' }];
      return this.flush();
    }
    if (this.status !== 'flying') return null;
    if (this.autoWalls.length >= MAX_AUTO_WALLS || (this.autoTicks % 4 === 0 && this.autoWalls.length > 0)) {
      const i = this.autoWalls.shift() as number;
      this.grid.set(i % this.cols, Math.floor(i / this.cols), FREE);
      this.pending.push({ index: i, kind: 'remove' });
      return this.flush();
    }
    const cell = this.pickRouteCell();
    if (cell < 0) return null;
    this.grid.set(cell % this.cols, Math.floor(cell / this.cols), WALL);
    this.pending.push({ index: cell, kind: 'wall' });
    this.autoWalls.push(cell);
    const out = this.flush();
    if (this.status === 'blocked') {
      // The idle run never traps the drone: take the block back.
      this.grid.set(cell % this.cols, Math.floor(cell / this.cols), FREE);
      this.autoWalls.pop();
      this.pending.push({ index: cell, kind: 'remove' });
      return this.flush();
    }
    return out;
  }

  // ---- visitor actions ----

  /**
   * Changes one cell. Returns true when the grid changed. Walls are refused on the goal and under
   * the drone. Call {@link flush} afterwards to re-plan if the route is affected.
   */
  paint(x: number, y: number, tool: Tool, erase: boolean): boolean {
    if (!this.grid.inBounds(x, y)) return false;
    const cur = this.grid.get(x, y);
    const i = y * this.cols + x;
    if (erase) {
      if ((tool === 'obstacle' && cur !== WALL) || (tool === 'wind' && cur !== WIND)) return false;
      this.grid.set(x, y, FREE);
      this.autoWalls = this.autoWalls.filter((c) => c !== i);
      this.pending.push({ index: i, kind: 'remove' });
      return true;
    }
    if (tool === 'obstacle') {
      if (cur === WALL) return false;
      if (x === this.goal.x && y === this.goal.y) return false;
      if (i === this.droneCell()) return false;
      this.grid.set(x, y, WALL);
      this.pending.push({ index: i, kind: 'wall' });
      return true;
    }
    if (cur !== FREE) return false;
    this.grid.set(x, y, WIND);
    this.pending.push({ index: i, kind: 'wind' });
    return true;
  }

  /**
   * Re-plans if the changes since the last flush can matter: any removal (a shorter way may have
   * opened), a wall or wind on the route ahead, or the drone currently holding. Returns null when
   * the route is unaffected.
   */
  flush(): Outcome | null {
    const changes = this.pending;
    this.pending = [];
    if (changes.length === 0) return null;
    const ahead = new Set(this.routeAhead());
    const wasBlocked = this.status === 'blocked';
    const removal = changes.some((c) => c.kind === 'remove');
    const wallOnRoute = changes.some((c) => c.kind === 'wall' && ahead.has(c.index));
    const windOnRoute = changes.some((c) => c.kind === 'wind' && ahead.has(c.index));
    if (this.status === 'arrived') return null;
    if (!wasBlocked && !removal && !wallOnRoute && !windOnRoute) return null;
    const kind: OutcomeKind = wasBlocked
      ? 'recovered'
      : wallOnRoute
        ? 'obstacle'
        : windOnRoute
          ? 'wind'
          : 'erased';
    return this.plan(kind, true);
  }

  /** Puts a wall on the route a few cells ahead of the drone, which forces a re-plan. */
  dropObstacleOnRoute(): Outcome {
    const cell = this.pickRouteCell();
    if (cell < 0) return this.nothingToBlock();
    this.paint(cell % this.cols, Math.floor(cell / this.cols), 'obstacle', false);
    return this.flush() ?? this.nothingToBlock();
  }

  /** Lays a 4x3 wind patch over a stretch of the route ahead, which forces a re-plan. */
  addWindZone(): Outcome {
    const cell = this.pickRouteCell();
    if (cell < 0) return this.nothingToBlock();
    const cx = cell % this.cols;
    const cy = Math.floor(cell / this.cols);
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 2; x++) this.paint(x, y, 'wind', false);
    }
    return this.flush() ?? this.nothingToBlock();
  }

  private nothingToBlock(): Outcome {
    return {
      kind: 'none',
      text:
        this.status === 'blocked'
          ? 'There is no route to block. Remove an obstacle first.'
          : 'Nothing to block: the drone has arrived. Pick a new goal.',
      replanned: false,
    };
  }

  private pickRouteCell(): number {
    return pickObstacleOnRoute(
      this.route,
      this.routeIdx,
      this.rng,
      (c) => this.grid.cells[c] === FREE && c !== this.goal.y * this.cols + this.goal.x,
      3,
    );
  }

  /** Sends the drone to a new random goal that is reachable and well away from it. */
  newGoal(): Outcome {
    const from = this.droneCell();
    const fx = from % this.cols;
    const fy = Math.floor(from / this.cols);
    const minDist = Math.max(6, Math.floor(this.cols * 0.4));
    let chosen: { x: number; y: number } | null = null;
    for (let tries = 0; tries < 80 && !chosen; tries++) {
      const x = randInt(this.rng, this.cols);
      const y = randInt(this.rng, this.rows);
      if (this.grid.get(x, y) !== FREE) continue;
      if ((x === this.goal.x && y === this.goal.y) || octile(fx, fy, x, y) < minDist) continue;
      if (this.astar.plan(fx, fy, x, y).found) chosen = { x, y };
    }
    if (!chosen) {
      log.warn('no reachable goal found, keeping the current one');
      return { kind: 'none', text: 'No other goal is reachable from here.', replanned: false };
    }
    this.goal = chosen;
    this.legStart = { x: fx, y: fy };
    log.debug('new goal', chosen);
    return this.plan('goal', true);
  }

  /** Moves the goal to (x, y). Null when that cell is a wall, off the map or already the goal. */
  setGoal(x: number, y: number): Outcome | null {
    if (!this.grid.inBounds(x, y) || this.grid.get(x, y) === WALL) return null;
    if (x === this.goal.x && y === this.goal.y) return null;
    const from = this.droneCell();
    this.goal = { x, y };
    this.legStart = { x: from % this.cols, y: Math.floor(from / this.cols) };
    return this.plan('goal', true);
  }

  /** Chooses which planner drives the route. Both keep running; this changes what is reported. */
  setAlgo(algo: Algo): Outcome {
    this.algo = algo;
    const stats = this.compare[algo];
    if (stats) this.lastPlan = stats;
    this.planVersion++;
    const facts = stats ?? { found: false, ms: 0, expanded: 0 };
    return {
      kind: 'algorithm',
      text: describeOutcome('algorithm', facts),
      replanned: false,
    };
  }

  /** Back to the starting city, start, goal and counters. Keeps the chosen algorithm. */
  reset(): Outcome {
    this.loadScene();
    this.goal = { ...this.city.goal };
    this.legStart = { ...this.city.start };
    this.pos = { ...this.city.start };
    this.replans = 0;
    this.totals = { astar: 0, dstar: 0 };
    this.compare = { astar: null, dstar: null };
    this.autoWalls = [];
    this.pending = [];
    this.arrivedFor = 0;
    this.autoTimer = AUTO_INTERVAL_MS - AUTO_FIRST_MS;
    this.autoTicks = 0;
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.dstar.reset();
    this.plan('reset', false);
    log.info('reset');
    return {
      kind: 'reset',
      text: describeOutcome('reset', this.lastPlan ?? { found: false, ms: 0, expanded: 0 }),
      replanned: false,
    };
  }

  // ---- internals ----

  private loadScene(): void {
    this.grid.clear();
    for (const [x, y] of this.city.walls) this.grid.set(x, y, WALL);
    for (const [x, y] of this.city.wind) this.grid.set(x, y, WIND);
    this.gridVersion++;
  }

  private cellOf(x: number, y: number): number {
    return Math.round(y) * this.cols + Math.round(x);
  }

  /** The cell a new plan starts from: where the drone is heading, else behind it, else under it. */
  private chooseStart(): number {
    const cur = this.droneCell();
    const candidates: number[] = [];
    if (this.status === 'flying' && this.route.length > 0) {
      const next = this.route[this.routeIdx];
      if (next !== undefined) candidates.push(next);
      candidates.push(this.routeIdx > 0 ? (this.route[this.routeIdx - 1] as number) : this.originCell);
    }
    candidates.push(cur);
    const cx = cur % this.cols;
    const cy = Math.floor(cur / this.cols);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) candidates.push((cy + dy) * this.cols + cx + dx);
    }
    for (const c of candidates) {
      const x = c % this.cols;
      const y = Math.floor(c / this.cols);
      if (c >= 0 && this.grid.inBounds(x, y) && this.grid.get(x, y) !== WALL) return c;
    }
    return -1;
  }

  private stats(algo: Algo, r: PlanResult): PlanStats {
    return { algo, found: r.found, expanded: r.expanded, cost: r.cost, ms: r.ms };
  }

  /**
   * Runs both planners from the chosen start cell, adopts the selected algorithm's route, and
   * updates counters. `count` adds one to the re-plan total (false for the first plan and resets).
   */
  private plan(kind: OutcomeKind, count: boolean): Outcome {
    const wasFlying = this.status === 'flying' && this.trajectory !== null;
    const start = this.chooseStart();
    let ra: PlanResult;
    let rd: PlanResult;
    if (start < 0) {
      ra = rd = { found: false, path: new Int32Array(0), cost: -1, expanded: 0, ms: 0 };
    } else {
      const sx = start % this.cols;
      const sy = Math.floor(start / this.cols);
      ra = this.astar.plan(sx, sy, this.goal.x, this.goal.y);
      rd = this.dstar.plan(sx, sy, this.goal.x, this.goal.y);
      if (ra.found !== rd.found || (ra.found && Math.abs(ra.cost - rd.cost) > 1e-6)) {
        log.error('planners disagree', { astar: ra.cost, dstar: rd.cost });
      }
    }
    const sa = this.stats('astar', ra);
    const sd = this.stats('dstar', rd);
    this.compare = { astar: sa, dstar: sd };
    this.totals.astar += ra.expanded;
    this.totals.dstar += rd.expanded;
    const main = this.algo === 'astar' ? ra : rd;
    this.lastPlan = this.algo === 'astar' ? sa : sd;
    this.planVersion++;
    this.lastPlanAt = this.simTime;
    if (count) this.replans++;
    this.originCell = this.droneCell();
    if (main.found) {
      this.route = Array.from(main.path);
      this.routeIdx = 0;
      const pts: Point[] = [{ x: this.pos.x, y: this.pos.y }];
      for (const c of this.route) pts.push({ x: c % this.cols, y: Math.floor(c / this.cols) });
      this.trajectory = new Trajectory(pts, { warm: wasFlying });
      this.status = this.trajectory.done ? 'arrived' : 'flying';
      if (this.status === 'arrived') this.trajectory = null;
    } else {
      this.route = [];
      this.routeIdx = 0;
      this.trajectory = null;
      this.status = 'blocked';
    }
    log.debug('plan', {
      kind,
      algo: this.algo,
      found: main.found,
      astarNodes: ra.expanded,
      dstarNodes: rd.expanded,
      cost: main.cost,
      ms: main.ms,
    });
    return {
      kind,
      text: describeOutcome(kind, { found: main.found, ms: main.ms, expanded: main.expanded }),
      replanned: true,
    };
  }
}

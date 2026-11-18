import { cappedDpr } from '../../../lib/webgl';
import type { Algo, DroneModel } from './model';
import { easeInOutCubic, easeOutCubic, type Point } from './pathMotion';
import { WALL, WIND } from './planner/grid';

/*
 * Canvas 2D renderer for the drone rig. The grid is logical and square; what is drawn is not:
 * cells are dots, buildings are soft rounded blocks with a little height, wind is a merged
 * soft region with moving flow lines, the visited cells flood out as blobs that merge, the
 * route is a curve-smoothed rounded stroke, and the drone and goal are round markers.
 */

/** Colours the canvas needs, read from the design tokens so the rig never hard-codes them. */
export interface Palette {
  surface: string;
  surfaceRaised: string;
  line: string;
  lineStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  paint: string;
  paintHi: string;
  paintDeep: string;
  onPaint: string;
}

const FALLBACK: Palette = {
  surface: '#12171d',
  surfaceRaised: '#1a2129',
  line: '#2b3542',
  lineStrong: '#4a5668',
  text: '#ece8df',
  textDim: '#a8b0bc',
  textFaint: '#8a93a1',
  paint: '#ff3d6e',
  paintHi: '#ff93ae',
  paintDeep: '#b3174a',
  onPaint: '#0c1014',
};

/** Reads the palette from computed CSS custom properties on `el`, with token values as fallback. */
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    surface: v('--surface', FALLBACK.surface),
    surfaceRaised: v('--surface-raised', FALLBACK.surfaceRaised),
    line: v('--line', FALLBACK.line),
    lineStrong: v('--line-strong', FALLBACK.lineStrong),
    text: v('--text', FALLBACK.text),
    textDim: v('--text-dim', FALLBACK.textDim),
    textFaint: v('--text-faint', FALLBACK.textFaint),
    paint: v('--paint', FALLBACK.paint),
    paintHi: v('--paint-hi', FALLBACK.paintHi),
    paintDeep: v('--paint-deep', FALLBACK.paintDeep),
    onPaint: v('--on-paint', FALLBACK.onPaint),
  };
}

/** Pointer state the renderer shows: a highlight under the cursor and a short trail. */
export interface PointerView {
  /** Cell index under the pointer, or -1. */
  cell: number;
  tool: 'obstacle' | 'wind' | 'goal';
  erase: boolean;
  down: boolean;
  /** Recent cells the pointer painted over, with the clock time (ms) of each. */
  trail: readonly { cell: number; t: number }[];
}

/** Timing of the re-plan sequence, in simulation milliseconds. */
export const TIMING = {
  /** The visited cells flood outward over this long. */
  flood: 420,
  /** Freshly revealed blobs fade from bright to resting over this long. */
  floodFade: 260,
  /** The new route starts drawing this long after the re-plan. */
  drawDelay: 150,
  /** The new route takes this long to draw itself. */
  draw: 420,
  /** The old route dissolves over this long. */
  dissolve: 380,
  /** A building drops in over this long. */
  drop: 440,
  /** A building lifts out over this long. */
  lift: 360,
  /** Scan pulse. */
  scan: 560,
  /** Recoil kick. */
  recoil: 300,
} as const;

/** Cell fx older than this are ignored. */
const FX_MAX = Math.max(TIMING.drop, TIMING.lift) + 40;

const TAU = Math.PI * 2;

function makeLayer(): HTMLCanvasElement {
  return document.createElement('canvas');
}

/** A stable pseudo random number in [0, 1) for a cell, so buildings keep their height. */
export function cellHash(i: number): number {
  let h = (i + 1) * 2654435761;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Smooths a polyline by rounding its corners (quadratic curves through the midpoints) and
 * returns a dense polyline of the result, in the same units as the input. The planner path is
 * unchanged; this is for display only.
 */
export function smoothPolyline(pts: readonly Point[], stepsPerCurve = 5): Point[] {
  const n = pts.length;
  if (n < 3) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out: Point[] = [{ x: (pts[0] as Point).x, y: (pts[0] as Point).y }];
  let prev = pts[0] as Point;
  for (let i = 1; i < n - 1; i++) {
    const c = pts[i] as Point;
    const nx = pts[i + 1] as Point;
    const mx = (c.x + nx.x) / 2;
    const my = (c.y + nx.y) / 2;
    const sx = i === 1 ? prev.x : (prev.x + c.x) / 2;
    const sy = i === 1 ? prev.y : (prev.y + c.y) / 2;
    for (let k = 1; k <= stepsPerCurve; k++) {
      const t = k / stepsPerCurve;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const d = t * t;
      out.push({ x: a * sx + b * c.x + d * mx, y: a * sy + b * c.y + d * my });
    }
    prev = c;
  }
  const last = pts[n - 1] as Point;
  out.push({ x: last.x, y: last.y });
  return out;
}

interface FloodSnapshot {
  order: Int32Array;
  length: number;
}

/**
 * Draws a {@link DroneModel}. A frame is: cached static layer (ground dots, buildings, wind
 * region), the visited flood (cached once it settles), wind flow, building drop and lift,
 * route (old one dissolving, new one drawing itself), the pointer, scan pulse, goal and drone.
 * DPR is capped at 2.
 */
export class DroneRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly statics = makeLayer();
  private readonly scratch = makeLayer();
  private readonly rimLayer = makeLayer();
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private cs = 1;
  private staticKey = '';
  // flood
  private floodSerial = -1;
  private floodStart = 0;
  private flood: Record<Algo, FloodSnapshot> = {
    astar: { order: new Int32Array(0), length: 0 },
    dstar: { order: new Int32Array(0), length: 0 },
  };
  // drone feel
  private hd = 0;
  private bank = 0;
  private lastTime = 0;
  private lastPos: Point | null = null;
  private speed = 0;
  private animatedFlag = true;
  private compH = new Float32Array(0);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    private readonly model: DroneModel,
    private readonly palette: Palette,
  ) {
    this.ctx = ctx;
  }

  /** Sets the CSS width (cells are square, so height follows) and rebuilds the layers. */
  resize(cssWidth: number): void {
    this.dpr = cappedDpr(2);
    this.cs = cssWidth / this.model.cols;
    this.cssW = cssWidth;
    this.cssH = this.cs * this.model.rows;
    const pw = Math.max(1, Math.round(this.cssW * this.dpr));
    const ph = Math.max(1, Math.round(this.cssH * this.dpr));
    for (const c of [this.canvas, this.statics, this.scratch, this.rimLayer]) {
      c.width = pw;
      c.height = ph;
    }
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.staticKey = '';
  }

  /** CSS width of the canvas. */
  get width(): number {
    return this.cssW;
  }

  /** CSS height of the canvas for the current width. */
  get height(): number {
    return this.cssH;
  }

  /** Index of the cell under a point in canvas CSS pixels, or -1. */
  cellAt(px: number, py: number): number {
    const x = Math.floor(px / this.cs);
    const y = Math.floor(py / this.cs);
    if (x < 0 || y < 0 || x >= this.model.cols || y >= this.model.rows) return -1;
    return y * this.model.cols + x;
  }

  // ---- building geometry (shared by the static layer and the drop/lift animation) ----

  private buildingHeight(i: number): number {
    return this.compH[i] || this.cs * 0.2;
  }

  /** Labels 4-connected wall blocks and gives each one a single height, so a block reads as one solid. */
  private labelBlocks(): void {
    const { cols, rows } = this.model;
    const cells = this.model.grid.cells;
    const n = cols * rows;
    if (this.compH.length !== n) this.compH = new Float32Array(n);
    this.compH.fill(0);
    const stack: number[] = [];
    const members: number[] = [];
    for (let i = 0; i < n; i++) {
      if (cells[i] !== WALL || this.compH[i] !== 0) continue;
      members.length = 0;
      stack.push(i);
      this.compH[i] = -1;
      while (stack.length) {
        const c = stack.pop() as number;
        members.push(c);
        const x = c % cols;
        const y = (c - x) / cols;
        for (const [nx, ny] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          if (cells[j] === WALL && this.compH[j] === 0) {
            this.compH[j] = -1;
            stack.push(j);
          }
        }
      }
      const root = Math.min(...members);
      const h = this.cs * (0.16 + 0.24 * cellHash(root));
      for (const c of members) this.compH[c] = h;
    }
  }

  /**
   * One soft building cell: a contact shadow, a darker side, and a lighter top with a soft
   * highlight along its upper edge. Neighbouring wall cells join up (no gap, no rounding on the
   * shared edge), so a city block reads as one rounded solid. `rise` lifts it off the ground in
   * px (used while dropping and lifting).
   */
  private building(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    h: number,
    rise: number,
    alpha: number,
    shadowAlpha: number,
  ): void {
    const cs = this.cs;
    const p = this.palette;
    const g = this.model.grid;
    const pad = cs * 0.09;
    const wl = g.get(x - 1, y) === WALL;
    const wr = g.get(x + 1, y) === WALL;
    const wu = g.get(x, y - 1) === WALL;
    const wd = g.get(x, y + 1) === WALL;
    const left = x * cs + (wl ? 0 : pad);
    const right = (x + 1) * cs - (wr ? 0 : pad);
    const top = y * cs + (wu ? 0 : pad) - rise;
    const bottom = (y + 1) * cs - (wd ? 0 : pad) - rise;
    const w = right - left;
    const hh = bottom - top;
    const r = cs * 0.34;
    const radii = [!wu && !wl ? r : 0, !wu && !wr ? r : 0, !wd && !wr ? r : 0, !wd && !wl ? r : 0];
    ctx.save();
    // contact shadow on the ground
    ctx.globalAlpha = alpha * shadowAlpha;
    ctx.fillStyle = '#05070a';
    ctx.beginPath();
    ctx.roundRect(left + cs * 0.09, top + rise + cs * 0.12, w, hh, radii);
    ctx.fill();
    // side
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.line;
    ctx.beginPath();
    ctx.roundRect(left, top, w, hh, radii);
    ctx.fill();
    ctx.fillStyle = '#05070a';
    ctx.globalAlpha = alpha * 0.25;
    ctx.beginPath();
    ctx.roundRect(left, top, w, hh, radii);
    ctx.fill();
    // top
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.lineStrong;
    ctx.beginPath();
    ctx.roundRect(left, top - h, w, hh, radii);
    ctx.fill();
    // highlight along the upper edge of the block
    if (!wu) {
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(
        left + (wl ? 0 : cs * 0.16),
        top - h + cs * 0.1,
        w - (wl ? 0 : cs * 0.16) - (wr ? 0 : cs * 0.16),
        cs * 0.14,
        cs * 0.07,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- static layer ----

  private activeFx(): Map<number, { age: number; from: number; to: number }> {
    const out = new Map<number, { age: number; from: number; to: number }>();
    for (const [i, fx] of this.model.cellFx) {
      const age = this.model.simTime - fx.t0;
      if (age > FX_MAX) {
        this.model.cellFx.delete(i);
        continue;
      }
      out.set(i, { age, from: fx.from, to: fx.to });
    }
    return out;
  }

  private rebuildStatic(skip: ReadonlyMap<number, unknown>): void {
    const ctx = this.statics.getContext('2d');
    if (!ctx) return;
    const { cols, rows } = this.model;
    const cells = this.model.grid.cells;
    const cs = this.cs * this.dpr;
    const p = this.palette;
    this.labelBlocks();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.surface;
    ctx.fillRect(0, 0, this.statics.width, this.statics.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const css = this.cs;
    // ground: a dot at every cell centre
    ctx.fillStyle = p.lineStrong;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (cells[y * cols + x] === WALL) continue;
        ctx.moveTo((x + 0.5) * css + css * 0.07, (y + 0.5) * css);
        ctx.arc((x + 0.5) * css, (y + 0.5) * css, css * 0.07, 0, TAU);
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    // wind: one soft merged region (cells drawn slightly oversize so neighbours fuse)
    ctx.fillStyle = p.textDim;
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (cells[y * cols + x] !== WIND) continue;
        ctx.roundRect(
          x * css - css * 0.02,
          y * css - css * 0.02,
          css * 1.04,
          css * 1.04,
          css * 0.42,
        );
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    // buildings, back to front
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (cells[i] !== WALL || skip.has(i)) continue;
        this.building(ctx, x, y, this.buildingHeight(i), 0, 1, 0.34);
      }
    }
    void cs;
    this.staticKey = `${this.model.gridVersion}:${skip.size}`;
  }

  // ---- flood ----

  private syncFlood(): void {
    const m = this.model;
    if (m.planSerial === this.floodSerial) return;
    this.floodSerial = m.planSerial;
    this.floodStart = m.simTime;
    for (const algo of ['astar', 'dstar'] as const) {
      const e = m.expansion(algo);
      this.flood[algo] = { order: e.order.slice(0, e.length), length: e.length };
    }
  }

  /** Draws the first `count` cells of an expansion as merged circles in one flat colour. */
  private blobs(
    ctx: CanvasRenderingContext2D,
    snap: FloodSnapshot,
    count: number,
    colour: string,
    alpha: number,
    radius: number,
  ): void {
    if (count <= 0) return;
    const cols = this.model.cols;
    const cs = this.cs;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.beginPath();
    const n = Math.min(count, snap.length);
    for (let k = 0; k < n; k++) {
      const c = snap.order[k] as number;
      const cx = ((c % cols) + 0.5) * cs;
      const cy = (Math.floor(c / cols) + 0.5) * cs;
      ctx.roundRect(
        cx - cs * radius,
        cy - cs * radius,
        cs * radius * 2,
        cs * radius * 2,
        cs * radius * 0.4,
      );
    }
    ctx.fill();
    ctx.restore();
  }

  /**
   * The visited region of one planner: a flat blob layer composited once, so overlapping circles
   * merge instead of stacking brighter.
   */
  private drawRegion(
    snap: FloodSnapshot,
    count: number,
    colour: string,
    alpha: number,
    outline = false,
  ): void {
    const sctx = this.scratch.getContext('2d');
    if (!sctx || count <= 0) return;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, this.scratch.width, this.scratch.height);
    sctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.blobs(sctx, snap, count, colour, 1, 0.64);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    if (!outline) {
      ctx.drawImage(this.scratch, 0, 0);
      ctx.restore();
      return;
    }
    // rim only: the region stamped around itself, minus the region
    const rim = this.rimLayer.getContext('2d');
    if (!rim) {
      ctx.restore();
      return;
    }
    rim.setTransform(1, 0, 0, 1, 0, 0);
    rim.globalCompositeOperation = 'source-over';
    rim.clearRect(0, 0, this.rimLayer.width, this.rimLayer.height);
    const d = Math.max(1.5, this.cs * 0.07) * this.dpr;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      rim.drawImage(this.scratch, Math.cos(a) * d, Math.sin(a) * d);
    }
    rim.globalCompositeOperation = 'destination-out';
    rim.drawImage(this.scratch, 0, 0);
    rim.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.rimLayer, 0, 0);
    ctx.restore();
  }

  private drawFlood(): void {
    const m = this.model;
    const p = this.palette;
    const ctx = this.ctx;
    const age = this.animatedFlag ? m.simTime - this.floodStart : Infinity;
    const u = Math.min(1, Math.max(0, age / TIMING.flood));
    const prog = this.animatedFlag ? easeOutCubic(u) : 1;
    const selected = m.algo;
    const other: Algo = selected === 'astar' ? 'dstar' : 'astar';
    const colour = (a: Algo) => (a === 'astar' ? p.text : p.paint);
    // regions settle back a few seconds after the plan so the map is not left cluttered
    const rest = this.animatedFlag ? 1 - 0.55 * Math.min(1, Math.max(0, (age - 3200) / 1600)) : 1;
    // the selected planner's region is filled; the other one's rim is drawn for comparison
    this.drawRegion(
      this.flood[selected],
      Math.round(this.flood[selected].length * prog),
      colour(selected),
      (selected === 'astar' ? 0.15 : 0.22) * rest,
    );
    this.drawRegion(
      this.flood[other],
      Math.round(this.flood[other].length * prog),
      colour(other),
      0.7 * rest,
      true,
    );
    // the wavefront: cells that just appeared flare, then settle
    if (this.animatedFlag && age < TIMING.flood + TIMING.floodFade) {
      const snap = this.flood[selected];
      const n = snap.length;
      const head = Math.round(n * prog);
      const lead = Math.max(10, Math.round(n * 0.16));
      ctx.save();
      for (let k = Math.max(0, head - lead); k < head; k++) {
        const c = snap.order[k] as number;
        const rec = (k - (head - lead)) / lead; // 0 old .. 1 newest
        const settle = u < 1 ? 1 : 1 - (age - TIMING.flood) / TIMING.floodFade;
        const a = Math.max(0, rec * 0.5 * settle);
        if (a <= 0.01) continue;
        const cx = ((c % m.cols) + 0.5) * this.cs;
        const cy = (Math.floor(c / m.cols) + 0.5) * this.cs;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.paintHi;
        ctx.beginPath();
        ctx.arc(cx, cy, this.cs * (0.22 + 0.3 * rec), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- wind ----

  private drawWindFlow(time: number): void {
    const m = this.model;
    const ctx = this.ctx;
    const cells = m.grid.cells;
    const cols = m.cols;
    const cs = this.cs;
    ctx.save();
    ctx.strokeStyle = this.palette.textDim;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, cs * 0.06);
    const t = this.animatedFlag ? time * 0.00045 : 0.25;
    for (let y = 0; y < m.rows; y++) {
      const rowPhase = cellHash(y * 977);
      for (let x = 0; x < cols; x++) {
        if (cells[y * cols + x] !== WIND) continue;
        for (let k = 0; k < 2; k++) {
          const phase = (t * (1 + k * 0.35) + rowPhase + k * 0.5) % 1;
          const env = Math.sin(Math.PI * phase);
          if (env < 0.05) continue;
          const len = cs * 0.5;
          const sx = x * cs + phase * (cs - len) * 1.0 + cs * 0.05;
          const sy = y * cs + cs * (0.3 + 0.42 * k) + Math.sin(phase * TAU) * cs * 0.05;
          ctx.globalAlpha = 0.55 * env;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + len * 0.5, sy - cs * 0.1, sx + len, sy);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ---- buildings dropping and lifting ----

  private drawBuildingFx(fx: ReadonlyMap<number, { age: number; from: number; to: number }>): void {
    const ctx = this.ctx;
    const cols = this.model.cols;
    const cs = this.cs;
    for (const [i, f] of fx) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      const h = this.buildingHeight(i);
      if (f.to === WALL) {
        const u = Math.min(1, f.age / TIMING.drop);
        const fall = 0.62;
        if (u < fall) {
          const t = u / fall;
          const rise = (1 - t * t) * cs * 2.8;
          this.building(ctx, x, y, h, rise, Math.min(1, t * 3), 0.34 * t);
        } else {
          const v = (u - fall) / (1 - fall);
          const squash = 1 - 0.55 * Math.sin(Math.PI * v) * (1 - v);
          this.building(ctx, x, y, h * squash, 0, 1, 0.34);
          // dust ring where it lands
          ctx.save();
          ctx.strokeStyle = this.palette.textDim;
          ctx.globalAlpha = (1 - v) * 0.5;
          ctx.lineWidth = Math.max(1, cs * 0.05);
          ctx.beginPath();
          ctx.arc((x + 0.5) * cs, (y + 0.55) * cs, cs * (0.5 + 0.7 * easeOutCubic(v)), 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      } else if (f.from === WALL) {
        const u = Math.min(1, f.age / TIMING.lift);
        const e = easeInOutCubic(u);
        this.building(ctx, x, y, h, e * cs * 1.9, 1 - e, 0.34 * (1 - e));
      }
    }
  }

  // ---- route ----

  private strokePoly(
    ctx: CanvasRenderingContext2D,
    pts: readonly Point[],
    from: number,
    to: number,
  ): void {
    const cs = this.cs;
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const q = pts[i] as Point;
      if (i === from) ctx.moveTo((q.x + 0.5) * cs, (q.y + 0.5) * cs);
      else ctx.lineTo((q.x + 0.5) * cs, (q.y + 0.5) * cs);
    }
    ctx.stroke();
  }

  private drawRoute(): void {
    const m = this.model;
    const ctx = this.ctx;
    const p = this.palette;
    const cs = this.cs;
    const sinceRoute = this.animatedFlag ? m.simTime - m.lastPlanAt : Infinity;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // the old route dissolves: it thins and breaks into dashes while it fades
    if (this.animatedFlag && m.prevPath.length > 1 && sinceRoute < TIMING.dissolve) {
      const q = easeOutCubic(sinceRoute / TIMING.dissolve);
      const old = smoothPolyline(m.prevPath);
      ctx.strokeStyle = p.textFaint;
      ctx.globalAlpha = 0.55 * (1 - q);
      ctx.lineWidth = Math.max(2, cs * 0.16) * (1 - 0.6 * q);
      ctx.setLineDash([cs * 0.3, cs * (0.05 + 0.5 * q)]);
      this.strokePoly(ctx, old, 0, old.length - 1);
      ctx.setLineDash([]);
    }

    const pts = smoothPolyline(m.pathAhead());
    if (pts.length > 1) {
      // cumulative length for the draw-on
      const cum: number[] = [0];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1] as Point;
        const b = pts[i] as Point;
        cum.push((cum[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
      }
      const total = cum[cum.length - 1] as number;
      const drawU = this.animatedFlag
        ? Math.min(1, Math.max(0, (sinceRoute - TIMING.drawDelay) / TIMING.draw))
        : 1;
      const head = total * easeInOutCubic(drawU);
      const lw = Math.max(2.5, cs * 0.2);
      const tailLen = Math.max(4, total * 0.22);
      // wide soft ribbon underneath
      ctx.strokeStyle = p.paint;
      ctx.globalAlpha = 0.16 * (drawU < 1 ? easeInOutCubic(drawU) : 1);
      ctx.lineWidth = lw * 2.2;
      let last = 0;
      for (let i = 1; i < pts.length && (cum[i - 1] as number) < head; i++) last = i;
      if (last > 0) this.strokePoly(ctx, pts, 0, last);
      // the route itself, in chunks so the tail can fade behind a bright head
      ctx.lineWidth = lw;
      const chunk = 4;
      for (let s = 0; s < pts.length - 1; s += chunk) {
        const e = Math.min(pts.length - 1, s + chunk);
        const d0 = cum[s] as number;
        if (d0 >= head) break;
        const dEnd = Math.min(cum[e] as number, head);
        const behind = Math.max(0, head - dEnd);
        const bright = drawU < 1 ? Math.max(0, 1 - behind / tailLen) : 0;
        const rest = 0.9 * easeInOutCubic(drawU);
        ctx.globalAlpha = Math.max(rest, 0.25 + 0.75 * bright * (drawU < 1 ? 1 : 0));
        ctx.strokeStyle = bright > 0.7 ? p.paintHi : p.paint;
        this.strokePoly(ctx, pts, s, e);
      }
      // bright head
      if (drawU > 0 && drawU < 1) {
        let hi = 0;
        while (hi < pts.length - 2 && (cum[hi + 1] as number) < head) hi++;
        const a = pts[hi] as Point;
        const b = pts[hi + 1] as Point;
        const seg = (cum[hi + 1] as number) - (cum[hi] as number);
        const f = seg > 0 ? (head - (cum[hi] as number)) / seg : 0;
        const hx = (a.x + (b.x - a.x) * f + 0.5) * cs;
        const hy = (a.y + (b.y - a.y) * f + 0.5) * cs;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, lw * 0.9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = p.paintHi;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(hx, hy, lw * 1.6, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- pointer ----

  private drawPointer(ptr: PointerView, time: number): void {
    const ctx = this.ctx;
    const cols = this.model.cols;
    const cs = this.cs;
    const p = this.palette;
    ctx.save();
    // trail: small dots that shrink and fade
    for (const t of ptr.trail) {
      const age = time - t.t;
      if (age > 420 || age < 0) continue;
      const k = 1 - age / 420;
      ctx.globalAlpha = 0.45 * k;
      ctx.fillStyle = ptr.erase ? p.textDim : ptr.tool === 'wind' ? p.textDim : p.paintHi;
      ctx.beginPath();
      ctx.arc(
        ((t.cell % cols) + 0.5) * cs,
        (Math.floor(t.cell / cols) + 0.5) * cs,
        cs * (0.12 + 0.2 * k),
        0,
        TAU,
      );
      ctx.fill();
    }
    if (ptr.cell >= 0) {
      const x = ptr.cell % cols;
      const y = Math.floor(ptr.cell / cols);
      const cx = (x + 0.5) * cs;
      const cy = (y + 0.5) * cs;
      ctx.globalAlpha = 1;
      if (ptr.tool === 'goal') {
        ctx.strokeStyle = p.text;
        ctx.lineWidth = Math.max(1.5, cs * 0.07);
        ctx.setLineDash([cs * 0.18, cs * 0.18]);
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.5, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = ptr.erase ? p.textDim : ptr.tool === 'wind' ? p.textDim : p.paint;
        ctx.globalAlpha = ptr.down ? 0.34 : 0.2;
        ctx.beginPath();
        ctx.roundRect(x * cs + cs * 0.04, y * cs + cs * 0.04, cs * 0.92, cs * 0.92, cs * 0.34);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = ptr.erase ? p.textDim : ptr.tool === 'wind' ? p.text : p.paintHi;
        ctx.lineWidth = Math.max(1.5, cs * 0.07);
        if (ptr.erase) ctx.setLineDash([cs * 0.16, cs * 0.14]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- goal, scan, drone ----

  private drawGoal(time: number): void {
    const m = this.model;
    const ctx = this.ctx;
    const cs = this.cs;
    const p = this.palette;
    const gx = (m.goal.x + 0.5) * cs;
    const gy = (m.goal.y + 0.5) * cs;
    const r = cs * 0.46;
    ctx.save();
    if (this.animatedFlag) {
      const ph = (time / 1800) % 1;
      ctx.globalAlpha = 0.45 * (1 - ph);
      ctx.strokeStyle = p.text;
      ctx.lineWidth = Math.max(1.2, cs * 0.05);
      ctx.beginPath();
      ctx.arc(gx, gy, r * (1 + 0.9 * ph), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#05070a';
    ctx.beginPath();
    ctx.ellipse(gx + r * 0.22, gy + r * 0.35, r * 1.02, r * 0.78, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.text;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.surface;
    ctx.beginPath();
    ctx.arc(gx, gy, r * 0.58, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.paint;
    ctx.beginPath();
    ctx.arc(gx, gy, r * 0.32, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(gx - r * 0.3, gy - r * 0.55, r * 0.28, r * 0.12, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawScan(): void {
    const m = this.model;
    const age = m.simTime - m.scan.at;
    if (!this.animatedFlag || age < 0 || age > TIMING.scan + 120) return;
    const ctx = this.ctx;
    const cs = this.cs;
    const cx = (m.scan.x + 0.5) * cs;
    const cy = (m.scan.y + 0.5) * cs;
    ctx.save();
    for (let k = 0; k < 2; k++) {
      const u = (age - k * 110) / TIMING.scan;
      if (u <= 0 || u >= 1) continue;
      ctx.globalAlpha = 0.7 * (1 - u) * (k === 0 ? 1 : 0.6);
      ctx.strokeStyle = this.palette.paintHi;
      ctx.lineWidth = Math.max(1.5, cs * 0.1) * (1 - u * 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, cs * (0.9 + 4.6 * easeOutCubic(u)), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private updateFeel(time: number): void {
    const m = this.model;
    const dt = Math.min(64, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    const target = m.heading();
    if (!this.animatedFlag || dt === 0) {
      this.hd = target;
      this.bank = 0;
      this.lastPos = { x: m.pos.x, y: m.pos.y };
      return;
    }
    let diff = target - this.hd;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const k = 1 - Math.exp(-dt / 90);
    this.hd += diff * k;
    const turnRate = (diff * k) / (dt / 1000); // rad/s
    const want = Math.max(-0.75, Math.min(0.75, turnRate * 0.16));
    this.bank += (want - this.bank) * (1 - Math.exp(-dt / 110));
    if (this.lastPos) {
      const v = Math.hypot(m.pos.x - this.lastPos.x, m.pos.y - this.lastPos.y) / (dt / 1000);
      this.speed += (v - this.speed) * (1 - Math.exp(-dt / 120));
    }
    this.lastPos = { x: m.pos.x, y: m.pos.y };
  }

  private drawDrone(time: number): void {
    const m = this.model;
    const ctx = this.ctx;
    const p = this.palette;
    const cs = this.cs;
    let x = (m.pos.x + 0.5) * cs;
    let y = (m.pos.y + 0.5) * cs;
    const sinceKick = m.simTime - m.recoil.at;
    if (this.animatedFlag && sinceKick >= 0 && sinceKick < TIMING.recoil) {
      const u = sinceKick / TIMING.recoil;
      const amp = cs * 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u);
      x += m.recoil.dx * amp;
      y += m.recoil.dy * amp;
    }
    const r = cs * 0.95;
    const speedN = Math.min(1, this.speed / 6.5);
    const hover = this.animatedFlag ? Math.sin(time / 380) * cs * 0.04 : 0;
    const lift = cs * (0.34 + 0.08 * speedN) + hover;
    const blocked = m.status === 'blocked';
    const sideShift = Math.sin(this.bank) * cs * 0.18;

    // ground shadow: stacked soft ellipses, offset away from the light and by the bank
    ctx.save();
    ctx.fillStyle = '#05070a';
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.13;
      const f = 1 - k * 0.2;
      ctx.beginPath();
      ctx.ellipse(
        x + cs * 0.14 + sideShift * 0.6 + Math.cos(this.hd + Math.PI / 2) * sideShift,
        y + lift * 0.55 + cs * 0.1,
        r * 1.05 * f,
        r * 0.7 * f,
        0,
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.restore();

    // body, in a frame where +x is the heading; the bank squashes it across the heading
    ctx.save();
    ctx.translate(x, y - lift);
    ctx.rotate(this.hd);
    const squash = Math.cos(this.bank);
    ctx.scale(1 + 0.05 * speedN, squash);
    const arm = r * 0.7;
    const rotorR = r * 0.4;
    const spin = this.animatedFlag ? time / 55 : 0;
    // arms
    ctx.strokeStyle = p.text;
    ctx.lineWidth = Math.max(2, cs * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-arm, -arm);
    ctx.lineTo(arm, arm);
    ctx.moveTo(arm, -arm);
    ctx.lineTo(-arm, arm);
    ctx.stroke();
    // rotors: translucent discs with a faint sweep
    for (const [i, [rx, ry]] of (
      [
        [-arm, -arm],
        [arm, -arm],
        [arm, arm],
        [-arm, arm],
      ] as [number, number][]
    ).entries()) {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = p.text;
      ctx.beginPath();
      ctx.arc(rx, ry, rotorR, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = p.text;
      ctx.lineWidth = Math.max(1.2, cs * 0.05);
      const a = spin * (i % 2 === 0 ? 1 : -1);
      ctx.beginPath();
      ctx.arc(rx, ry, rotorR * 0.86, a, a + 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rx, ry, rotorR * 0.86, a + Math.PI, a + Math.PI + 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // glossy round body
    ctx.fillStyle = blocked ? p.paintDeep : p.paint;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.46, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -r * 0.2, r * 0.26, r * 0.12, -0.45, 0, TAU);
    ctx.fill();
    // nose: a small light dot ahead so heading reads
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.onPaint;
    ctx.beginPath();
    ctx.arc(r * 0.26, 0, r * 0.09, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (blocked) {
      ctx.save();
      ctx.strokeStyle = p.paint;
      ctx.lineWidth = Math.max(1.5, cs * 0.07);
      ctx.setLineDash([cs * 0.16, cs * 0.16]);
      ctx.lineDashOffset = this.animatedFlag ? -time / 60 : 0;
      ctx.beginPath();
      ctx.arc(x, y - lift, r * 1.25, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- frame ----

  /**
   * Draws one frame. `time` is the rAF clock in ms. With `animated` false everything is drawn in
   * its settled state (floods complete, route drawn, no motion), which is what reduced motion
   * and the component tests use.
   */
  draw(time: number, animated: boolean, ptr?: PointerView): void {
    const m = this.model;
    if (this.cssW === 0) return;
    this.animatedFlag = animated;
    this.syncFlood();
    const fx = animated
      ? this.activeFx()
      : new Map<number, { age: number; from: number; to: number }>();
    const key = `${m.gridVersion}:${fx.size}`;
    if (key !== this.staticKey) this.rebuildStatic(fx);
    this.updateFeel(time);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.statics, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawFlood();
    this.drawWindFlow(time);
    if (fx.size > 0) this.drawBuildingFx(fx);
    this.drawRoute();
    // start marker: a small ring where this leg began
    const s = m.legStart;
    ctx.save();
    ctx.strokeStyle = this.palette.textFaint;
    ctx.lineWidth = Math.max(1.5, this.cs * 0.07);
    ctx.beginPath();
    ctx.arc((s.x + 0.5) * this.cs, (s.y + 0.5) * this.cs, this.cs * 0.26, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (ptr) this.drawPointer(ptr, time);
    this.drawGoal(time);
    this.drawScan();
    this.drawDrone(time);
  }
}

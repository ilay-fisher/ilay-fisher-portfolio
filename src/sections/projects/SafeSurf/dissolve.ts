/**
 * Pure maths behind the burn and re-form effect: per-image progress, the baked noise the
 * shader and the ember spawner share, and the ember pool. No DOM, no GL, so it is unit
 * tested; `BurnStage.ts` is the thin WebGL shell around it.
 *
 * Convention: progress `p` 0 = image intact, 1 = image gone. Target 1 means "burning away",
 * target 0 means "re-forming".
 */

/** Where an image is in its life. */
export type BurnPhase = 'intact' | 'burning' | 'gone' | 'forming';

/** Progress of one image. `wait` is the stagger delay left before it starts moving. */
export interface BurnState {
  p: number;
  target: 0 | 1;
  wait: number;
}

/** A burn state at rest: gone when blocked, intact when allowed. */
export function createBurn(blocked: boolean): BurnState {
  return { p: blocked ? 1 : 0, target: blocked ? 1 : 0, wait: 0 };
}

/** Points the state at blocked (burn) or allowed (re-form). Returns the same object when unchanged. */
export function setBurnTarget(s: BurnState, blocked: boolean, waitMs = 0): BurnState {
  const target = blocked ? 1 : 0;
  return s.target === target ? s : { p: s.p, target, wait: waitMs };
}

/** Advances progress by `dtMs` over a full `durationMs` sweep, after any stagger wait. */
export function stepBurn(s: BurnState, dtMs: number, durationMs: number): BurnState {
  let dt = dtMs;
  let wait = s.wait;
  if (wait > 0) {
    const used = Math.min(wait, dt);
    wait -= used;
    dt -= used;
  }
  if (dt <= 0 || s.p === s.target) return wait === s.wait ? s : { ...s, wait };
  const delta = dt / durationMs;
  const p = s.target === 1 ? Math.min(1, s.p + delta) : Math.max(0, s.p - delta);
  return { p, target: s.target, wait };
}

/** Which phase the state is in, for the draw/hide decision and the DOM probe. */
export function burnPhase(s: BurnState): BurnPhase {
  if (s.p === s.target) return s.target === 1 ? 'gone' : 'intact';
  return s.target === 1 ? 'burning' : 'forming';
}

/** Whether an image is still moving (or waiting to move). */
export function isAnimating(s: BurnState): boolean {
  return s.p !== s.target;
}

/** Half linear, half smoothstep: the front lights quickly, runs through the middle and settles. Monotonic, 0 to 1. */
export function easeBurn(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return 0.45 * t + 0.55 * t * t * (3 - 2 * t);
}

/** Stagger so images do not all light at once: 100 ms per image down the page, so the page reads as one overlapping event. */
export function staggerMs(index: number): number {
  return index * 100;
}

/** The threshold the shader compares the burn field against: below 0 to above 1 as p goes 0 to 1. */
export function frontValue(p: number, edge: number): number {
  return -edge * 2 + (1 + edge * 4) * p;
}

/** Side of the baked noise texture in texels. */
export const NOISE_SIZE = 256;

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Bakes tileable fractal value noise into `size * size` bytes (0 to 255, stretched to the full
 * range). Deterministic per seed. Baked once so neither the shader nor the ember spawner
 * ever loops octaves per pixel.
 */
export function bakeNoise(size = NOISE_SIZE, seed = 1): Uint8Array {
  const out = new Float32Array(size * size);
  const octaves = [
    { cells: 4, amp: 0.5 },
    { cells: 8, amp: 0.28 },
    { cells: 16, amp: 0.14 },
    { cells: 32, amp: 0.08 },
  ];
  for (const { cells, amp } of octaves) {
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const a = hash2(x0 % cells, y0 % cells, seed + cells);
        const b = hash2((x0 + 1) % cells, y0 % cells, seed + cells);
        const c = hash2(x0 % cells, (y0 + 1) % cells, seed + cells);
        const d = hash2((x0 + 1) % cells, (y0 + 1) % cells, seed + cells);
        const top = a + (b - a) * sx;
        const bottom = c + (d - c) * sx;
        out[y * size + x]! += (top + (bottom - top) * sy) * amp;
      }
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of out) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const bytes = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) bytes[i] = Math.round(((out[i]! - min) / (max - min)) * 255);
  return bytes;
}

/** Bilinear, wrapping sample of baked noise at `u, v` (any range), result 0 to 1. */
export function sampleNoise(data: Uint8Array, size: number, u: number, v: number): number {
  const x = (((u * size) % size) + size) % size;
  const y = (((v * size) % size) + size) % size;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const x1 = (x0 + 1) % size;
  const y1 = (y0 + 1) % size;
  const at = (xx: number, yy: number) => data[yy * size + xx]! / 255;
  const top = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * fx;
  const bottom = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * fx;
  return top + (bottom - top) * fy;
}

/** Scale of the coarse noise lookup. The fragment shader uses the same number. */
export const NOISE_SCALE = 1.7;
/** Scale of the fine noise layer that roughens the front. Matches the shader. */
export const NOISE2_SCALE = 4.3;
/** Weight of the coarse noise layer. Matches the shader. */
export const NOISE_WEIGHT = 0.4;
/** Weight of the fine noise layer. Matches the shader. */
export const NOISE2_WEIGHT = 0.1;
/** Weight of distance from the burn origin. The fragment shader uses the same number. */
export const ORIGIN_WEIGHT = 0.8;
/** Half-width of the glowing front, in field units. The fragment shader uses the same number. */
export const EDGE = 0.05;
/** The field is divided by this so it spans about 0 to 1. The fragment shader uses the same number. */
export const FIELD_NORM = 1.2;

/**
 * The burn field at `u, v` (0 burns first). CPU twin of the shader: the same two noise layers,
 * scales and origin falloff, so embers appear exactly where the glowing front is.
 */
export function burnFieldValue(
  noise: Uint8Array,
  size: number,
  u: number,
  v: number,
  origin: readonly [number, number],
): number {
  const n = sampleNoise(noise, size, u * NOISE_SCALE, v * NOISE_SCALE);
  const n2 = sampleNoise(noise, size, u * NOISE2_SCALE + 0.37, v * NOISE2_SCALE + 0.71);
  const dir = Math.hypot(u - origin[0], v - origin[1]) * ORIGIN_WEIGHT;
  return Math.min(1, Math.max(0, (n * NOISE_WEIGHT + n2 * NOISE2_WEIGHT + dir) / FIELD_NORM));
}

/** Random image-space point (0 to 1) on the current burn front, or null if none found in `tries`. */
export function pickFrontPoint(
  noise: Uint8Array,
  size: number,
  origin: readonly [number, number],
  p: number,
  edge: number,
  rng: () => number,
  tries = 40,
): { u: number; v: number } | null {
  const front = frontValue(p, edge);
  for (let i = 0; i < tries; i++) {
    const u = rng();
    const v = rng();
    if (Math.abs(burnFieldValue(noise, size, u, v, origin) - front) < edge) return { u, v };
  }
  return null;
}

/** How many embers to spawn this frame at `ratePerSec`, carrying the fraction to the next frame. */
export function emberSpawnCount(
  phase: BurnPhase,
  dtMs: number,
  carry: number,
  ratePerSec: number,
): { count: number; carry: number } {
  if (phase !== 'burning' && phase !== 'forming') return { count: 0, carry: 0 };
  const total = carry + (ratePerSec * dtMs) / 1000;
  const count = Math.floor(total);
  return { count, carry: total - count };
}

/** Ember colour (linear 0 to 1 rgb, not faded) at life fraction `t`. Hot to paint to ash when burning, mint to white when re-forming. */
export function emberColor(t: number, cool: boolean): [number, number, number] {
  const k = Math.min(1, Math.max(0, t));
  if (cool) return [0.26 + 0.3 * k, 0.74 + 0.18 * k, 0.56 + 0.2 * k];
  if (k < 0.3) {
    const m = k / 0.3;
    return [1, 0.62 - 0.38 * m, 0.52 - 0.1 * m];
  }
  const m = (k - 0.3) / 0.7;
  return [1 - 0.72 * m, 0.33 - 0.27 * m, 0.38 - 0.26 * m];
}

/** Ember opacity at life fraction `t`: quick rise, long fade. Re-forming embers brighten as they arrive. */
export function emberAlpha(t: number, cool: boolean): number {
  const k = Math.min(1, Math.max(0, t));
  if (cool) return Math.min(1, k * 4) * (1 - Math.max(0, k - 0.85) / 0.15);
  return Math.min(1, k * 10) * (1 - k) * (1 - k * 0.2);
}

/**
 * Fixed-capacity particle pool for embers. Positions are in CSS pixels, y down. Burning embers
 * lift on buoyancy with two-frequency turbulence and drag; re-forming embers start scattered
 * around the point they are knitting back into and converge on it.
 */
export class EmberPool {
  readonly x: Float32Array;
  readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private readonly tx: Float32Array;
  private readonly ty: Float32Array;
  private readonly phase: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly cool: Uint8Array;
  /** Live embers; they occupy indices 0 to count - 1. */
  count = 0;

  constructor(
    readonly capacity: number,
    private readonly rng: () => number,
  ) {
    const f = () => new Float32Array(capacity);
    this.x = f();
    this.y = f();
    this.vx = f();
    this.vy = f();
    this.sx = f();
    this.sy = f();
    this.tx = f();
    this.ty = f();
    this.phase = f();
    this.age = f();
    this.life = f();
    this.size = f();
    this.cool = new Uint8Array(capacity);
  }

  /** Adds an ember at `x, y` (for cool ones: the point it converges on). Returns false when the pool is full. */
  spawn(x: number, y: number, cool: boolean): boolean {
    if (this.count >= this.capacity) return false;
    const i = this.count++;
    const r = this.rng;
    this.phase[i] = r() * 6.283;
    this.age[i] = 0;
    this.cool[i] = cool ? 1 : 0;
    this.size[i] = cool ? 2 + r() * 2.6 : 2.6 + r() * 3.6;
    this.life[i] = cool ? 420 + r() * 380 : 700 + r() * 1000;
    this.tx[i] = x;
    this.ty[i] = y;
    if (cool) {
      this.sx[i] = x + (r() - 0.5) * 90;
      this.sy[i] = y - 14 - r() * 46;
      this.x[i] = this.sx[i]!;
      this.y[i] = this.sy[i]!;
      this.vx[i] = 0;
      this.vy[i] = 0;
    } else {
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = (r() - 0.5) * 30;
      this.vy[i] = -(24 + r() * 56);
    }
    return true;
  }

  /** Moves and ages every ember, then removes the dead by swapping in the last one. */
  step(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = 0; i < this.count;) {
      this.age[i]! += dtMs;
      const t = this.age[i]! / this.life[i]!;
      if (t >= 1) {
        this.moveLast(i);
        continue;
      }
      const a = this.age[i]!;
      const ph = this.phase[i]!;
      if (this.cool[i] === 1) {
        const e = t * t * (3 - 2 * t);
        const swirl = (1 - t) * 6;
        this.x[i] = this.sx[i]! + (this.tx[i]! - this.sx[i]!) * e + Math.sin(a / 70 + ph) * swirl;
        this.y[i] = this.sy[i]! + (this.ty[i]! - this.sy[i]!) * e + Math.cos(a / 90 + ph) * swirl;
      } else {
        const turb = Math.sin(a / 170 + ph) * 18 + Math.sin(a / 57 + ph * 2.3) * 7;
        this.vy[i]! -= 70 * dt;
        this.vx[i]! *= 1 - 0.9 * dt;
        this.vy[i]! *= 1 - 0.6 * dt;
        this.x[i]! += (this.vx[i]! + turb) * dt;
        this.y[i]! += this.vy[i]! * dt;
      }
      i++;
    }
  }

  private moveLast(i: number): void {
    const last = --this.count;
    if (i === last) return;
    const all = [
      this.x,
      this.y,
      this.vx,
      this.vy,
      this.sx,
      this.sy,
      this.tx,
      this.ty,
      this.phase,
      this.age,
      this.life,
      this.size,
      this.cool,
    ];
    for (const a of all) a[i] = a[last]!;
  }

  /** Writes positions (xy), colours (rgba, premultiplied) and sizes for the live embers. Returns how many. */
  write(pos: Float32Array, col: Float32Array, size: Float32Array): number {
    for (let i = 0; i < this.count; i++) {
      const cool = this.cool[i] === 1;
      const t = this.age[i]! / this.life[i]!;
      pos[i * 2] = this.x[i]!;
      pos[i * 2 + 1] = this.y[i]!;
      const [r, g, b] = emberColor(t, cool);
      const al = emberAlpha(t, cool);
      col[i * 4] = r;
      col[i * 4 + 1] = g;
      col[i * 4 + 2] = b;
      col[i * 4 + 3] = al;
      const flicker = 0.85 + 0.15 * Math.sin(this.age[i]! / 45 + this.phase[i]!);
      size[i] = this.size[i]! * (cool ? 0.6 + 0.6 * t : (1 - t * 0.65) * flicker);
    }
    return this.count;
  }
}

/** Small seeded RNG (mulberry32) so the burn looks the same every run. */
export function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Drone motion along a path: arc-length sampling of a polyline, easing curves and a speed
 * profile (ease in from rest, brake into the goal). Pure maths, no DOM, so it is unit tested;
 * the canvas only draws what this returns.
 */

/** A point in cell units (cell centres sit on integer coordinates). */
export interface Point {
  x: number;
  y: number;
}

/** A sampled position on a polyline. */
export interface Sample extends Point {
  /** Heading in radians (0 = +x, pi/2 = +y, canvas orientation). */
  angle: number;
  /** Index of the segment the sample lies on: it runs from `points[index]` to `points[index + 1]`. */
  index: number;
}

/** Cruise speed in cells per second. */
export const CRUISE_SPEED = 6.5;
/** Seconds to ease from rest up to cruise speed. */
export const RAMP_SECONDS = 0.35;
/** Distance in cells over which the drone slows into the end of the path. */
export const BRAKE_DISTANCE = 1.2;

/** Cumulative distance at each point: `[0, d1, d1 + d2, ...]`. */
export function cumulativeLengths(points: readonly Point[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const a = points[i - 1] as Point;
      const b = points[i] as Point;
      acc += Math.hypot(b.x - a.x, b.y - a.y);
    }
    out.push(acc);
  }
  return out;
}

/** Position `s` units along the polyline, clamped to its ends. */
export function samplePolyline(
  points: readonly Point[],
  cum: readonly number[],
  s: number,
): Sample {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0, angle: 0, index: 0 };
  if (n === 1) return { ...(points[0] as Point), angle: 0, index: 0 };
  const total = cum[n - 1] as number;
  const d = Math.min(Math.max(s, 0), total);
  // Find the segment with cum[i] <= d <= cum[i + 1] (binary search).
  let lo = 0;
  let hi = n - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((cum[mid] as number) <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo] as Point;
  const b = points[lo + 1] as Point;
  const len = (cum[lo + 1] as number) - (cum[lo] as number);
  const t = len > 0 ? (d - (cum[lo] as number)) / len : 0;
  const angle = len > 0 ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle, index: lo };
}

/** Decelerating curve, 0 to 1. Input is clamped. */
export function easeOutCubic(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - c, 3);
}

/** S-curve, 0 to 1. Input is clamped. */
export function easeInOutCubic(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Speed in cells per second: zero at `elapsed = 0`, easing up to `vmax` over
 * {@link RAMP_SECONDS}, and easing down (never to zero) in the last {@link BRAKE_DISTANCE}
 * cells so the drone settles onto the goal instead of snapping to it.
 */
export function speedAt(elapsedSec: number, remaining: number, vmax: number): number {
  const ramp = easeOutCubic(elapsedSec / RAMP_SECONDS);
  const brake =
    remaining < BRAKE_DISTANCE ? Math.max(0.18, easeOutCubic(remaining / BRAKE_DISTANCE)) : 1;
  return vmax * ramp * brake;
}

/** Options for {@link Trajectory}. */
export interface TrajectoryOptions {
  /** Cruise speed in cells per second. */
  vmax?: number;
  /** Start already past the ramp, for a re-plan while the drone is mid-flight. */
  warm?: boolean;
}

/** A drone travelling along a polyline with eased speed. */
export class Trajectory {
  readonly points: readonly Point[];
  readonly length: number;
  private readonly cum: number[];
  private readonly vmax: number;
  private dist = 0;
  private elapsed: number;

  constructor(points: readonly Point[], opts: TrajectoryOptions = {}) {
    this.points = points;
    this.cum = cumulativeLengths(points);
    this.length = this.cum.length > 0 ? (this.cum[this.cum.length - 1] as number) : 0;
    this.vmax = opts.vmax ?? CRUISE_SPEED;
    this.elapsed = opts.warm ? RAMP_SECONDS : 0;
  }

  /** Distance travelled so far, in cells. */
  get progress(): number {
    return this.dist;
  }

  /** True once the end of the path is reached. */
  get done(): boolean {
    return this.dist >= this.length;
  }

  /** Moves forward by `dtSec`. `speedFactor` scales speed (below 1 inside wind). Never overshoots. */
  advance(dtSec: number, speedFactor = 1): void {
    if (this.done) return;
    this.elapsed += dtSec;
    const v = speedAt(this.elapsed, this.length - this.dist, this.vmax) * speedFactor;
    this.dist = Math.min(this.length, this.dist + v * dtSec);
  }

  /** Current position and heading. */
  position(): Sample {
    return samplePolyline(this.points, this.cum, this.dist);
  }

  /** The current position followed by every point still ahead. */
  pointsAhead(): Point[] {
    const p = this.position();
    const out: Point[] = [{ x: p.x, y: p.y }];
    for (let i = p.index + 1; i < this.points.length; i++) out.push(this.points[i] as Point);
    return out;
  }
}

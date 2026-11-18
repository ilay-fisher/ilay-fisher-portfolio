/**
 * Spring physics shared by the whole site. One module owns the maths so CSS easings, GSAP
 * tweens, the cursor and the magnetic pull all feel like the same material: things have
 * mass, overshoot a little and settle. Pure TypeScript, no DOM.
 */

/** A spring: `stiffness` pulls toward the target, `damping` bleeds energy, mass is 1. */
export interface SpringConfig {
  stiffness: number;
  damping: number;
}

/** Position and velocity of one animated number. */
export interface SpringState {
  x: number;
  v: number;
}

/** The soft spring: entrances, light pools, anything large and slow. About 7% overshoot, 0.9 s. */
export const SPRING_SOFT: SpringConfig = { stiffness: 90, damping: 12 };
/** The snappy spring: presses, switches, the cursor ring, anything the pointer drives. About 6% overshoot, 0.35 s. */
export const SPRING_SNAPPY: SpringConfig = { stiffness: 520, damping: 30 };

const MAX_DT = 1 / 30;
const SUBSTEP = 1 / 120;

/** Damping ratio: below 1 the spring overshoots, at 1 it is critically damped. */
export function dampingRatio(cfg: SpringConfig): number {
  return cfg.damping / (2 * Math.sqrt(cfg.stiffness));
}

/**
 * Advances a spring by `dtSec` (clamped to 1/30 s so a restored tab cannot explode it) using
 * semi-implicit Euler in small sub-steps. Returns the same object when already at rest on the target.
 */
export function springStep(
  s: SpringState,
  target: number,
  dtSec: number,
  cfg: SpringConfig,
): SpringState {
  if (s.x === target && s.v === 0) return s;
  let dt = Math.min(Math.max(dtSec, 0), MAX_DT);
  let { x, v } = s;
  while (dt > 0) {
    const h = Math.min(dt, SUBSTEP);
    v += (-cfg.stiffness * (x - target) - cfg.damping * v) * h;
    x += v * h;
    dt -= h;
  }
  return { x, v };
}

/** True when the spring is close enough to its target, and slow enough, to stop simulating it. */
export function isAtRest(s: SpringState, target: number, epsilon = 0.01): boolean {
  return Math.abs(s.x - target) < epsilon && Math.abs(s.v) < epsilon;
}

/** Seconds until the oscillation envelope is under 0.5%, the duration a tween of this spring should use. */
export function settleTime(cfg: SpringConfig): number {
  const zeta = dampingRatio(cfg);
  const omega = Math.sqrt(cfg.stiffness);
  return Math.log(200) / (Math.min(zeta, 1) * omega);
}

/** Unit step response of the spring at `t` seconds (0 at t=0, 1 at rest, above 1 while overshooting). */
function stepResponse(cfg: SpringConfig, t: number): number {
  const omega = Math.sqrt(cfg.stiffness);
  const zeta = dampingRatio(cfg);
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const decay = Math.exp(-zeta * omega * t);
  return 1 - decay * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}

/**
 * Easing function for GSAP (progress in, progress out) that follows the spring's step response
 * stretched over `settleTime(cfg)`. Pair it with `duration: settleTime(cfg)`.
 */
export function springEase(cfg: SpringConfig): (p: number) => number {
  const total = settleTime(cfg);
  return (p) => {
    if (!Number.isFinite(p) || p <= 0) return 0;
    if (p >= 1) return 1;
    return stepResponse(cfg, p * total);
  };
}

/**
 * A CSS `linear()` easing sampled from the spring, so plain CSS transitions get real overshoot.
 * `points` samples are spaced evenly in time; the first is 0 and the last exactly 1. Used to
 * generate `--spring-soft` and `--spring-snappy` in tokens.css.
 */
export function springToLinear(cfg: SpringConfig, points = 32): string {
  const ease = springEase(cfg);
  const values = Array.from({ length: points }, (_, i) => {
    const v = ease(i / (points - 1));
    return Number(v.toFixed(3));
  });
  return `linear(${values.join(', ')})`;
}

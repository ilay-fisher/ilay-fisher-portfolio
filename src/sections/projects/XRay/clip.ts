/** Slider maths: value (0 to 100) to the clip, the handle position and the spoken value. */

/** Rounds to a whole percent in 0..100; NaN falls back to the resting 50. */
export function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.round(Math.min(100, Math.max(0, v)));
}

/** `clip-path` for the heatmap layer: only the left `v` percent is visible. */
export function sliderToClip(v: number): string {
  return `inset(0 ${+(100 - clamp(v)).toFixed(2)}% 0 0)`;
}

/** Clamp to 0..100 without rounding, so animated (fractional) positions stay smooth. */
function clamp(v: number): number {
  return Number.isNaN(v) ? 50 : Math.min(100, Math.max(0, v));
}

/** CSS `left` of the handle. */
export function handleLeft(v: number): string {
  return `${+clamp(v).toFixed(2)}%`;
}

/** `aria-valuetext` for the range input. */
export function sliderValueText(v: number): string {
  const p = clampPercent(v);
  if (p === 0) return 'Showing only the target';
  if (p === 100) return 'Showing only the heatmap';
  return `Heatmap on the left ${p} percent, target on the right`;
}

/**
 * Position of the one-off intro sweep at progress `t` (0 to 1): from the resting 50 out to 88,
 * across to 12, then back to 50. Exactly 50 at both ends.
 */
export function sweepValue(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  if (u === 0 || u === 1) return 50;
  return 50 + 38 * Math.sin(u * Math.PI * 2);
}

const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

/** Position (0..100) at path parameter `tau` (0..1): 50 -> 0 -> 100 -> 50. */
function pathAt(tau: number): number {
  const d = tau * 200;
  if (d <= 50) return 50 - d;
  if (d <= 150) return d - 50;
  return 250 - d;
}

const TABLE = 600;

/**
 * Choreographed intro sweep at progress `t` (0 to 1). The divider eases out from the resting 50 to
 * the left edge, travels to the right edge and eases back to 50. Time is spent unevenly: it slows
 * over each of `stops` (region centres, in percent) so the changed areas are lingered on. Exactly
 * 50 at both ends.
 */
export function sweepPath(t: number, stops: readonly number[]): number {
  if (t <= 0 || t >= 1) return 50;
  // Cumulative time density along the path: 1 everywhere, plus a bump around each stop.
  const cum = new Float64Array(TABLE + 1);
  for (let i = 1; i <= TABLE; i++) {
    const tau = (i - 0.5) / TABLE;
    const x = pathAt(tau);
    let rho = 1;
    for (const c of stops) rho += 2.4 * Math.exp(-(((x - c) / 7) ** 2));
    cum[i] = (cum[i - 1] ?? 0) + rho;
  }
  const total = cum[TABLE] ?? 1;
  const target = easeInOutSine(t) * total;
  let lo = 0;
  let hi = TABLE;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cum[mid] ?? 0) < target) lo = mid;
    else hi = mid;
  }
  const a = cum[lo] ?? 0;
  const b = cum[hi] ?? a + 1;
  const frac = b > a ? (target - a) / (b - a) : 0;
  return pathAt((lo + frac) / TABLE);
}

/** State of the slider's damped follow. */
export interface SpringState {
  x: number;
  v: number;
}

const OMEGA = 16;

/**
 * One step of a critically damped spring toward `target` (exact solution, so any `dt` is stable).
 * Gives the divider slight inertia and a damped settle without overshoot.
 */
export function springStep(s: SpringState, target: number, dt: number): SpringState {
  const d = s.x - target;
  const e = Math.exp(-OMEGA * dt);
  const c = s.v + OMEGA * d;
  return { x: target + (d + c * dt) * e, v: (s.v - OMEGA * c * dt) * e };
}

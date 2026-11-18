/**
 * Value of a count-up at `progress` (0 to 1), rounded to `decimals`. Pure so it can be tested
 * without a DOM or a timeline; the animation layer only feeds it eased progress.
 */
export function countUpValue(from: number, to: number, progress: number, decimals = 0): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  if (p >= 1) return to;
  const factor = 10 ** decimals;
  return Math.round((from + (to - from) * p) * factor) / factor;
}

/** Formats a reading with fixed decimals (so 20 becomes "20.0%") and an optional suffix. */
export function formatReading(value: number, decimals: number, suffix = ''): string {
  return `${value.toFixed(decimals)}${suffix}`;
}

/**
 * Eased progress that overshoots to about 110% and settles on exactly 1 (ease-out-back).
 * A reading driven by it passes its target a little and comes back, like a needle with mass.
 */
export function bouncyProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  if (progress >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (progress - 1) ** 3 + c1 * (progress - 1) ** 2;
}

/** Like {@link countUpValue} but the value may pass `to` on the way and settles on it exactly. */
export function countUpBounce(from: number, to: number, progress: number, decimals = 0): number {
  const p = bouncyProgress(progress);
  if (p === 1) return to;
  const factor = 10 ** decimals;
  return Math.round((from + (to - from) * p) * factor) / factor;
}

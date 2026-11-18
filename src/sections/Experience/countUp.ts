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

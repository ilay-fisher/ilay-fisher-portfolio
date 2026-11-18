/** Slider maths: value (0 to 100) to the clip, the handle position and the spoken value. */

/** Rounds to a whole percent in 0..100; NaN falls back to the resting 50. */
export function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.round(Math.min(100, Math.max(0, v)));
}

/** `clip-path` for the heatmap layer: only the left `v` percent is visible. */
export function sliderToClip(v: number): string {
  return `inset(0 ${100 - clampPercent(v)}% 0 0)`;
}

/** CSS `left` of the handle. */
export function handleLeft(v: number): string {
  return `${clampPercent(v)}%`;
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

/**
 * Offset for a magnetic hover: the pointer's distance from the element centre, scaled by
 * `strength` and clamped to `max` px per axis. Pure, so the feel is unit-testable.
 */
export function magnetOffset(
  dx: number,
  dy: number,
  strength: number,
  max: number,
): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  return { x: clamp(dx * strength), y: clamp(dy * strength) };
}

/**
 * Offset for a magnetic pull: the pointer's distance from the element centre, scaled by
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

/** Input for {@link magnetPull}: pointer offset from the element centre and the element's size. */
export interface MagnetInput {
  dx: number;
  dy: number;
  halfW: number;
  halfH: number;
  /** Extra reach in px beyond the element's edge where the pull still works. */
  range: number;
  strength: number;
  max: number;
}

/** Pull toward the pointer inside the element plus a `range` field around it; zero outside. */
export function magnetPull(i: MagnetInput): { x: number; y: number } {
  const outX = Math.max(0, Math.abs(i.dx) - i.halfW);
  const outY = Math.max(0, Math.abs(i.dy) - i.halfH);
  if (outX > i.range || outY > i.range) return { x: 0, y: 0 };
  return magnetOffset(i.dx, i.dy, i.strength, i.max);
}

/**
 * Which section the nav should mark current: the last one (in page order) that crosses the
 * observer band, or null while only the hero is in view.
 */
export function pickActive(
  order: readonly string[],
  intersecting: ReadonlySet<string>,
): string | null {
  let active: string | null = null;
  for (const id of order) if (intersecting.has(id)) active = id;
  return active;
}

/** Scroll progress 0 to 1 for the nav hairline. A page that does not scroll reports 0. */
export function scrollProgress(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const max = scrollHeight - viewportHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / max));
}

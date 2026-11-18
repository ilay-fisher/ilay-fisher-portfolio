/**
 * Picks a cell on the planned route to drop an obstacle on, so the visitor (or the idle demo)
 * is guaranteed to force a re-plan. Never the first cell, never the goal, and by default a few
 * cells ahead of the drone so the block lands where the drone has not yet been.
 *
 * @param route Cell indices from the plan start to the goal.
 * @param fromIdx Index of the cell the drone is heading to.
 * @param rng Uniform `[0, 1)` source (seeded in tests).
 * @param isFree Whether a cell index can take an obstacle.
 * @param minAhead How many cells ahead of `fromIdx` to leave clear.
 * @returns A cell index, or -1 when no suitable cell exists.
 */
export function pickObstacleOnRoute(
  route: ArrayLike<number>,
  fromIdx: number,
  rng: () => number,
  isFree: (cell: number) => boolean,
  minAhead = 3,
): number {
  const n = route.length;
  if (n < 3) return -1;
  const last = n - 2; // the goal is route[n - 1]
  const collect = (lo: number): number[] => {
    const out: number[] = [];
    for (let i = Math.max(1, lo); i <= last; i++) {
      const c = route[i] as number;
      if (isFree(c)) out.push(c);
    }
    return out;
  };
  let candidates = collect(fromIdx + minAhead);
  if (candidates.length === 0) candidates = collect(fromIdx + 1);
  if (candidates.length === 0) return -1;
  return candidates[
    Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
  ] as number;
}

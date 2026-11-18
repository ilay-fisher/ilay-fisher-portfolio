/**
 * Keeps an anchor scroll honest while the layout moves underneath it. The scroller computes a target y once; if
 * images, fonts or a lazy section change the page height before or during the animation, that y is stale. This
 * tracker watches the target element's real position every frame and re-issues the scroll, a bounded number of
 * times, until the page has been quiet for a moment. Pure and DOM-free: the caller supplies the reads and the move.
 */
export type TrackerStatus = 'active' | 'done' | 'cancelled';

export interface AnchorTrackerOptions {
  /** The target's current absolute scroll y (already minus any sticky offset), or null if it is not in the DOM yet. */
  read: () => number | null;
  /** The current scroll y. */
  current: () => number;
  /** True while the scroller is still animating. */
  scrolling: () => boolean;
  /** Start or restart a scroll to y. */
  go: (y: number, immediate: boolean) => void;
  /** Jump instead of animating (deep links, reduced motion). */
  immediate?: boolean;
  /** Retargets allowed after the first scroll. */
  maxRetries?: number;
  /** Quiet time (ms) with the target stable and the scroller at rest before we call it done. */
  settleMs?: number;
  /** Hard stop (ms) from start. */
  maxMs?: number;
  /** Position difference (px) that counts as moved. */
  tolerance?: number;
}

export interface AnchorTracker {
  start: (now: number) => void;
  step: (now: number) => TrackerStatus;
  cancel: () => void;
}

export function createAnchorTracker(o: AnchorTrackerOptions): AnchorTracker {
  const maxRetries = o.maxRetries ?? 6;
  const settleMs = o.settleMs ?? 500;
  const maxMs = o.maxMs ?? 4000;
  const tol = o.tolerance ?? 2;
  let startedAt = 0;
  let stableSince = 0;
  let retries = 0;
  let last: number | null = null;
  let issued = false;
  let state: TrackerStatus = 'active';

  const issue = (y: number, now: number) => {
    last = y;
    stableSince = now;
    o.go(y, o.immediate ?? false);
    issued = true;
  };

  return {
    start(now) {
      startedAt = now;
      stableSince = now;
      state = 'active';
      retries = 0;
      issued = false;
      last = null;
      const t = o.read();
      if (t !== null) issue(t, now);
    },
    cancel() {
      state = 'cancelled';
    },
    step(now) {
      if (state !== 'active') return state;
      if (now - startedAt > maxMs) return (state = 'done');
      const t = o.read();
      if (t === null) {
        stableSince = now;
        return 'active';
      }
      if (!issued) {
        // The target was not in the DOM at start; it is now, so make the first scroll (not counted as a retry).
        issue(t, now);
        return 'active';
      }
      const moved = Math.abs(t - (last ?? t)) > tol;
      const off = !o.scrolling() && Math.abs(t - o.current()) > tol;
      if (moved || off) {
        if (retries >= maxRetries) return (state = 'done');
        retries++;
        issue(t, now);
        return 'active';
      }
      if (o.scrolling()) stableSince = now;
      else if (now - stableSince >= settleMs) return (state = 'done');
      return 'active';
    },
  };
}

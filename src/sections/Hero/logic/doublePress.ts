/**
 * Detects the "open" gesture on a project piece: two quick presses at about the same spot with no drag
 * between them. It measures the pointer, not the piece, because the first tap nudges the piece and the
 * browser's own `dblclick` would then miss it. DOM-free.
 */
export class DoublePress {
  private last: { id: string; x: number; y: number; t: number } | null = null;

  constructor(
    private readonly windowMs = 400,
    private readonly slopPx = 12,
  ) {}

  /** Records a finished quick tap (no drag) on a piece that can be opened. */
  tap(id: string, x: number, y: number, t: number): void {
    this.last = { id, x, y, t };
  }

  /** If a press at (x, y, t) is the second of a pair, returns the piece id and consumes the pair. */
  second(x: number, y: number, t: number): string | null {
    const l = this.last;
    if (!l) return null;
    this.last = null;
    if (t - l.t > this.windowMs || t < l.t) return null;
    return Math.hypot(x - l.x, y - l.y) <= this.slopPx ? l.id : null;
  }

  /** Forgets the pending tap (a drag, a key press, a reset). */
  clear(): void {
    this.last = null;
  }
}

/** The longest press (down to up, ms) that still counts as a tap rather than a hold. */
export const QUICK_TAP_MS = 320;

/**
 * True when a press that began at `downT` and ended at `upT` was a quick tap. Both times must be the events' own time
 * stamps (`PointerEvent.timeStamp`), not the clock read inside the handlers: a heavy frame between the two events
 * delays the second handler, and the visitor's quick tap would then look like a long hold.
 */
export function isQuickTap(downT: number, upT: number): boolean {
  return upT - downT < QUICK_TAP_MS;
}

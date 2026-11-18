/** GL-free logic behind `GlStage`, kept separate so it is unit-testable without a GPU. */

/** Lifecycle of a stage's GL context. `disposed` is terminal. */
export type StageStatus = 'ok' | 'lost' | 'disposed';

/** Events that move a stage between statuses. */
export type StageEvent = 'lost' | 'restored' | 'dispose';

/** Everything that decides whether the render loop should be running. */
export interface RunState {
  status: StageStatus;
  /** Canvas intersects the viewport. */
  inView: boolean;
  /** `document.hidden` is false. */
  tabVisible: boolean;
  /** `start()` was called and `stop()` was not. */
  started: boolean;
}

/** The loop runs only while started, healthy, on screen and the tab is visible. */
export function shouldRun(s: RunState): boolean {
  return s.started && s.status === 'ok' && s.inView && s.tabVisible;
}

/** Pure status transition for context loss, restore and disposal. */
export function nextStatus(current: StageStatus, event: StageEvent): StageStatus {
  if (current === 'disposed') return 'disposed';
  if (event === 'dispose') return 'disposed';
  if (event === 'lost') return 'lost';
  return current === 'lost' ? 'ok' : current;
}

/** Backing-store size in device pixels for a CSS size; at least 1x1. */
export function canvasPixelSize(cssWidth: number, cssHeight: number, dpr: number) {
  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr)),
  };
}

/** WebGL feature detection and canvas sizing helpers. */

/** True when a WebGL context can actually be created (not just when the API exists). */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Device pixel ratio clamped to `[1, max]` so fill-rate stays bounded on dense screens. */
export function cappedDpr(max = 2): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(Math.max(dpr, 1), max);
}

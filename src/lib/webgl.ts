/** WebGL feature detection and canvas sizing helpers. */

/**
 * True when a WebGL2 context can actually be created (not just when the API exists).
 * WebGL2 only: the shaders are GLSL ES 3.00 and there is no WebGL1 path, so a WebGL1-only
 * browser gets the static fallback.
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/** Device pixel ratio clamped to `[1, max]` so fill-rate stays bounded on dense screens. */
export function cappedDpr(max = 2): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(Math.max(dpr, 1), max);
}

/**
 * Heat colour ramp derived from the design-system accent tokens at runtime, so the canvas follows
 * `--paint-deep`, `--paint` and `--paint-hi` instead of carrying its own colours.
 */
export type Rgb = [number, number, number];
/** A ramp stop: position 0 to 1 and the colour there. */
export type RampStop = [number, Rgb];

/** Parses a space or comma separated triplet such as `255 90 31`. Null when it is not three numbers. */
export function parseRgbTriplet(raw: string): Rgb | null {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Builds the ramp from the accent family: ink, ember, signal, amber, then a hot white core.
 * Takes a reader so tests can supply values; null means the tokens are not defined (no stylesheet).
 */
export function heatRamp(read: (name: string) => string): RampStop[] | null {
  const deep = parseRgbTriplet(read('--paint-deep-rgb'));
  const paint = parseRgbTriplet(read('--paint-rgb'));
  const hi = parseRgbTriplet(read('--paint-hi-rgb'));
  if (!deep || !paint || !hi) return null;
  const ink = mix([0, 0, 0], deep, 0.14);
  return [
    [0, ink],
    [0.3, deep],
    [0.6, paint],
    [0.82, hi],
    [1, mix(hi, [255, 255, 255], 0.8)],
  ];
}

/** Reads the ramp from the computed style of an element (usually the document root). */
export function readHeatRamp(el: Element): RampStop[] | null {
  const cs = getComputedStyle(el);
  return heatRamp((name) => cs.getPropertyValue(name));
}

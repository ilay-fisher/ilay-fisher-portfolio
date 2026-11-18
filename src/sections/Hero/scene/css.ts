import { Color, SRGBColorSpace } from 'three';

/**
 * Reads a CSS custom property from `:root` and returns it as a three.js colour. Works for any CSS
 * colour syntax (hex, rgb, oklch) by letting a 2D canvas resolve it, so palette changes in
 * `tokens.css` reach the 3D materials without code changes.
 */
export function cssColor(name: string, fallback: string): Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const c = new Color();
  if (!ctx) return c.set(fallback);
  for (const value of [raw, fallback]) {
    if (!value) continue;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 255) return c.setRGB(r! / 255, g! / 255, b! / 255, SRGBColorSpace);
  }
  return c.set(fallback);
}

/** The colours the scene takes from the design tokens. */
export interface Palette {
  stage: Color;
  paper: Color;
  accent: Color;
  accentHi: Color;
  accentDeep: Color;
}

/** Reads the palette from the live tokens, with the v2 values as fallbacks. */
export function readPalette(): Palette {
  return {
    stage: cssColor('--stage', '#0c1014'),
    paper: cssColor('--text', '#ece8df'),
    accent: cssColor('--paint', '#ff5a1f'),
    accentHi: cssColor('--paint-hi', '#ffb27a'),
    accentDeep: cssColor('--paint-deep', '#a3300c'),
  };
}

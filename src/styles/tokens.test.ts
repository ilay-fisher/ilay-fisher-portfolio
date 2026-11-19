import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** Reads `--name: value;` from the :root block of tokens.css. */
function token(name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${name} missing`);
  return m[1]!.trim();
}

const rgbOf = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** WCAG relative luminance. */
function lum(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours. */
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

describe('accent family: alive signal cyan', () => {
  it('uses the chosen cyan family under the same token names', () => {
    expect(token('--paint')).toBe('#1ed0f2');
    expect(token('--paint-hi')).toBe('#8cf1ff');
    expect(token('--paint-deep')).toBe('#0a6a87');
    expect(token('--on-paint')).toBe('#0c1014');
  });

  it('keeps the rgb triplets in step with the hex values', () => {
    for (const n of ['--paint', '--paint-hi', '--paint-deep']) {
      expect(token(`${n}-rgb`)).toBe(rgbOf(token(n)).join(' '));
    }
  });

  it('is blue-green: hue between 170 and 215 for the whole family', () => {
    for (const n of ['--paint', '--paint-hi', '--paint-deep']) {
      const h = hue(token(n));
      expect(h).toBeGreaterThanOrEqual(170);
      expect(h).toBeLessThanOrEqual(215);
    }
  });

  it('passes AA: paint as text on stage and surface, on-paint text on paint and paint-hi', () => {
    expect(contrast(token('--paint'), token('--stage'))).toBeGreaterThanOrEqual(7);
    expect(contrast(token('--paint'), token('--surface'))).toBeGreaterThanOrEqual(7);
    expect(contrast(token('--on-paint'), token('--paint'))).toBeGreaterThanOrEqual(7);
    expect(contrast(token('--on-paint'), token('--paint-hi'))).toBeGreaterThanOrEqual(7);
  });

  it('keeps the status green clearly apart from the accent', () => {
    const pass = token('--pass');
    expect(Math.abs(hue(pass) - hue(token('--paint')))).toBeGreaterThanOrEqual(60);
    expect(contrast(pass, token('--stage'))).toBeGreaterThanOrEqual(4.5);
  });

  it('no longer describes itself as orange', () => {
    expect(css).not.toMatch(/orange|amber specular|ember shade/i);
  });
});

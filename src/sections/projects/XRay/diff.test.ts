import { describe, expect, it } from 'vitest';
import {
  absDiff,
  boxBlur,
  buildLut,
  buildMask,
  closeMask,
  detectRegions,
  diffRgba,
  grayscale,
  heatToRgba,
  labelComponents,
  localMeanMask,
  mergeBoxes,
  percentile,
  threshold,
} from './diff';

/** Builds a w x h RGBA image filled with one colour. */
function solid(w: number, h: number, rgb: [number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  return d;
}
/** Paints a filled rect into an RGBA image. */
function paint(
  d: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  rgb: [number, number, number],
) {
  for (let y = y0; y < y0 + rh; y++)
    for (let x = x0; x < x0 + rw; x++) d.set([rgb[0], rgb[1], rgb[2], 255], (y * w + x) * 4);
}
function maskOf(rows: string[]): { m: Uint8Array; w: number; h: number } {
  const h = rows.length;
  const w = rows[0]!.length;
  const m = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (m[y * w + x] = c === '#' ? 1 : 0)));
  return { m, w, h };
}

describe('grayscale / absDiff / diffRgba', () => {
  it('converts with luma weights', () => {
    const g = grayscale(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), 2, 1);
    expect(g[0]).toBeCloseTo(76.2, 0);
    expect(g[1]).toBeCloseTo(149.7, 0);
  });
  it('absDiff is symmetric and zero for equal inputs', () => {
    const a = Float32Array.from([0, 10, 200]);
    const b = Float32Array.from([5, 10, 100]);
    expect([...absDiff(a, b)]).toEqual([5, 0, 100]);
    expect([...absDiff(b, a)]).toEqual([5, 0, 100]);
  });
  it('diffRgba takes the max of luma and channel differences', () => {
    const a = solid(2, 1, [100, 100, 100]);
    const b = solid(2, 1, [100, 100, 100]);
    b.set([100, 100, 160, 255], 4); // blue-only change: luma diff small, channel diff 60
    const d = diffRgba(a, b, 2, 1);
    expect(d[0]).toBe(0);
    expect(d[1]).toBeCloseTo(60, 3);
  });
});

describe('boxBlur', () => {
  it('keeps a constant image constant', () => {
    const out = boxBlur(new Float32Array(25).fill(7), 5, 5, 1);
    out.forEach((v) => expect(v).toBeCloseTo(7, 4));
  });
  it('spreads a single hot pixel and conserves it as a mean over the window', () => {
    const src = new Float32Array(25);
    src[12] = 90;
    const out = boxBlur(src, 5, 5, 1);
    expect(out[12]).toBeCloseTo(10, 4); // 90 / 9
    expect(out[6]).toBeCloseTo(10, 4);
    expect(out[0]).toBe(0);
  });
  it('radius 0 is the identity', () => {
    const src = Float32Array.from([1, 2, 3, 4]);
    expect([...boxBlur(src, 2, 2, 0)]).toEqual([1, 2, 3, 4]);
  });
});

describe('threshold and local mask', () => {
  it('threshold is strictly greater-than', () => {
    expect([...threshold(Float32Array.from([9, 10, 11]), 10)]).toEqual([0, 0, 1]);
  });
  it('localMeanMask keeps a bump above its neighbourhood and drops a flat field', () => {
    const flat = new Float32Array(81).fill(30);
    expect(localMeanMask(flat, 9, 9, 4, 2).every((v) => v === 0)).toBe(true);
    const bump = new Float32Array(81).fill(10);
    bump[40] = 80;
    expect(localMeanMask(bump, 9, 9, 4, 2)[40]).toBe(1);
  });
});

describe('closeMask', () => {
  it('fills a one pixel gap and leaves isolated far pixels alone', () => {
    const { m, w, h } = maskOf(['#.#....', '.......', '.......', '......#']);
    const out = closeMask(m, w, h, 1);
    expect(out[1]).toBe(1);
    expect(out[3 * w + 6]).toBe(1);
    expect(out[3 * w + 3]).toBe(0);
  });
});

describe('labelComponents', () => {
  it('finds boxes and areas of separate blobs (8-connected)', () => {
    const { m, w, h } = maskOf(['##....', '##..#.', '....#.', '.#....', '..#...']);
    const comps = labelComponents(m, w, h);
    expect(comps).toHaveLength(3);
    const first = comps.find((c) => c.x === 0 && c.y === 0)!;
    expect(first).toEqual({ x: 0, y: 0, w: 2, h: 2, area: 4 });
    const diag = comps.find((c) => c.x === 1 && c.y === 3)!;
    expect(diag).toMatchObject({ w: 2, h: 2, area: 2 }); // diagonal neighbours join
  });
  it('returns nothing for an empty mask', () => {
    expect(labelComponents(new Uint8Array(16), 4, 4)).toEqual([]);
  });
});

describe('mergeBoxes', () => {
  it('merges overlapping boxes transitively', () => {
    const out = mergeBoxes(
      [
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 8, y: 8, w: 10, h: 10 },
        { x: 16, y: 16, w: 10, h: 10 },
        { x: 100, y: 100, w: 5, h: 5 },
      ],
      0,
    );
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ x: 0, y: 0, w: 26, h: 26 });
  });
  it('merges boxes within the gap but not beyond it', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 14, y: 0, w: 10, h: 10 };
    expect(mergeBoxes([a, b], 3)).toHaveLength(2);
    expect(mergeBoxes([a, b], 4)).toHaveLength(1);
  });
});

describe('buildMask and detectRegions on synthetic images', () => {
  const w = 120;
  const h = 80;
  const base = solid(w, h, [30, 120, 60]);
  const target = solid(w, h, [30, 120, 60]);
  paint(target, w, 20, 20, 24, 16, [220, 200, 60]); // large change
  paint(target, w, 90, 50, 8, 6, [250, 250, 250]); // small change
  // 1-2 level grain everywhere must not register
  for (let i = 0; i < w * h; i++) target[i * 4 + 1] = (target[i * 4 + 1] ?? 0) + (i % 3);

  it('finds exactly the two changed regions, largest first, tight around the change', () => {
    const regions = detectRegions(base, target, w, h);
    expect(regions).toHaveLength(2);
    const [big, small] = regions;
    expect(big!.w * big!.h).toBeGreaterThan(small!.w * small!.h);
    expect(big!.x).toBeLessThanOrEqual(20);
    expect(big!.x + big!.w).toBeGreaterThanOrEqual(44);
    expect(big!.y).toBeLessThanOrEqual(20);
    expect(small!.x).toBeLessThanOrEqual(90);
    expect(small!.x + small!.w).toBeGreaterThanOrEqual(98);
  });
  it('returns no regions for identical images or grain only', () => {
    expect(detectRegions(base, base, w, h)).toEqual([]);
    const noisy = solid(w, h, [30, 120, 60]);
    for (let i = 0; i < w * h; i++) noisy[i * 4] = 30 + (i % 4);
    expect(detectRegions(base, noisy, w, h)).toEqual([]);
  });
  it('drops specks below the minimum area', () => {
    const t2 = solid(w, h, [30, 120, 60]);
    paint(t2, w, 60, 40, 2, 2, [255, 255, 255]);
    expect(detectRegions(base, t2, w, h, { minArea: 40 })).toEqual([]);
  });
  it('a higher sensitivity never finds fewer pixels in the mask', () => {
    const d = boxBlur(diffRgba(base, target, w, h), w, h, 1);
    const count = (s: number) => buildMask(d, w, h, { sensitivity: s }).reduce((a, v) => a + v, 0);
    expect(count(1)).toBeGreaterThanOrEqual(count(0));
  });
});

describe('colormap', () => {
  it('has transparent near-black at 0 and opaque yellow-ish at 255', () => {
    const lut = buildLut();
    expect(lut).toHaveLength(256 * 4);
    expect(lut[3]).toBe(0);
    const hi = [lut[255 * 4]!, lut[255 * 4 + 1]!, lut[255 * 4 + 2]!, lut[255 * 4 + 3]!];
    expect(hi[3]).toBe(255);
    expect(hi[0]).toBeGreaterThan(220);
    expect(hi[1]).toBeGreaterThan(200);
  });
  it('luminance rises monotonically along the ramp', () => {
    const lut = buildLut();
    let prev = -1;
    for (let i = 0; i < 256; i++) {
      const lum = 0.2126 * lut[i * 4]! + 0.7152 * lut[i * 4 + 1]! + 0.0722 * lut[i * 4 + 2]!;
      expect(lum).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = lum;
    }
  });
  it('alpha is non-decreasing', () => {
    const lut = buildLut();
    for (let i = 1; i < 256; i++) expect(lut[i * 4 + 3]!).toBeGreaterThanOrEqual(lut[(i - 1) * 4 + 3]!);
  });
  it('heatToRgba maps zero to transparent and the scale value to opaque', () => {
    const out = heatToRgba(Float32Array.from([0, 50, 100]), 3, 1, 50);
    expect(out[3]).toBe(0);
    expect(out[7]).toBe(255);
    expect(out[11]).toBe(255);
  });
});

describe('percentile', () => {
  it('returns the requested rank', () => {
    const a = Float32Array.from({ length: 101 }, (_, i) => i);
    expect(percentile(a, 0.5)).toBe(50);
    expect(percentile(a, 1)).toBe(100);
    expect(percentile(new Float32Array(0), 0.5)).toBe(0);
  });
});

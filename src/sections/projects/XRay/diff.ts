/**
 * Client-side visual diff: the first stage of the X-Ray Lens funnel, in pure TypeScript on typed
 * arrays (no DOM, so it is unit-testable).
 *
 * Ported in spirit from the owner's own OpenCV pipeline (`backend/app/cv_pipeline.py` in
 * github.com/ilay-fisher/multimodal-visual-qa-xray-lens): blur, absolute difference taken as the
 * max over luma and colour channels, an intensity floor combined with a local-mean threshold,
 * morphological close, connected components to boxes, padding, merging of overlaps and a
 * minimum-area filter. The constants (floor 40 to 6, local offset 8 to 2) are the owner's.
 */

import type { RampStop } from './palette';

/** Axis-aligned box in pixels, top-left origin. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A connected component: its bounding box and its pixel count. */
export interface Component extends Box {
  area: number;
}

/** Luma (Rec. 601, the weights OpenCV uses) of every pixel of an RGBA buffer. */
export function grayscale(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  return out;
}

/** Element-wise absolute difference of two equally long arrays. */
export function absDiff(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.abs(a[i]! - b[i]!);
  return out;
}

/**
 * Per-pixel difference of two RGBA buffers: the larger of the luma difference and the biggest
 * single-channel difference, so a hue change at equal brightness still counts.
 */
export function diffRgba(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  w: number,
  h: number,
): Float32Array {
  const luma = absDiff(grayscale(a, w, h), grayscale(b, w, h));
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const ch = Math.max(
      Math.abs(a[o]! - b[o]!),
      Math.abs(a[o + 1]! - b[o + 1]!),
      Math.abs(a[o + 2]! - b[o + 2]!),
    );
    if (ch > luma[i]!) luma[i] = ch;
  }
  return luma;
}

/** Mean over a (2r+1) square window, clamped at the borders, as two separable running sums. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return Float32Array.from(src);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x]!;
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      tmp[row + x] = sum / (hi - lo + 1);
      if (x + r + 1 < w) sum += src[row + x + r + 1]!;
      if (x - r >= 0) sum -= src[row + x - r]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += tmp[y * w + x]!;
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      out[y * w + x] = sum / (hi - lo + 1);
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x]!;
      if (y - r >= 0) sum -= tmp[(y - r) * w + x]!;
    }
  }
  return out;
}

/** Blurs the colour channels of an RGBA buffer; the result is a float RGBA buffer. */
export function blurRgba(rgba: ArrayLike<number>, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(w * h * 4);
  const plane = new Float32Array(w * h);
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < w * h; i++) plane[i] = rgba[i * 4 + c]!;
    const blurred = c === 3 ? plane : boxBlur(plane, w, h, r);
    for (let i = 0; i < w * h; i++) out[i * 4 + c] = blurred[i]!;
  }
  return out;
}

/** 1 where `src` is strictly greater than `t`. */
export function threshold(src: ArrayLike<number>, t: number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i]! > t ? 1 : 0;
  return out;
}

/** 1 where a pixel exceeds the mean of its (2r+1) window by more than `c` (adaptive threshold). */
export function localMeanMask(
  src: Float32Array,
  w: number,
  h: number,
  r: number,
  c: number,
): Uint8Array {
  const mean = boxBlur(src, w, h, r);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = src[i]! > mean[i]! + c ? 1 : 0;
  return out;
}

function morph(m: Uint8Array, w: number, h: number, r: number, grow: boolean): Uint8Array {
  const pass = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hit = grow ? 0 : 1;
        for (let k = -r; k <= r; k++) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; // out of bounds: ignored
          const v = src[yy * w + xx]!;
          if (grow ? v === 1 : v === 0) {
            hit = grow ? 1 : 0;
            break;
          }
        }
        out[y * w + x] = hit;
      }
    }
    return out;
  };
  return pass(pass(m, true), false);
}

/** Morphological close with a square element of radius `r`: dilate, then erode. */
export function closeMask(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return morph(morph(m, w, h, r, true), w, h, r, false);
}

/** Options for {@link buildMask}. */
export interface MaskOptions {
  /** 0 is strict, 1 is permissive. Default 0.5 like the owner's pipeline. */
  sensitivity?: number;
  /** Radius of the local-mean window in pixels. Default 25 (a 101 px block at 960 px, halved). */
  blockRadius?: number;
  /** Radius of the closing element. Default 1. */
  closeRadius?: number;
}

/**
 * Binary change mask from a blurred difference image: an intensity floor AND (a local-mean test
 * OR a much higher floor, so flat interiors of big changes stay connected), then a close.
 */
export function buildMask(
  diff: Float32Array,
  w: number,
  h: number,
  opts: MaskOptions = {},
): Uint8Array {
  const s = Math.min(1, Math.max(0, opts.sensitivity ?? 0.5));
  const floor = 40 + (6 - 40) * s;
  const c = Math.round(8 + (2 - 8) * s);
  const strong = threshold(diff, floor - 1);
  const local = localMeanMask(diff, w, h, opts.blockRadius ?? 25, c);
  const veryStrong = threshold(diff, floor * 2);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++)
    mask[i] = strong[i]! && (local[i]! || veryStrong[i]!) ? 1 : 0;
  return closeMask(mask, w, h, opts.closeRadius ?? 1);
}

/** Bounding boxes and areas of the 8-connected components of a mask, in scan order. */
export function labelComponents(m: Uint8Array, w: number, h: number): Component[] {
  const seen = new Uint8Array(w * h);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || seen[start]) continue;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let area = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % w;
      const py = (p - px) / w;
      area++;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (m[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area });
  }
  return out;
}

const touches = (a: Box, b: Box, gap: number): boolean => {
  const dx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  const dy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  return dx <= gap && dy <= gap;
};
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Merges boxes that overlap or are at most `gap` pixels apart, repeating until stable. */
export function mergeBoxes(boxes: Box[], gap = 0): Box[] {
  let pending = boxes.map((b) => ({ ...b }));
  for (;;) {
    const merged: Box[] = [];
    for (const box of pending) {
      const i = merged.findIndex((o) => touches(box, o, gap));
      if (i < 0) merged.push(box);
      else merged[i] = union(box, merged[i]!);
    }
    if (merged.length === pending.length) return merged;
    pending = merged;
  }
}

/** Options for {@link analyzeDiff} and {@link detectRegions}. */
export interface DetectOptions extends MaskOptions {
  /** Boxes with a smaller tight area (pixels) are noise. Default 37 (150 px at 960, scaled). */
  minArea?: number;
  /** Blur radius applied to both images before differencing. Default 1. */
  blurRadius?: number;
  /** Padding added around each tight box. Default 3. */
  padding?: number;
}

/** Everything the diff stage produces for one image pair. */
export interface DiffResult {
  /** Blurred difference, 0 to 255 per pixel. Drives the heatmap. */
  diff: Float32Array;
  mask: Uint8Array;
  /** Padded, merged boxes, largest first. */
  regions: Box[];
}

/** Runs the whole stage on two RGBA buffers of the same size. */
export function analyzeDiff(
  baseline: ArrayLike<number>,
  target: ArrayLike<number>,
  w: number,
  h: number,
  opts: DetectOptions = {},
): DiffResult {
  const r = opts.blurRadius ?? 1;
  const diff = diffRgba(blurRgba(baseline, w, h, r), blurRgba(target, w, h, r), w, h);
  const mask = buildMask(diff, w, h, opts);
  const minArea = opts.minArea ?? 37;
  const pad = opts.padding ?? 3;
  const padded = labelComponents(mask, w, h)
    .filter((c) => c.w * c.h >= minArea)
    .map((c) => {
      const x0 = Math.max(0, c.x - pad);
      const y0 = Math.max(0, c.y - pad);
      const x1 = Math.min(w, c.x + c.w + pad);
      const y1 = Math.min(h, c.y + c.h + pad);
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
  const regions = mergeBoxes(padded, 0).sort((a, b) => b.w * b.h - a.w * a.h);
  return { diff, mask, regions };
}

/** Convenience wrapper around {@link analyzeDiff} that returns only the boxes. */
export function detectRegions(
  baseline: ArrayLike<number>,
  target: ArrayLike<number>,
  w: number,
  h: number,
  opts: DetectOptions = {},
): Box[] {
  return analyzeDiff(baseline, target, w, h, opts).regions;
}

/** The p-quantile (0 to 1) of an array, by rank. 0 for an empty array. */
export function percentile(a: ArrayLike<number>, p: number): number {
  if (a.length === 0) return 0;
  const sorted = Float32Array.from(a).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))]!;
}

/** Neutral fallback ramp (black to white) for when the accent tokens are unavailable, such as in jsdom. */
const GREY_RAMP: RampStop[] = [
  [0, [0, 0, 0]],
  [1, [255, 255, 255]],
];
const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * 256-entry RGBA colour table along `ramp` (derived from the accent tokens, see palette.ts). Alpha
 * stays at zero for near-zero difference so unchanged areas show the base untouched.
 */
export function buildLut(ramp: RampStop[] | null = null): Uint8ClampedArray {
  const stops = ramp ?? GREY_RAMP;
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let k = 0;
    while (k < stops.length - 2 && v > stops[k + 1]![0]) k++;
    const [t0, [r0, g0, b0]] = stops[k]!;
    const [t1, [r1, g1, b1]] = stops[k + 1]!;
    const f = (v - t0) / (t1 - t0);
    lut[i * 4] = r0 + (r1 - r0) * f;
    lut[i * 4 + 1] = g0 + (g1 - g0) * f;
    lut[i * 4 + 2] = b0 + (b1 - b0) * f;
    lut[i * 4 + 3] = Math.round(255 * smoothstep(0.06, 0.4, v));
  }
  return lut;
}

/** Turns a difference image into RGBA heat. `scale` is the value that maps to full heat. */
export function heatToRgba(
  heat: Float32Array,
  w: number,
  h: number,
  scale: number,
  gamma = 0.7,
  lut: Uint8ClampedArray = buildLut(),
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.pow(Math.min(1, Math.max(0, heat[i]! / scale)), gamma);
    const idx = Math.round(v * 255) * 4;
    out[i * 4] = lut[idx]!;
    out[i * 4 + 1] = lut[idx + 1]!;
    out[i * 4 + 2] = lut[idx + 2]!;
    out[i * 4 + 3] = lut[idx + 3]!;
  }
  return out;
}

/** Value that maps to full heat: a high percentile (one hot pixel must not flatten the rest), floored so noise stays dim. */
export function heatScale(diff: Float32Array): number {
  return Math.min(255, Math.max(percentile(diff, 0.999), 30));
}

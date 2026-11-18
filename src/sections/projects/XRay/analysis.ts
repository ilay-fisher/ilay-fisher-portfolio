/**
 * Runs the diff stage on a preset in the browser: load both images, downscale to a working size
 * with canvas, read pixels, difference, blur, threshold, boxes, heat colour map.
 */
import { createLogger } from '../../../lib/logger';
import { analyzeDiff, heatScale, heatToRgba, type Box } from './diff';
import type { Preset } from './data';

const log = createLogger('xray');

/** Width of the working canvas. Height keeps the aspect ratio. */
export const WORK_WIDTH = 480;

/** Result of analysing one preset. */
export interface Analysis {
  /** `computed` here, or `fallback` when pixel access failed and precomputed assets are used. */
  source: 'computed' | 'fallback';
  /** RGBA heat at the working size. Absent for the fallback, which uses an image. */
  heat: { width: number; height: number; rgba: Uint8ClampedArray };
  /** Boxes in natural image pixels, largest first. */
  regions: Box[];
  /** Time the diff took here, in ms. Null when it was not measured (fallback). */
  ms: number | null;
}

/** Signature of the analysis function; injectable so tests and the fallback path can replace it. */
export type AnalyzeFn = (preset: Preset) => Promise<Analysis>;

async function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

function pixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data; // throws SecurityError if the canvas is tainted
}

/** Default {@link AnalyzeFn}: the real client-side diff. Throws when pixel access fails. */
export const analyzePreset: AnalyzeFn = async (preset) => {
  const [base, target] = await Promise.all([load(preset.baseline), load(preset.target)]);
  const w = WORK_WIDTH;
  const h = Math.round((WORK_WIDTH * preset.height) / preset.width);
  const t0 = performance.now();
  const a = pixels(base, w, h);
  const b = pixels(target, w, h);
  const { diff, regions } = analyzeDiff(a, b, w, h);
  const rgba = heatToRgba(diff, w, h, heatScale(diff));
  const ms = performance.now() - t0;
  const k = preset.width / w;
  const scaled = regions.map((r) => ({
    x: Math.round(r.x * k),
    y: Math.round(r.y * k),
    w: Math.round(r.w * k),
    h: Math.round(r.h * k),
  }));
  log.info('diff computed', {
    preset: preset.id,
    ms: Math.round(ms * 10) / 10,
    regions: scaled.length,
  });
  return { source: 'computed', heat: { width: w, height: h, rgba }, regions: scaled, ms };
};

/** Precomputed result used when pixel access fails: stored boxes, stored heat image, no timing. */
export function fallbackAnalysis(preset: Preset): Analysis {
  return {
    source: 'fallback',
    heat: { width: 0, height: 0, rgba: new Uint8ClampedArray(0) },
    regions: preset.fallbackRegions,
    ms: null,
  };
}

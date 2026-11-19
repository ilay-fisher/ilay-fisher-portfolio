import { describe, expect, it } from 'vitest';
import { buildLut } from './diff';
import { heatRamp, parseRgbTriplet } from './palette';

const tokens: Record<string, string> = {
  '--paint-deep-rgb': ' 10 106 135',
  '--paint-rgb': '30 208 242',
  '--paint-hi-rgb': '140 241 255',
};

describe('heat ramp from tokens', () => {
  it('parses space and comma triplets and rejects junk', () => {
    expect(parseRgbTriplet('30 208 242')).toEqual([30, 208, 242]);
    expect(parseRgbTriplet('1, 2, 3')).toEqual([1, 2, 3]);
    expect(parseRgbTriplet('')).toBeNull();
    expect(parseRgbTriplet('1 2')).toBeNull();
    expect(parseRgbTriplet('a b c')).toBeNull();
  });
  it('returns null when a token is missing', () => {
    expect(heatRamp(() => '')).toBeNull();
  });
  it('runs ink, deep, signal, pale, hot core from the accent tokens', () => {
    const ramp = heatRamp((n) => tokens[n] ?? '')!;
    expect(ramp.map((s) => s[0])).toEqual([0, 0.3, 0.6, 0.82, 1]);
    expect(ramp[1]![1]).toEqual([10, 106, 135]);
    expect(ramp[2]![1]).toEqual([30, 208, 242]);
    expect(ramp[3]![1]).toEqual([140, 241, 255]);
    expect(ramp[4]![1][2]).toBeGreaterThan(200);
  });
  it('a token ramp gives a cyan LUT: blue leads red at mid heat, and it brightens', () => {
    const lut = buildLut(heatRamp((n) => tokens[n] ?? ''));
    const mid = 160 * 4;
    expect(lut[mid + 2]!).toBeGreaterThan(lut[mid]! + 100);
    const lum = (i: number) =>
      0.2126 * lut[i * 4]! + 0.7152 * lut[i * 4 + 1]! + 0.0722 * lut[i * 4 + 2]!;
    expect(lum(255)).toBeGreaterThan(lum(160));
    expect(lum(160)).toBeGreaterThan(lum(60));
  });
});

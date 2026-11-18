import { describe, expect, it } from 'vitest';
import { buildLut } from './diff';
import { heatRamp, parseRgbTriplet } from './palette';

const tokens: Record<string, string> = {
  '--paint-deep-rgb': ' 168 48 15',
  '--paint-rgb': '255 90 31',
  '--paint-hi-rgb': '255 179 71',
};

describe('heat ramp from tokens', () => {
  it('parses space and comma triplets and rejects junk', () => {
    expect(parseRgbTriplet('255 90 31')).toEqual([255, 90, 31]);
    expect(parseRgbTriplet('1, 2, 3')).toEqual([1, 2, 3]);
    expect(parseRgbTriplet('')).toBeNull();
    expect(parseRgbTriplet('1 2')).toBeNull();
    expect(parseRgbTriplet('a b c')).toBeNull();
  });
  it('returns null when a token is missing', () => {
    expect(heatRamp(() => '')).toBeNull();
  });
  it('runs ink, ember, signal, amber, hot core from the accent tokens', () => {
    const ramp = heatRamp((n) => tokens[n] ?? '')!;
    expect(ramp.map((s) => s[0])).toEqual([0, 0.3, 0.6, 0.82, 1]);
    expect(ramp[1]![1]).toEqual([168, 48, 15]);
    expect(ramp[2]![1]).toEqual([255, 90, 31]);
    expect(ramp[3]![1]).toEqual([255, 179, 71]);
    expect(ramp[4]![1][2]).toBeGreaterThan(200);
  });
  it('a token ramp gives an orange-red LUT: red leads blue at mid heat, and it brightens', () => {
    const lut = buildLut(heatRamp((n) => tokens[n] ?? ''));
    const mid = 160 * 4;
    expect(lut[mid]!).toBeGreaterThan(lut[mid + 2]! + 100);
    const lum = (i: number) =>
      0.2126 * lut[i * 4]! + 0.7152 * lut[i * 4 + 1]! + 0.0722 * lut[i * 4 + 2]!;
    expect(lum(255)).toBeGreaterThan(lum(160));
    expect(lum(160)).toBeGreaterThan(lum(60));
  });
});

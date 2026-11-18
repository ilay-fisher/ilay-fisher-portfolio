import { describe, expect, it } from 'vitest';
import { bouncyProgress, countUpBounce, countUpValue, formatReading } from './countUp';

describe('countUpValue', () => {
  it('starts at from and ends exactly at to', () => {
    expect(countUpValue(36.6, 14.2, 0, 1)).toBe(36.6);
    expect(countUpValue(36.6, 14.2, 1, 1)).toBe(14.2);
  });
  it('interpolates linearly and rounds to the requested decimals', () => {
    expect(countUpValue(0, 22, 0.5, 0)).toBe(11);
    expect(countUpValue(36.6, 14.2, 0.5, 1)).toBe(25.4);
  });
  it('clamps progress outside 0..1 and tolerates NaN', () => {
    expect(countUpValue(0, 10, -1, 0)).toBe(0);
    expect(countUpValue(0, 10, 4, 0)).toBe(10);
    expect(countUpValue(0, 10, Number.NaN, 0)).toBe(0);
  });
});

describe('formatReading', () => {
  it('keeps trailing zeros for fixed decimals and appends the suffix', () => {
    expect(formatReading(14.2, 1, '%')).toBe('14.2%');
    expect(formatReading(20, 1, '%')).toBe('20.0%');
    expect(formatReading(22, 0, '+')).toBe('22+');
  });
});

describe('bouncyProgress and countUpBounce', () => {
  it('starts at 0, ends at exactly 1 and overshoots in between', () => {
    expect(bouncyProgress(0)).toBe(0);
    expect(bouncyProgress(1)).toBe(1);
    const peak = Math.max(...Array.from({ length: 100 }, (_, i) => bouncyProgress(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
  });
  it('tolerates NaN and out-of-range input', () => {
    expect(bouncyProgress(Number.NaN)).toBe(0);
    expect(bouncyProgress(3)).toBe(1);
    expect(bouncyProgress(-1)).toBe(0);
  });
  it('lands exactly on the target value and may pass it on the way', () => {
    expect(countUpBounce(0, 22, 1, 0)).toBe(22);
    expect(countUpBounce(0, 22, 0, 0)).toBe(0);
    const values = Array.from({ length: 100 }, (_, i) => countUpBounce(0, 100, i / 100, 1));
    expect(Math.max(...values)).toBeGreaterThan(100);
  });
});

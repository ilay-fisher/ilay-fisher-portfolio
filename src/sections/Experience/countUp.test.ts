import { describe, expect, it } from 'vitest';
import { countUpValue, formatReading } from './countUp';

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

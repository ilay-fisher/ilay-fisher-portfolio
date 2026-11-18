import { describe, expect, it } from 'vitest';
import { formatMs, formatPct, formatTokens, savedPct } from './readout';

describe('readout formatters', () => {
  it('formats milliseconds with sensible precision', () => {
    expect(formatMs(0.4)).toBe('<1 ms');
    expect(formatMs(9.84)).toBe('9.8 ms');
    expect(formatMs(43.7)).toBe('44 ms');
    expect(formatMs(1234)).toBe('1,234 ms');
  });
  it('formats percentages and tokens', () => {
    expect(formatPct(43.7)).toBe('43.7%');
    expect(formatPct(95)).toBe('95%');
    expect(formatTokens(2460)).toBe('2,460');
  });
  it('computes the saved share', () => {
    expect(savedPct(2460, 121)).toBeCloseTo(95.08, 1);
    expect(savedPct(0, 0)).toBe(0);
  });
});

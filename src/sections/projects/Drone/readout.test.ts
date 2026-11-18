import { describe, expect, it } from 'vitest';
import { describeOutcome, formatCost, formatCount, formatMs } from './readout';

describe('formatters', () => {
  it('formats milliseconds with sensible precision', () => {
    expect(formatMs(0.4)).toBe('0.40 ms');
    expect(formatMs(0.004)).toBe('<0.01 ms');
    expect(formatMs(0)).toBe('<0.01 ms');
    expect(formatMs(12.345)).toBe('12.3 ms');
    expect(formatMs(123.4)).toBe('123 ms');
    expect(formatMs(Number.NaN)).toBe('n/a');
  });
  it('formats path cost and flags no path', () => {
    expect(formatCost(41.2132)).toBe('41.2');
    expect(formatCost(0)).toBe('0.0');
    expect(formatCost(-1)).toBe('no path');
  });
  it('formats counts with a thousands separator', () => {
    expect(formatCount(212)).toBe('212');
    expect(formatCount(1234)).toBe('1,234');
  });
});

describe('describeOutcome', () => {
  const ok = { found: true, ms: 0.4, expanded: 212, cost: 41.2 };
  it('words a blocked route in the form the live region announces', () => {
    expect(describeOutcome('obstacle', ok)).toBe('Route blocked. Re-planned in 0.40 ms, 212 nodes.');
  });
  it('words wind, goal and recovery', () => {
    expect(describeOutcome('wind', ok)).toBe('Wind zone on the route. Re-planned in 0.40 ms, 212 nodes.');
    expect(describeOutcome('goal', ok)).toBe('New goal. Planned in 0.40 ms, 212 nodes.');
    expect(describeOutcome('recovered', ok)).toBe(
      'Route found again. Re-planned in 0.40 ms, 212 nodes.',
    );
    expect(describeOutcome('algorithm', ok)).toBe('Switched algorithm. Planned in 0.40 ms, 212 nodes.');
  });
  it('says plainly when there is no route and the drone holds', () => {
    expect(describeOutcome('obstacle', { ...ok, found: false, cost: -1 })).toBe(
      'No route to the goal. The drone holds position.',
    );
  });
  it('uses singular for one node', () => {
    expect(describeOutcome('obstacle', { ...ok, expanded: 1 })).toContain('1 node.');
  });
});

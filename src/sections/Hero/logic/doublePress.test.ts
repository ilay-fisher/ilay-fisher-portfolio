import { describe, expect, it } from 'vitest';
import { DoublePress } from './doublePress';

describe('DoublePress', () => {
  it('reports the piece when a second press follows a tap quickly and nearby', () => {
    const d = new DoublePress();
    d.tap('logo', 100, 100, 1000);
    expect(d.second(103, 98, 1250)).toBe('logo');
  });

  it('is consumed by the second press, so a third press starts a new pair', () => {
    const d = new DoublePress();
    d.tap('logo', 100, 100, 0);
    expect(d.second(100, 100, 100)).toBe('logo');
    expect(d.second(100, 100, 150)).toBeNull();
  });

  it('ignores a second press that is too late (past about 400 ms)', () => {
    const d = new DoublePress();
    d.tap('logo', 100, 100, 0);
    expect(d.second(100, 100, 450)).toBeNull();
  });

  it('ignores a second press that lands too far away (more than a few pixels)', () => {
    const d = new DoublePress();
    d.tap('logo', 100, 100, 0);
    expect(d.second(130, 100, 200)).toBeNull();
  });

  it('still counts when the first tap nudged the piece away, because it measures the pointer, not the piece', () => {
    const d = new DoublePress();
    d.tap('shield', 400, 300, 0);
    expect(d.second(401, 301, 300)).toBe('shield');
  });

  it('is cleared by a drag so a grab in between breaks the pair', () => {
    const d = new DoublePress();
    d.tap('logo', 100, 100, 0);
    d.clear();
    expect(d.second(100, 100, 100)).toBeNull();
  });

  it('knows nothing before any tap', () => {
    expect(new DoublePress().second(0, 0, 0)).toBeNull();
  });
});

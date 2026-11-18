import { describe, expect, it } from 'vitest';
import { IdleScheduler } from './idle';

describe('idle nudge scheduler', () => {
  it('stays quiet until the idle threshold, then nudges', () => {
    const s = new IdleScheduler({ idleMs: 5000, minGapMs: 3000, maxGapMs: 6000, seed: 1 });
    expect(s.tick(4000)).toBeNull();
    const n = s.tick(1500);
    expect(n).not.toBeNull();
    expect(n!.pick).toBeGreaterThanOrEqual(0);
    expect(n!.pick).toBeLessThan(1);
  });
  it('spaces nudges by a gap in range and resets on interaction', () => {
    const s = new IdleScheduler({ idleMs: 1000, minGapMs: 3000, maxGapMs: 6000, seed: 2 });
    s.tick(1100);
    expect(s.tick(2500)).toBeNull();
    expect(s.tick(3600)).not.toBeNull();
    s.interact();
    expect(s.tick(500)).toBeNull();
    expect(s.tick(600)).not.toBeNull();
  });
  it('is deterministic for a seed and can be disabled', () => {
    const a = new IdleScheduler({ idleMs: 10, minGapMs: 10, maxGapMs: 20, seed: 9 });
    const b = new IdleScheduler({ idleMs: 10, minGapMs: 10, maxGapMs: 20, seed: 9 });
    expect(a.tick(50)).toEqual(b.tick(50));
    const off = new IdleScheduler({ idleMs: 10, minGapMs: 10, maxGapMs: 20, seed: 9 });
    off.setEnabled(false);
    expect(off.tick(10_000)).toBeNull();
  });
});

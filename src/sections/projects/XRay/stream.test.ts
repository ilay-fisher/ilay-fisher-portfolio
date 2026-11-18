import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStream, streamPlan } from './stream';

const TEXT = 'Left half shows two pads. Right half shows a blob, bridging the pads.';

describe('streamPlan', () => {
  it('is deterministic, monotonic and ends at the full text', () => {
    const a = streamPlan(TEXT);
    const b = streamPlan(TEXT);
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) {
      expect(a[i]!.at).toBeGreaterThan(a[i - 1]!.at);
      expect(a[i]!.upTo).toBeGreaterThan(a[i - 1]!.upTo);
    }
    expect(a.at(-1)!.upTo).toBe(TEXT.length);
  });
  it('chunks are 2 to 4 characters except possibly the last', () => {
    const plan = streamPlan(TEXT);
    let prev = 0;
    plan.slice(0, -1).forEach((c) => {
      const n = c.upTo - prev;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
      prev = c.upTo;
    });
  });
  it('pauses longer after punctuation', () => {
    const plan = streamPlan('Hello world. Next', { cps: 40, jitter: 0, punctuationPause: 500 });
    const gaps = plan.map((c, i) => c.at - (plan[i - 1]?.at ?? 0));
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(500);
  });
  it('empty text gives an empty plan', () => {
    expect(streamPlan('')).toEqual([]);
  });
});

describe('runStream', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('walks the plan on timers and reports completion', () => {
    const seen: number[] = [];
    const done = vi.fn();
    runStream(TEXT, { onProgress: (n) => seen.push(n), onDone: done, reduced: false });
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(seen.length).toBeGreaterThan(0);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20_000);
    expect(seen.at(-1)).toBe(TEXT.length);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('reduced motion emits everything at once, synchronously', () => {
    const seen: number[] = [];
    const done = vi.fn();
    runStream(TEXT, { onProgress: (n) => seen.push(n), onDone: done, reduced: true });
    expect(seen).toEqual([TEXT.length]);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('cancel stops further output', () => {
    const seen: number[] = [];
    const done = vi.fn();
    const cancel = runStream(TEXT, {
      onProgress: (n) => seen.push(n),
      onDone: done,
      reduced: false,
    });
    vi.advanceTimersByTime(300);
    cancel();
    const n = seen.length;
    vi.advanceTimersByTime(20_000);
    expect(seen.length).toBe(n);
    expect(done).not.toHaveBeenCalled();
  });
});

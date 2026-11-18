import { describe, expect, it } from 'vitest';
import {
  BLINK_TIMES,
  DOUBLE_CHANCE,
  INTERVAL_MAX,
  INTERVAL_MIN,
  blinkClosure,
  blinkDuration,
  blinkPosition,
  eyeMatrix,
  initBlink,
  mulberry32,
  pickBlinkSet,
  stepBlink,
  trackAt,
  type BlinkState,
} from './blinkLogic';

const at = <T>(a: readonly T[], i: number): T => a[i] as T;

/** Runs the scheduler on a fixed clock and records every blink as {start, end}. */
function simulate(seed: number, ms: number, paused: (t: number) => boolean = () => false, dt = 16) {
  const rng = mulberry32(seed);
  let s = initBlink(0, rng);
  const blinks: Array<{ start: number; end: number }> = [];
  let open = -1;
  let running = false;
  for (let t = 0; t <= ms; t += dt) {
    const r = stepBlink(s, t, rng, paused(t));
    s = r.state;
    if (r.started) {
      expect(running, `blink started at ${t} while one was running`).toBe(false);
      running = true;
      open = t;
    }
    if (r.ended) {
      running = false;
      blinks.push({ start: open, end: t });
    }
    expect(running).toBe(s.phase === 'blink');
  }
  return blinks;
}

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const seq = Array.from({ length: 50 }, () => a());
    expect(seq).toEqual(Array.from({ length: 50 }, () => b()));
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(mulberry32(8)()).not.toBe(mulberry32(7)());
  });
});

describe('blink timing curve', () => {
  it('has the lids down in 100-150 ms and up a little slower', () => {
    expect(BLINK_TIMES.down).toBeGreaterThanOrEqual(100);
    expect(BLINK_TIMES.down).toBeLessThanOrEqual(150);
    expect(BLINK_TIMES.up).toBeGreaterThan(BLINK_TIMES.down);
    expect(BLINK_TIMES.up).toBeLessThanOrEqual(BLINK_TIMES.down * 1.6);
    expect(blinkDuration()).toBe(BLINK_TIMES.down + BLINK_TIMES.hold + BLINK_TIMES.up);
  });
  it('starts and ends open and is shut between', () => {
    const { down, hold } = BLINK_TIMES;
    expect(blinkClosure(0)).toBe(0);
    expect(blinkClosure(down)).toBeCloseTo(1, 6);
    expect(blinkClosure(down + hold / 2)).toBe(1);
    expect(blinkClosure(blinkDuration())).toBe(0);
    expect(blinkClosure(-5)).toBe(0);
    expect(blinkClosure(blinkDuration() + 500)).toBe(0);
  });
  it('closes monotonically, then opens monotonically', () => {
    const { down, hold } = BLINK_TIMES;
    let prev = -1;
    for (let t = 0; t <= down; t += 4) {
      const c = blinkClosure(t);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
    prev = 2;
    for (let t = down + hold; t <= blinkDuration(); t += 4) {
      const c = blinkClosure(t);
      expect(c).toBeLessThanOrEqual(prev);
      prev = c;
    }
  });
  it('is shut for most of the time the lids move fastest (no linear fade)', () => {
    // eased: slow at the very start, fastest mid-way
    expect(blinkClosure(BLINK_TIMES.down * 0.1)).toBeLessThan(0.1);
    expect(blinkClosure(BLINK_TIMES.down * 0.5)).toBeCloseTo(0.5, 1);
  });
});

describe('blinkPosition (footage frame at a time)', () => {
  const count = 9;
  const closed = 4;
  it('walks closing frames, sits on the closed one, then opening frames', () => {
    const { down, hold } = BLINK_TIMES;
    expect(blinkPosition(0, count, closed)).toBe(0);
    expect(blinkPosition(down, count, closed)).toBeCloseTo(closed, 6);
    expect(blinkPosition(down + hold / 2, count, closed)).toBe(closed);
    expect(blinkPosition(blinkDuration() - 1e-6, count, closed)).toBeCloseTo(count - 1, 3);
  });
  it('is monotonic over the whole blink and null outside it', () => {
    let prev = -1;
    for (let t = 0; t < blinkDuration(); t += 3) {
      const p = blinkPosition(t, count, closed);
      expect(p).not.toBeNull();
      expect(p as number).toBeGreaterThanOrEqual(prev);
      prev = p as number;
    }
    expect(blinkPosition(-1, count, closed)).toBeNull();
    expect(blinkPosition(blinkDuration(), count, closed)).toBeNull();
  });
});

describe('blink scheduler', () => {
  it('first blink comes soon, later ones every 3 to 7 s with the occasional double', () => {
    const blinks = simulate(11, 600_000);
    expect(blinks.length).toBeGreaterThan(60);
    const starts = blinks.map((b) => b.start);
    expect(starts[0]).toBeLessThan(4000);
    const gaps: number[] = [];
    const doubles: number[] = [];
    for (let i = 1; i < blinks.length; i++) {
      const gap = at(blinks, i).start - at(blinks, i - 1).end;
      if (gap < 1000) doubles.push(gap);
      else gaps.push(gap);
    }
    // 16 ms clock: allow a frame of slack either side
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(INTERVAL_MIN - 16);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(INTERVAL_MAX + 16 + blinkDuration());
    expect(doubles.length).toBeGreaterThan(0);
    expect(doubles.length / blinks.length).toBeLessThan(DOUBLE_CHANCE * 1.2);
    expect(doubles.every((g) => g >= 80 && g <= 400)).toBe(true);
  });
  it('never starts a blink while one is running, and never runs three in a row', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const blinks = simulate(seed, 300_000, () => false, 7);
      let run = 1;
      for (let i = 1; i < blinks.length; i++) {
        expect(at(blinks, i).start).toBeGreaterThanOrEqual(at(blinks, i - 1).end);
        run = at(blinks, i).start - at(blinks, i - 1).end < 1000 ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(2);
      }
    }
  });
  it('is reproducible for a seed', () => {
    expect(simulate(5, 60_000)).toEqual(simulate(5, 60_000));
    expect(simulate(5, 60_000)).not.toEqual(simulate(6, 60_000));
  });
  it('lasts as long as the curve, whatever the clock step', () => {
    for (const b of simulate(3, 120_000, () => false, 5)) {
      expect(b.end - b.start).toBeGreaterThanOrEqual(blinkDuration());
      expect(b.end - b.start).toBeLessThanOrEqual(blinkDuration() + 5);
    }
  });
  it('does not blink while paused (reduced motion, off screen) and aborts a running blink', () => {
    const blinks = simulate(4, 60_000, () => true);
    expect(blinks).toEqual([]);
    const rng = mulberry32(2);
    let s: BlinkState = initBlink(0, rng);
    let t = 0;
    while (s.phase !== 'blink') {
      t += 16;
      s = stepBlink(s, t, rng, false).state;
    }
    const r = stepBlink(s, t + 20, rng, true);
    expect(r.ended).toBe(true);
    expect(r.state.phase).toBe('wait');
    expect(r.state.until).toBeGreaterThan(t + 20);
  });
  it('waits a fresh interval after being unpaused instead of blinking at once', () => {
    const rng = mulberry32(9);
    const s0 = initBlink(0, rng);
    const r = stepBlink(s0, 100_000, rng, true);
    expect(r.started).toBe(false);
    const back = stepBlink(r.state, 100_016, rng, false);
    expect(back.started).toBe(false);
  });
  it('defers a blink the caller cannot show (no set in reach) without losing the schedule', () => {
    const rng = mulberry32(3);
    let s = initBlink(0, rng);
    const wait = s.until;
    const r = stepBlink(s, wait + 1, rng, false, false);
    expect(r.started).toBe(false);
    expect(r.state.phase).toBe('wait');
    expect(r.state.until).toBeGreaterThan(wait + 1);
    expect(r.state.until).toBeLessThanOrEqual(wait + 1 + 400);
    s = r.state;
    expect(stepBlink(s, s.until + 1, rng, false, true).started).toBe(true);
  });
});

describe('pickBlinkSet (nearest real sequence)', () => {
  const anchors = [3, 7, 11, 17, 35, 45, 52];
  it('picks the set whose anchor is nearest the current frame index', () => {
    expect(pickBlinkSet(anchors, 3, 10)).toBe(0);
    expect(pickBlinkSet(anchors, 8, 10)).toBe(1);
    expect(pickBlinkSet(anchors, 25.4, 10)).toBe(3);
    expect(pickBlinkSet(anchors, 26.4, 10)).toBe(4);
    expect(pickBlinkSet(anchors, 62, 10)).toBe(6);
  });
  it('breaks ties toward the earlier set, deterministically', () => {
    expect(pickBlinkSet(anchors, 5, 10)).toBe(0);
    expect(pickBlinkSet(anchors, 26, 10)).toBe(3);
  });
  it('returns -1 beyond the reach of every set', () => {
    expect(pickBlinkSet([20], 31, 10)).toBe(-1);
    expect(pickBlinkSet([20], 30, 10)).toBe(0);
    expect(pickBlinkSet([], 5, 10)).toBe(-1);
    expect(pickBlinkSet(anchors, Number.NaN, 10)).toBe(-1);
  });
});

describe('eye tracks', () => {
  // [a, b, tx, c, d, ty] rows, as stored in blinks.json
  const tracks = [
    [1, 0, 0, 0, 1, 0],
    [1, 0, 10, 0, 1, 4],
    [2, 0, 30, 0, 2, 8],
  ];
  it('interpolates between neighbouring frames', () => {
    expect(trackAt(tracks, 0)).toEqual([1, 0, 0, 0, 1, 0]);
    expect(trackAt(tracks, 0.5)).toEqual([1, 0, 5, 0, 1, 2]);
    expect(trackAt(tracks, 1.5)).toEqual([1.5, 0, 20, 0, 1.5, 6]);
    expect(trackAt(tracks, 2)).toEqual([2, 0, 30, 0, 2, 8]);
    expect(trackAt(tracks, -3)).toEqual(tracks[0]);
    expect(trackAt(tracks, 9)).toEqual(tracks[2]);
  });
  it('maps anchor-frame coordinates to the current frame: identity at the anchor', () => {
    const m = eyeMatrix(tracks, 1, 1);
    m.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, 0, 1, 0][i] ?? 0, 9));
  });
  it('moves and scales a point the way the eye moved', () => {
    // anchor frame 1 -> frame 2: the eye grew 2x/1 = 2 and moved
    const [a, b, tx, c, d, ty] = eyeMatrix(tracks, 2, 1);
    const p = { x: 100, y: 50 };
    // frame-1 point -> neutral -> frame-2 point, worked by hand
    const nx = p.x - 10;
    const ny = p.y - 4;
    expect(a * p.x + b * p.y + tx).toBeCloseTo(2 * nx + 30, 6);
    expect(c * p.x + d * p.y + ty).toBeCloseTo(2 * ny + 8, 6);
  });
});

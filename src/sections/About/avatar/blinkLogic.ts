/**
 * Pure logic for the avatar's blinks: when to blink, how fast the lids move, which recorded blink to play at a given
 * head angle, and where an eye is in each head frame. No DOM, no timers.
 *
 * The blinks themselves are real footage (see generate_blinks.py): per recorded blink, a short run of small lid
 * patches (open, closing, closed, opening, open) registered to one head frame, its anchor. A patch is drawn over the
 * head frame at the eye's tracked position, so the lids move and the head does not.
 */

type Rng = () => number;

/** Small fast seeded generator, so the scheduler can be tested and replayed. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Lid timing (ms): about 120 down, a held beat, a slightly slower 170 up. */
export const BLINK_TIMES = { down: 120, hold: 35, up: 170 };
/** Rest between the end of one blink and the start of the next (ms). */
export const INTERVAL_MIN = 3000;
export const INTERVAL_MAX = 7000;
/** Share of blinks that are followed by a second quick one. */
export const DOUBLE_CHANCE = 0.2;
/** Gap (ms) between the two blinks of a double. */
const DOUBLE_GAP: [number, number] = [130, 230];
/** The first blink comes a little after the portrait is shown (ms). */
const FIRST: [number, number] = [1500, 3500];
/** When a blink is due but cannot be shown yet, look again after this (ms). */
const RETRY: [number, number] = [150, 400];
/** After a pause (off screen), wait at least this long before blinking (ms). */
const RESUME_WAIT = 1000;

export const blinkDuration = (t = BLINK_TIMES): number => t.down + t.hold + t.up;

/** Lid closure over a blink: 0 open, 1 shut. Eased both ways, so it is slow at the ends and quick in the middle. */
export function blinkClosure(elapsed: number, t = BLINK_TIMES): number {
  if (!(elapsed > 0) || elapsed >= blinkDuration(t)) return 0;
  if (elapsed < t.down) return smooth(elapsed / t.down);
  if (elapsed < t.down + t.hold) return 1;
  return 1 - smooth((elapsed - t.down - t.hold) / t.up);
}

/**
 * Which footage patch to show `elapsed` ms into a blink, as a fractional index into the set's patches
 * (0 = lids open, `closed` = shut, `count - 1` = open again). Null outside the blink.
 */
export function blinkPosition(
  elapsed: number,
  count: number,
  closed: number,
  t = BLINK_TIMES,
): number | null {
  if (!(elapsed >= 0) || elapsed >= blinkDuration(t)) return null;
  if (elapsed < t.down) return closed * smooth(elapsed / t.down);
  if (elapsed < t.down + t.hold) return closed;
  return closed + smooth((elapsed - t.down - t.hold) / t.up) * (count - 1 - closed);
}

export interface BlinkState {
  phase: 'wait' | 'blink';
  /** When (ms) the wait ends and a blink starts, or the running blink ends. */
  until: number;
  /** The blink running now, or the one coming next, is the second of a double. */
  second: boolean;
}

const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);

export function initBlink(now: number, rng: Rng): BlinkState {
  return { phase: 'wait', until: now + between(rng, FIRST), second: false };
}

/**
 * Advances the blink scheduler. `paused` (reduced motion, off screen) cancels a running blink and holds the next one
 * back. `canShow` says whether a recorded blink is in reach of the current head angle; when it is not, a due blink
 * waits a moment and tries again. A blink never starts while another is running.
 */
export function stepBlink(
  s: BlinkState,
  now: number,
  rng: Rng,
  paused: boolean,
  canShow = true,
): { state: BlinkState; started: boolean; ended: boolean } {
  if (paused) {
    const state: BlinkState = {
      phase: 'wait',
      until: Math.max(s.until, now + RESUME_WAIT),
      second: false,
    };
    return {
      state: s.phase === 'wait' && s.until >= now + RESUME_WAIT ? s : state,
      started: false,
      ended: s.phase === 'blink',
    };
  }
  if (s.phase === 'wait') {
    if (now < s.until) return { state: s, started: false, ended: false };
    if (!canShow) {
      return { state: { ...s, until: now + between(rng, RETRY) }, started: false, ended: false };
    }
    return {
      state: { phase: 'blink', until: now + blinkDuration(), second: s.second },
      started: true,
      ended: false,
    };
  }
  if (now < s.until) return { state: s, started: false, ended: false };
  const double = !s.second && rng() < DOUBLE_CHANCE;
  return {
    state: double
      ? { phase: 'wait', until: now + between(rng, DOUBLE_GAP), second: true }
      : {
          phase: 'wait',
          until: now + INTERVAL_MIN + rng() * (INTERVAL_MAX - INTERVAL_MIN),
          second: false,
        },
    started: false,
    ended: true,
  };
}

/**
 * The recorded blink to play at a head frame index: the set whose anchor frame is nearest, or -1 when none is within
 * `reach` frames. Ties go to the earlier set, so the choice is stable.
 */
export function pickBlinkSet(anchors: readonly number[], index: number, reach: number): number {
  if (!Number.isFinite(index)) return -1;
  let best = -1;
  let bestD = Infinity;
  anchors.forEach((a, i) => {
    const d = Math.abs(a - index);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return bestD <= reach ? best : -1;
}

/** Row-major 2x3 affine [a, b, tx, c, d, ty]: x' = a x + b y + tx, y' = c x + d y + ty. */
export type Affine = number[];

const IDENTITY: Affine = [1, 0, 0, 0, 1, 0];

/** An eye's affine (neutral-frame coordinates to frame coordinates) at a fractional frame index. */
export function trackAt(tracks: readonly Affine[], index: number): Affine {
  const last = tracks.length - 1;
  const i = clamp(Number.isFinite(index) ? index : 0, 0, last);
  const a = Math.floor(i);
  const b = Math.min(a + 1, last);
  const t = i - a;
  const from = tracks[a] ?? IDENTITY;
  const to = tracks[b] ?? from;
  if (t === 0 || a === b) return [...from];
  return from.map((v, k) => v + ((to[k] ?? v) - v) * t);
}

/** Maps anchor-frame coordinates to coordinates in the frame at `index`, following the eye: T(index) * T(anchor)^-1. */
export function eyeMatrix(
  tracks: readonly Affine[],
  index: number,
  anchor: number,
): [number, number, number, number, number, number] {
  const [a = 1, b = 0, tx = 0, c = 0, d = 1, ty = 0] = trackAt(tracks, index);
  const [pa = 1, pb = 0, ptx = 0, pc = 0, pd = 1, pty = 0] = trackAt(tracks, anchor);
  const det = pa * pd - pb * pc;
  const ia = pd / det;
  const ib = -pb / det;
  const ic = -pc / det;
  const id = pa / det;
  const itx = -(ia * ptx + ib * pty);
  const ity = -(ic * ptx + id * pty);
  return [
    a * ia + b * ic,
    a * ib + b * id,
    a * itx + b * ity + tx,
    c * ia + d * ic,
    c * ib + d * id,
    c * itx + d * ity + ty,
  ];
}

/** The shape of blinks.json (written by generate_blinks.py). */
export interface BlinkData {
  atlas: string;
  bytes: number;
  pw: number;
  ph: number;
  neutral: number;
  sets: Array<{
    id: string;
    anchor: number;
    reach: number;
    count: number;
    closed: number;
    eyes: Array<{ eye: 0 | 1; ox: number; oy: number; row: number }>;
  }>;
  tracks: { E0: Affine[]; E1: Affine[] };
}

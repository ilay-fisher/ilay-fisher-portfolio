/**
 * Pure maths for the avatar portrait. No DOM, no timers: every function takes its inputs and returns a number or
 * a small state, so it is unit-tested directly.
 *
 * Vocabulary. `look` is where the head points, -1 (far screen left) to +1 (far screen right), 0 facing the
 * visitor. `index` is a position in the frame set, where frame 0 is the head turned far to screen right and the
 * last frame is far to screen left, so a larger `look` means a smaller `index`.
 */

/** Fraction of the range, either side of the portrait centre, where the head stays facing the visitor. */
export const DEAD_ZONE = 0.06;
/** Pointer inactivity (ms) before the head starts looking around by itself. */
export const IDLE_AFTER = 2600;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/** Horizontal distance (px) from the portrait centre at which the head is fully turned. */
export function lookRange(viewportWidth: number): number {
  return clamp(finite(viewportWidth) * 0.42, 260, 760);
}

/** Pointer offset from the portrait centre (px, positive right) to a look in [-1, 1], with a dead zone near 0. */
export function pointerToLook(dx: number, range: number): number {
  if (!(range > 0)) return 0;
  const x = finite(dx) / range;
  const mag = Math.abs(x);
  if (mag <= DEAD_ZONE) return 0;
  const v = Math.min(1, (mag - DEAD_ZONE) / (1 - DEAD_ZONE));
  return Math.sign(x) * v;
}

/** Vertical pointer offset (px, positive down) to a pitch in [-1, 1], positive when the pointer is above. */
export function pitchFromPointer(dy: number, range: number): number {
  if (!(range > 0)) return 0;
  return clamp(-finite(dy) / range, -1, 1) + 0;
}

/** Fractional frame index for a look. Piecewise linear through the neutral frame, so it is monotonic. */
export function lookToIndex(look: number, count: number, neutral: number): number {
  const l = clamp(finite(look), -1, 1);
  const last = count - 1;
  return l >= 0 ? neutral * (1 - l) : neutral + -l * (last - neutral);
}

/** Inverse of `lookToIndex`. */
export function indexToLook(index: number, count: number, neutral: number): number {
  const last = count - 1;
  const i = clamp(index, 0, last);
  return i <= neutral ? 1 - i / neutral : -((i - neutral) / (last - neutral));
}

/** Frame to draw for a fractional index. */
export function nearestIndex(index: number, count: number): number {
  return clamp(Math.round(index), 0, count - 1);
}

/** Small tilt and parallax of the image inside the bezel, so he seems to look up and down. Degrees and pixels. */
export function avatarPose(look: number, pitch: number): { rx: number; rz: number; ty: number } {
  const p = clamp(pitch, -1, 1);
  return {
    rx: p * 4 || 0,
    rz: -clamp(look, -1, 1) * 1.2 || 0,
    ty: -p * 6 || 0,
  };
}

/** Touch devices: a gentle look from the portrait's progress through the viewport (0 entering, 1 leaving). */
export function scrollToLook(progress: number): number {
  return clamp((clamp(progress, 0, 1) - 0.5) * 1.4, -0.7, 0.7);
}

export type IdlePhase = 'wait' | 'look' | 'return';
export interface IdleState {
  phase: IdlePhase;
  /** When (ms) the current phase ends. */
  until: number;
  /** The glance direction and size while in the `look` phase. */
  target: number;
}

type Rng = () => number;

/** A fresh scheduler: waits a little, then glances. */
export function initIdle(now: number, rng: Rng): IdleState {
  return { phase: 'wait', until: now + 1800 + rng() * 2500, target: 0 };
}

/**
 * Advances the idle look-around. While the pointer was active within `IDLE_AFTER` ms it returns `look: null`
 * (the pointer is in charge) and resets to waiting. Otherwise it glances to one side, holds, returns to facing the
 * visitor, rests for a few seconds and repeats.
 */
export function stepIdle(
  s: IdleState,
  now: number,
  lastInput: number,
  rng: Rng,
): { state: IdleState; look: number | null } {
  if (now - lastInput < IDLE_AFTER) {
    return { state: { phase: 'wait', until: now + 1800 + rng() * 2500, target: 0 }, look: null };
  }
  let state = s;
  if (now >= s.until) {
    if (s.phase === 'wait') {
      const sign = rng() < 0.5 ? -1 : 1;
      state = { phase: 'look', until: now + 1100 + rng() * 1200, target: sign * (0.45 + rng() * 0.5) };
    } else if (s.phase === 'look') {
      state = { phase: 'return', until: now + 700, target: 0 };
    } else {
      state = { phase: 'wait', until: now + 3500 + rng() * 4500, target: 0 };
    }
  }
  return { state, look: state.phase === 'look' ? state.target : 0 };
}

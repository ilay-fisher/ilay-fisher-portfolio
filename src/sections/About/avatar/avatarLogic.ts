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

/** Virtual distance (px) between the visitor's eyes and the screen: sets how sharply the head follows the pointer. */
export const VIEW_DEPTH = 260;
/** Pointer angle (degrees) from straight ahead at which the head is fully turned. */
export const MAX_YAW_DEG = 52;
/** Pointer angle (degrees) above or below at which the head is fully pitched. */
export const MAX_PITCH_DEG = 40;
/** Half-width (px) of the soft zone over the face where the head faces the visitor (a smooth ramp, not a step). */
export const FACE_ZONE = 70;

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Where the head points for a pointer at (dx, dy) px from the face centre (positive right / down). It is the angle of
 * the pointer as seen from the face, `atan2(dx, depth)`, so it follows the pointer's direction at any distance
 * rather than a fraction of the viewport width. Over the face it eases to 0 with a smooth ramp: no dead zone to
 * get stuck in, no jump at its edge.
 */
export function pointerToYaw(dx: number, dy = 0, depth = VIEW_DEPTH): number {
  const x = finite(dx);
  const raw = clamp(
    ((Math.atan2(x, depth) * 180) / Math.PI / MAX_YAW_DEG) *
      Math.cos(Math.atan2(Math.abs(finite(dy)), depth * 4)),
    -1,
    1,
  );
  return raw * smooth(0, FACE_ZONE, Math.abs(x)) + 0;
}

/** Pitch in [-1, 1] from the pointer's vertical angle, positive when the pointer is above the face. */
export function pointerToPitch(dy: number, depth = VIEW_DEPTH): number {
  return clamp(-(Math.atan2(finite(dy), depth) * 180) / Math.PI / MAX_PITCH_DEG, -1, 1) + 0;
}

/** Which two neighbouring frames to draw for a fractional index, and how much of the second (0..1). */
export function blendFrames(index: number, count: number): { a: number; b: number; t: number } {
  const i = clamp(finite(index), 0, count - 1);
  const a = Math.floor(i);
  const b = Math.min(a + 1, count - 1);
  return { a, b, t: b === a ? 0 : i - a };
}

/** Where the face centre sits in the stage, as a fraction of its height from the top. */
export const FACE_Y = 0.4;

/** Spring for the head: critically damped, about 0.25 s, so small pointer moves answer at once and without stepping. */
export const LOOK_SPRING = { stiffness: 240, damping: 30 };

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
      state = {
        phase: 'look',
        until: now + 1100 + rng() * 1200,
        target: sign * (0.45 + rng() * 0.5),
      };
    } else if (s.phase === 'look') {
      state = { phase: 'return', until: now + 700, target: 0 };
    } else {
      state = { phase: 'wait', until: now + 3500 + rng() * 4500, target: 0 };
    }
  }
  return { state, look: state.phase === 'look' ? state.target : 0 };
}

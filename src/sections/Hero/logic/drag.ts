import type { Vec3 } from './camera';

const ZERO = (): Vec3 => ({ x: 0, y: 0, z: 0 });

/** Scales a vector down to `max` length when it is longer; otherwise returns it unchanged. */
export function clampVec(v: Vec3, max: number): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z);
  if (l <= max || l === 0) return v;
  const k = max / l;
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

/**
 * Acceleration of a damped spring pulling a grabbed body toward the pointer:
 * `k * displacement - c * velocity`, clamped so a far-away pointer cannot launch the body.
 */
export function springAccel(
  displacement: Vec3,
  velocity: Vec3,
  k: number,
  c: number,
  maxAccel: number,
): Vec3 {
  return clampVec(
    {
      x: k * displacement.x - c * velocity.x,
      y: k * displacement.y - c * velocity.y,
      z: k * displacement.z - c * velocity.z,
    },
    maxAccel,
  );
}

interface Sample {
  t: number;
  p: Vec3;
}

/** Remembers recent pointer positions (on the drag plane) to estimate the velocity at release. */
export class VelocityTracker {
  private samples: Sample[] = [];

  constructor(private readonly windowMs = 100) {}

  /** Records a pointer sample at time `tMs`. */
  push(tMs: number, p: Vec3): void {
    this.samples.push({ t: tMs, p: { ...p } });
    const cutoff = tMs - this.windowMs * 3;
    while (this.samples.length > 2 && this.samples[0]!.t < cutoff) this.samples.shift();
  }

  /** Forgets all samples (new grab). */
  reset(): void {
    this.samples = [];
  }

  /**
   * Velocity in units per second over the last window, clamped to `maxSpeed`. Zero when there
   * are too few samples or when the pointer has been still for longer than the window
   * (`nowMs` given): holding still then letting go must not throw.
   */
  estimate(maxSpeed: number, nowMs?: number): Vec3 {
    const last = this.samples[this.samples.length - 1];
    if (!last || this.samples.length < 2) return ZERO();
    if (nowMs !== undefined && nowMs - last.t > this.windowMs) return ZERO();
    const inWindow = this.samples.filter((s) => s.t >= last.t - this.windowMs);
    const first = inWindow[0]!;
    const dt = (last.t - first.t) / 1000;
    if (inWindow.length < 2 || dt <= 0) return ZERO();
    return clampVec(
      {
        x: (last.p.x - first.p.x) / dt,
        y: (last.p.y - first.p.y) / dt,
        z: (last.p.z - first.p.z) / dt,
      },
      maxSpeed,
    );
  }
}

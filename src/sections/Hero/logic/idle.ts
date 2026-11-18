import { createRng } from './rng';

/** Options for {@link IdleScheduler}. */
export interface IdleOptions {
  /** Quiet time after the last interaction before the first nudge. */
  idleMs: number;
  minGapMs: number;
  maxGapMs: number;
  seed: number;
}

/**
 * Decides when the idle scene should get a gentle nudge so it never sits dead. Pure: the caller
 * passes elapsed time and applies the nudge (`pick` in [0,1) chooses which body).
 */
export class IdleScheduler {
  private sinceInteract = 0;
  private sinceNudge = 0;
  private gap: number | null = null;
  private enabled = true;
  private readonly rng: () => number;

  constructor(private readonly o: IdleOptions) {
    this.rng = createRng(o.seed);
  }

  /** Call on any pointer or key interaction. */
  interact(): void {
    this.sinceInteract = 0;
    this.sinceNudge = 0;
    this.gap = null;
  }

  /** Turn nudging off (off screen, reduced motion). */
  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /** Advances the clock; returns a nudge request when one is due. */
  tick(dtMs: number): { pick: number } | null {
    if (!this.enabled) return null;
    this.sinceInteract += dtMs;
    if (this.sinceInteract < this.o.idleMs) return null;
    if (this.gap === null) return this.fire();
    this.sinceNudge += dtMs;
    return this.sinceNudge >= this.gap ? this.fire() : null;
  }

  private fire(): { pick: number } {
    this.gap = this.o.minGapMs + this.rng() * (this.o.maxGapMs - this.o.minGapMs);
    this.sinceNudge = 0;
    return { pick: this.rng() };
  }
}

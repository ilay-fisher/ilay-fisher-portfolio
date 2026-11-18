/**
 * Fixed-timestep accumulator. Feed it real frame deltas; it says how many physics steps to run
 * and how far between the last two steps the renderer should interpolate (`alpha`, 0..1).
 */
export class FixedStepper {
  private acc = 0;

  /**
   * @param step seconds per physics step
   * @param maxSteps cap per frame so a slow frame cannot spiral
   * @param maxFrame longest frame delta honoured (a tab returning after minutes counts as this)
   */
  constructor(
    readonly step: number,
    private readonly maxSteps = 8,
    private readonly maxFrame = 0.25,
  ) {}

  /** Consumes `dt` seconds of real time. */
  advance(dt: number): { steps: number; alpha: number } {
    const d = Number.isFinite(dt) && dt > 0 ? Math.min(dt, this.maxFrame) : 0;
    this.acc += d;
    let steps = 0;
    while (this.acc >= this.step - 1e-9 && steps < this.maxSteps) {
      this.acc -= this.step;
      steps++;
    }
    if (steps === this.maxSteps) this.acc %= this.step;
    this.acc = Math.max(0, this.acc);
    return { steps, alpha: Math.min(1, this.acc / this.step) };
  }

  /** Drops leftover time (after a pause or reset). */
  reset(): void {
    this.acc = 0;
  }
}

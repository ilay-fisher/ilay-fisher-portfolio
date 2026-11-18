/** Quality settings the renderer can apply. Pixel ratio is a multiplier on the capped device ratio. */
export interface QualitySettings {
  dprScale: number;
  shadowSize: number;
}

const LEVELS: QualitySettings[] = [
  { dprScale: 1, shadowSize: 2048 },
  { dprScale: 0.85, shadowSize: 2048 },
  { dprScale: 0.7, shadowSize: 1024 },
  { dprScale: 0.55, shadowSize: 1024 },
];

/** Options for {@link QualityController}. */
export interface QualityOptions {
  /** Frames per evaluation window. */
  window?: number;
  /** Median frame time above which quality steps down. */
  budgetMs?: number;
}

/**
 * Adaptive resolution: looks at the median frame time over a window (so a one-off spike such as
 * a tab return is ignored) and steps quality down one level when it is over budget. It never
 * steps back up, so it cannot thrash.
 */
export class QualityController {
  private frames: number[] = [];
  private lvl = 0;
  private readonly windowSize: number;
  private readonly budget: number;

  constructor(o: QualityOptions = {}) {
    this.windowSize = o.window ?? 30;
    this.budget = o.budgetMs ?? 20;
  }

  get level(): number {
    return this.lvl;
  }
  get maxLevel(): number {
    return LEVELS.length - 1;
  }
  get settings(): QualitySettings {
    return LEVELS[this.lvl]!;
  }

  /** Records a frame time; returns the new settings only when the level just changed. */
  record(frameMs: number): QualitySettings | null {
    this.frames.push(frameMs);
    if (this.frames.length < this.windowSize) return null;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    this.frames = [];
    if (median > this.budget && this.lvl < this.maxLevel) {
      this.lvl++;
      return this.settings;
    }
    return null;
  }
}

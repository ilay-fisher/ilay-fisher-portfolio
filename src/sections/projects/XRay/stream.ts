/** Typed-stream scheduler: replays a recorded string as if tokens were arriving. */

/** One step of a plan: at `at` ms after the start, `upTo` characters are visible. */
export interface StreamStep {
  at: number;
  upTo: number;
}

/** Tuning for {@link streamPlan}. */
export interface StreamOptions {
  /** Average characters per second. Default 38. */
  cps?: number;
  /** Random spread of each gap, 0 to 1. Default 0.4. */
  jitter?: number;
  /** Extra pause after . , ; : ! ? in ms. Default 160. */
  punctuationPause?: number;
}

/** Small seeded generator so the same text always streams the same way. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits `text` into 2 to 4 character chunks with jittered gaps and a longer pause after
 * punctuation. Times strictly increase, character counts strictly increase, and the last step
 * is the full text.
 */
export function streamPlan(text: string, opts: StreamOptions = {}): StreamStep[] {
  const { cps = 38, jitter = 0.4, punctuationPause = 160 } = opts;
  const rand = mulberry32(text.length * 7919 + 17);
  const plan: StreamStep[] = [];
  let i = 0;
  let t = 0;
  while (i < text.length) {
    let n = 2 + Math.floor(rand() * 3);
    n = Math.min(n, text.length - i);
    i += n;
    const base = (n / cps) * 1000;
    t += Math.max(1, base * (1 + (rand() * 2 - 1) * jitter));
    if (/[.,;:!?]$/.test(text.slice(0, i)) && i < text.length) t += punctuationPause;
    plan.push({ at: t, upTo: i });
  }
  return plan;
}

/** Callbacks and mode for {@link runStream}. */
export interface RunStreamOptions extends StreamOptions {
  onProgress: (visibleChars: number) => void;
  onDone: () => void;
  /** Reduced motion: emit everything at once, synchronously. */
  reduced: boolean;
}

/** Plays a plan with timers. Returns a cancel function; after it, nothing more is emitted. */
export function runStream(text: string, o: RunStreamOptions): () => void {
  if (o.reduced || text.length === 0) {
    o.onProgress(text.length);
    o.onDone();
    return () => {};
  }
  const plan = streamPlan(text, o);
  let idx = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  let prevAt = 0;
  const step = () => {
    if (cancelled) return;
    const s = plan[idx]!;
    o.onProgress(s.upTo);
    prevAt = s.at;
    idx++;
    if (idx >= plan.length) o.onDone();
    else timer = setTimeout(step, plan[idx]!.at - prevAt);
  };
  timer = setTimeout(step, plan[0]!.at);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

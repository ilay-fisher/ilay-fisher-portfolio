/**
 * Mulberry32 seeded PRNG: tiny, fast and good enough for placing demo obstacles and for
 * reproducible tests. Ported from the owner's drone-obstacle-sandbox test helpers.
 * Returns a function that yields floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [0, n) from a `[0, 1)` source. */
export function randInt(rng: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

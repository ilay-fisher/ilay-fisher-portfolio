/** Formatters for the "why it matters" readout. */

/** Milliseconds: "<1 ms", one decimal under 10, whole numbers above, thousands separated. */
export function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms).toLocaleString('en-US')} ms`;
}

/** Percent with at most one decimal, dropping a trailing ".0". */
export function formatPct(p: number): string {
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}

/** Token count with thousands separators. */
export function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

/** Share saved going from `full` to `part`, in percent. 0 when `full` is 0. */
export function savedPct(full: number, part: number): number {
  return full === 0 ? 0 : (1 - part / full) * 100;
}

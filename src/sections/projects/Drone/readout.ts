/**
 * Formatting and wording for the bench readout and the polite live region. Kept free of
 * React so the exact sentences are unit tested.
 */

/** Milliseconds with precision that suits the magnitude; very small values read as "<0.01 ms". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return 'n/a';
  if (ms < 0.005) return '<0.01 ms';
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

/** Path cost to one decimal; a negative cost means the planner found no path. */
export function formatCost(cost: number): string {
  return cost < 0 ? 'no path' : cost.toFixed(1);
}

/** A count with a thousands separator. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** Why a plan happened. Drives the wording of the announcement. */
export type OutcomeKind =
  | 'obstacle'
  | 'wind'
  | 'erased'
  | 'recovered'
  | 'goal'
  | 'algorithm'
  | 'reset'
  | 'arrived'
  | 'none';

/** The measured parts of a plan that the sentence quotes. */
export interface PlanFacts {
  found: boolean;
  ms: number;
  expanded: number;
}

const LEAD: Partial<Record<OutcomeKind, [string, string]>> = {
  obstacle: ['Route blocked.', 'Re-planned'],
  wind: ['Wind zone on the route.', 'Re-planned'],
  erased: ['Obstacle removed.', 'Re-planned'],
  recovered: ['Route found again.', 'Re-planned'],
  goal: ['New goal.', 'Planned'],
  algorithm: ['Switched algorithm.', 'Planned'],
  reset: ['Reset.', 'Planned'],
};

/**
 * The sentence announced after a plan, for example
 * "Route blocked. Re-planned in 0.40 ms, 212 nodes." All numbers are the measured values.
 */
export function describeOutcome(kind: OutcomeKind, facts: PlanFacts): string {
  if (!facts.found) return 'No route to the goal. The drone holds position.';
  const [lead, verb] = LEAD[kind] ?? ['Planned.', 'Planned'];
  const nodes = `${formatCount(facts.expanded)} ${facts.expanded === 1 ? 'node' : 'nodes'}`;
  return `${lead} ${verb} in ${formatMs(facts.ms)}, ${nodes}.`;
}

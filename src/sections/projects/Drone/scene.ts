import { mulberry32, randInt } from './planner/rng';

/** The starting map: building blocks, wind patches, and where the drone starts and flies to. */
export interface City {
  walls: [number, number][];
  wind: [number, number][];
  start: { x: number; y: number };
  goal: { x: number; y: number };
}

/**
 * A deterministic city: rectangular blocks separated by two-cell streets (so every street is
 * connected and the goal is always reachable), a clear lane at each end for start and goal, and
 * a few wind patches over the streets. Same seed and size always give the same city.
 */
export function buildCity(cols: number, rows: number, seed: number): City {
  const rng = mulberry32(seed * 2654435761);
  const wallSet = new Set<number>();
  const midY = rows >> 1;
  const margin = cols < 30 ? 3 : 4;
  let x = margin;
  while (x + 2 <= cols - margin) {
    const bw = Math.min(2 + randInt(rng, 3), cols - margin - x);
    let y = 1;
    while (y + 2 <= rows - 1) {
      const bh = Math.min(2 + randInt(rng, 3), rows - 1 - y);
      if (rng() < 0.68) {
        for (let yy = y; yy < y + bh; yy++) {
          for (let xx = x; xx < x + bw; xx++) wallSet.add(yy * cols + xx);
        }
      }
      y += bh + 2;
    }
    x += bw + 2;
  }
  const windSet = new Set<number>();
  const patches = 2 + randInt(rng, 2);
  for (let p = 0; p < patches; p++) {
    const px = margin + 1 + randInt(rng, Math.max(1, cols - 2 * margin - 4));
    const py = 1 + randInt(rng, Math.max(1, rows - 5));
    for (let yy = py; yy < py + 3; yy++) {
      for (let xx = px; xx < px + 4; xx++) {
        const i = yy * cols + xx;
        if (xx < cols && yy < rows && !wallSet.has(i)) windSet.add(i);
      }
    }
  }
  const toXY = (i: number): [number, number] => [i % cols, Math.floor(i / cols)];
  return {
    walls: [...wallSet].sort((a, b) => a - b).map(toXY),
    wind: [...windSet].sort((a, b) => a - b).map(toXY),
    start: { x: 1, y: midY },
    goal: { x: cols - 2, y: midY },
  };
}

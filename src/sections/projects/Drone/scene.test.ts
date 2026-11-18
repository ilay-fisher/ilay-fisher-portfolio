import { describe, expect, it } from 'vitest';
import { AStar } from './planner/astar';
import { Grid, WALL, WIND } from './planner/grid';
import { buildCity } from './scene';

describe('buildCity', () => {
  const sizes: [number, number][] = [
    [40, 24],
    [28, 20],
    [20, 22],
  ];
  for (const [cols, rows] of sizes) {
    it(`makes a reachable city at ${cols}x${rows} for many seeds`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const city = buildCity(cols, rows, seed);
        const g = new Grid(cols, rows);
        for (const [x, y] of city.walls) g.set(x, y, WALL);
        for (const [x, y] of city.wind) g.set(x, y, WIND);
        expect(g.get(city.start.x, city.start.y)).toBe(0);
        expect(g.get(city.goal.x, city.goal.y)).toBe(0);
        expect(city.walls.length).toBeGreaterThan(cols * rows * 0.05);
        expect(city.walls.length).toBeLessThan(cols * rows * 0.4);
        expect(city.wind.length).toBeGreaterThan(0);
        const r = new AStar(g).plan(city.start.x, city.start.y, city.goal.x, city.goal.y);
        expect(r.found, `seed ${seed}`).toBe(true);
      }
    });
  }
  it('is deterministic for a seed', () => {
    expect(buildCity(40, 24, 3)).toEqual(buildCity(40, 24, 3));
    expect(buildCity(40, 24, 3)).not.toEqual(buildCity(40, 24, 4));
  });
});

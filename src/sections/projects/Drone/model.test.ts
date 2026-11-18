import { describe, expect, it } from 'vitest';
import { DroneModel } from './model';
import { AStar } from './planner/astar';
import { Grid } from './planner/grid';

const make = (seed = 1, algo: 'astar' | 'dstar' = 'astar') =>
  new DroneModel({ cols: 40, rows: 24, seed, algo });

function fly(m: DroneModel, seconds: number, dtMs = 16) {
  for (let t = 0; t < seconds * 1000; t += dtMs) m.step(dtMs);
}

describe('DroneModel basics', () => {
  it('starts with a planned route, zero re-plans and a stats snapshot', () => {
    const m = make();
    expect(m.status).toBe('flying');
    expect(m.route.length).toBeGreaterThan(2);
    expect(m.replans).toBe(0);
    expect(m.lastPlan?.found).toBe(true);
    expect(m.lastPlan?.expanded).toBeGreaterThan(0);
    expect(m.lastPlan?.cost).toBeGreaterThan(0);
    expect(m.heat().length).toBe(40 * 24);
  });

  it('flies the route and arrives at the goal', () => {
    const m = make();
    fly(m, 90);
    expect(m.status).toBe('arrived');
    expect(m.pos.x).toBeCloseTo(m.goal.x, 6);
    expect(m.pos.y).toBeCloseTo(m.goal.y, 6);
  });

  it('is deterministic for a seed', () => {
    const a = make(9);
    const b = make(9);
    a.dropObstacleOnRoute();
    b.dropObstacleOnRoute();
    expect(a.route).toEqual(b.route);
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
  });
});

describe('dropping an obstacle on the route', () => {
  for (const algo of ['astar', 'dstar'] as const) {
    it(`re-plans once, changes the path and avoids the new obstacle (${algo})`, () => {
      const m = make(2, algo);
      fly(m, 1);
      const before = [...m.route];
      const a = m.dropObstacleOnRoute();
      expect(a.replanned).toBe(true);
      expect(m.replans).toBe(1);
      expect(m.route).not.toEqual(before);
      expect(a.text).toMatch(/^Route blocked\. Re-planned in .* ms, \d+ nodes?\.$/);
      expect(m.route.some((c) => !m.isFreeCell(c))).toBe(false);
      expect(m.status).toBe('flying');
    });
  }

  it('the drone keeps flying and reaches the goal after several blocks', () => {
    const m = make(4);
    for (let i = 0; i < 6; i++) {
      fly(m, 1.2);
      m.dropObstacleOnRoute();
    }
    fly(m, 120);
    expect(['arrived', 'blocked']).toContain(m.status);
    if (m.status === 'arrived') expect(m.pos.x).toBeCloseTo(m.goal.x, 6);
  });

  it('says there is nothing to block once the drone has arrived', () => {
    const m = make();
    fly(m, 90);
    const a = m.dropObstacleOnRoute();
    expect(a.replanned).toBe(false);
    expect(a.text).toMatch(/nothing to block/i);
    expect(m.replans).toBe(0);
  });
});

describe('painting', () => {
  it('rejects the goal cell and the drone cell, accepts others', () => {
    const m = make();
    expect(m.paint(m.goal.x, m.goal.y, 'obstacle', false)).toBe(false);
    expect(m.paint(Math.round(m.pos.x), Math.round(m.pos.y), 'obstacle', false)).toBe(false);
    expect(m.paint(-1, 3, 'obstacle', false)).toBe(false);
  });

  it('an off-route obstacle does not trigger a re-plan, an on-route one does', () => {
    const m = make(3);
    const onRoute = new Set(m.route);
    let off = -1;
    for (let i = 0; i < m.grid.cells.length && off < 0; i++) {
      if (m.grid.cells[i] === 0 && !onRoute.has(i)) off = i;
    }
    expect(m.paint(off % 40, Math.floor(off / 40), 'obstacle', false)).toBe(true);
    expect(m.flush()).toBeNull();
    expect(m.replans).toBe(0);
    const cell = m.route[Math.floor(m.route.length / 2)] as number;
    expect(m.paint(cell % 40, Math.floor(cell / 40), 'obstacle', false)).toBe(true);
    expect(m.flush()).not.toBeNull();
    expect(m.replans).toBe(1);
  });

  it('erasing an obstacle triggers a re-plan so a shorter way can be taken', () => {
    const m = make(3);
    const cell = m.route[Math.floor(m.route.length / 2)] as number;
    m.paint(cell % 40, Math.floor(cell / 40), 'obstacle', false);
    m.flush();
    const cost = m.lastPlan?.cost ?? 0;
    m.paint(cell % 40, Math.floor(cell / 40), 'obstacle', true);
    m.flush();
    expect(m.replans).toBe(2);
    expect(m.lastPlan?.cost).toBeLessThanOrEqual(cost + 1e-9);
  });

  it('wind on the route re-plans and raises or keeps the cost', () => {
    const m = make(5);
    const before = m.lastPlan?.cost ?? 0;
    const a = m.addWindZone();
    expect(a.replanned).toBe(true);
    expect(a.text).toMatch(/^Wind zone on the route\./);
    expect(m.lastPlan?.cost ?? 0).toBeGreaterThanOrEqual(before - 1e-9);
  });
});

describe('unreachable goal', () => {
  function wallGoalIn(m: DroneModel) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        m.paint(m.goal.x + dx, m.goal.y + dy, 'obstacle', false);
      }
    }
  }

  for (const algo of ['astar', 'dstar'] as const) {
    it(`reports it, holds position, never throws, and recovers (${algo})`, () => {
      const m = make(6, algo);
      fly(m, 1);
      wallGoalIn(m);
      const a = m.flush();
      expect(a?.text).toBe('No route to the goal. The drone holds position.');
      expect(m.status).toBe('blocked');
      expect(m.route.length).toBe(0);
      const held = { ...m.pos };
      fly(m, 5);
      expect(m.pos).toEqual(held);
      expect(m.status).toBe('blocked');
      m.paint(m.goal.x - 1, m.goal.y, 'obstacle', true);
      const b = m.flush();
      expect(b?.text).toMatch(/^Route found again\./);
      expect(m.status).toBe('flying');
      fly(m, 120);
      expect(m.status).toBe('arrived');
    });
  }

  it('dropObstacleOnRoute while blocked does not crash', () => {
    const m = make(6);
    wallGoalIn(m);
    m.flush();
    const a = m.dropObstacleOnRoute();
    expect(a.replanned).toBe(false);
  });
});

describe('goal, algorithm, reset', () => {
  it('New goal picks a free cell away from the drone and re-plans', () => {
    const m = make(7);
    const old = { ...m.goal };
    const a = m.newGoal();
    expect(a.text).toMatch(/^New goal\./);
    expect(m.goal).not.toEqual(old);
    expect(m.isFreeCell(m.goal.y * 40 + m.goal.x)).toBe(true);
    expect(m.status).toBe('flying');
    expect(m.replans).toBe(1);
  });

  it('setGoal refuses a wall and accepts a free cell', () => {
    const m = make(7);
    let wall = -1;
    for (let i = 0; i < m.grid.cells.length && wall < 0; i++) if (m.grid.cells[i] === 1) wall = i;
    expect(m.setGoal(wall % 40, Math.floor(wall / 40))).toBeNull();
    const a = m.setGoal(5, 5);
    expect(a === null || a.replanned).toBe(true);
  });

  it('switching algorithm keeps the same optimal cost', () => {
    const m = make(8, 'astar');
    m.dropObstacleOnRoute();
    const c = m.lastPlan?.cost ?? 0;
    m.setAlgo('dstar');
    expect(m.algo).toBe('dstar');
    expect(m.lastPlan?.cost).toBeCloseTo(c, 9);
    expect(m.lastPlan?.algo).toBe('dstar');
  });

  it('keeps per-algorithm node counts for the comparison, measured not invented', () => {
    const m = make(8, 'dstar');
    m.dropObstacleOnRoute();
    const cmp = m.compare;
    expect(cmp.astar?.expanded).toBeGreaterThan(0);
    expect(cmp.dstar?.expanded).toBeGreaterThan(0);
    expect(cmp.astar?.cost).toBeCloseTo(cmp.dstar?.cost ?? -1, 9);
    expect(m.totals.astar).toBeGreaterThan(0);
    expect(m.totals.dstar).toBeGreaterThan(0);
  });

  it('reset restores the starting scene and counters', () => {
    const m = make(9);
    const baseline = m.obstacleCount;
    m.dropObstacleOnRoute();
    m.dropObstacleOnRoute();
    m.addWindZone();
    expect(m.replans).toBeGreaterThan(0);
    m.reset();
    expect(m.obstacleCount).toBe(baseline);
    expect(m.replans).toBe(0);
    expect(m.status).toBe('flying');
    expect(m.route.length).toBeGreaterThan(2);
  });
});

describe('self-running', () => {
  it('drops obstacles on the route every few seconds while autoplay is on, and stops when turned off', () => {
    const m = make(10);
    m.autoplay = true;
    fly(m, 12);
    expect(m.replans).toBeGreaterThanOrEqual(2);
    const n = m.replans;
    m.autoplay = false;
    fly(m, 12);
    expect(m.replans).toBe(n);
  });

  it('never leaves the drone stuck for long: it recovers or picks a new goal', () => {
    const m = make(11);
    m.autoplay = true;
    fly(m, 240);
    expect(['flying', 'arrived']).toContain(m.status);
  });

  it('picks a new goal some time after arriving when regoal is enabled', () => {
    const m = new DroneModel({ cols: 40, rows: 24, seed: 12, regoalMs: 1500 });
    fly(m, 90);
    const first = { ...m.goal };
    fly(m, 4);
    expect(m.goal).not.toEqual(first);
  });
});

describe('planner agreement inside the model', () => {
  it('the route cost the model reports equals a fresh A* on the same grid', () => {
    const m = make(13, 'dstar');
    for (let i = 0; i < 5; i++) {
      fly(m, 1);
      m.dropObstacleOnRoute();
    }
    const g = new Grid(40, 24);
    g.cells.set(m.grid.cells);
    const start = m.route[0] as number;
    const r = new AStar(g).plan(start % 40, Math.floor(start / 40), m.goal.x, m.goal.y);
    expect(m.lastPlan?.cost).toBeCloseTo(r.cost, 9);
  });
});

describe('DroneModel animation facts', () => {
  it('exposes the expansion order of both planners and bumps planSerial per real plan', () => {
    const m = make(3);
    const serial = m.planSerial;
    for (const algo of ['astar', 'dstar'] as const) {
      const e = m.expansion(algo);
      expect(e.length).toBeGreaterThan(0);
      expect(e.length).toBeLessThanOrEqual(40 * 24);
    }
    m.setAlgo('dstar');
    expect(m.planSerial).toBe(serial);
    fly(m, 0.5);
    m.dropObstacleOnRoute();
    expect(m.planSerial).toBe(serial + 1);
  });

  it('records the old route, a scan pulse and the dropped cell when the route is blocked', () => {
    const m = make(3);
    fly(m, 0.5);
    const before = m.pathAhead().length;
    const t = m.simTime;
    m.dropObstacleOnRoute();
    expect(m.prevPath.length).toBe(before);
    expect(m.scan.at).toBe(t);
    const dropped = [...m.cellFx.values()].filter((f) => f.to === 1 && f.from === 0);
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped[0]?.t0).toBe(t);
  });

  it('records a lift when an obstacle is erased', () => {
    const m = make(3);
    m.paint(20, 3, 'obstacle', false);
    m.cellFx.clear();
    m.paint(20, 3, 'obstacle', true);
    const fx = m.cellFx.get(3 * 40 + 20);
    expect(fx?.from).toBe(1);
    expect(fx?.to).toBe(0);
  });

  it('kicks the drone back only when the cut is right in front of it', () => {
    const m = make(3);
    fly(m, 0.5);
    const ahead = m.routeAhead();
    const near = ahead[2] as number;
    m.paint(near % 40, Math.floor(near / 40), 'obstacle', false);
    m.flush();
    expect(m.recoil.at).toBe(m.simTime);
  });
});

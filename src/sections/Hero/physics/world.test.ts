import { describe, expect, it } from 'vitest';
import { buildCatalogue } from '../logic/catalogue';
import { computeBounds, fitRig, type Region } from '../logic/camera';
import { layoutName } from '../logic/nameLayout';
import { planSpawns } from '../logic/spawn';
import { PhysicsWorld } from './world';

const region: Region = { x0: -0.37, x1: 0.98, y0: -0.95, y1: 0.72 };
const NAME_Z = -0.5;

function setup(seed: number) {
  const specs = buildCatalogue('desktop');
  const name = layoutName(1.5);
  const rig = fitRig({
    aspect: 16 / 9,
    region,
    worldWidth: 15,
    elevationDeg: 30,
    fovDeg: 28,
    targetZ: -1,
  });
  const bounds = computeBounds(rig, region, NAME_Z - name.keepOut.maxZ + name.keepOut.minZ + 0.2);
  const keepOut = {
    minX: name.keepOut.minX,
    maxX: name.keepOut.maxX,
    minZ: NAME_Z + name.keepOut.minZ,
    maxZ: NAME_Z + name.keepOut.maxZ,
  };
  const world = new PhysicsWorld(bounds, name.colliders, NAME_Z);
  const plans = planSpawns(specs, bounds, keepOut, seed);
  return { specs, name, bounds, world, plans };
}

/** Runs `seconds` of simulated time, spawning bodies when their delay passes. */
function run(s: ReturnType<typeof setup>, seconds: number) {
  const pending = [...s.plans].sort((a, b) => a.delayMs - b.delayMs);
  const steps = Math.round(seconds / s.world.step);
  for (let i = 0; i < steps; i++) {
    const t = i * s.world.step * 1000;
    while (pending.length && pending[0]!.delayMs <= t) {
      const p = pending.shift()!;
      s.world.spawn(
        s.specs.find((x) => x.id === p.id)!,
        p,
      );
    }
    s.world.stepOnce();
  }
}

describe('hero physics', () => {
  it('drops everything in, keeps it inside the walls and lets it fall asleep', () => {
    const s = setup(7);
    run(s, 9);
    const states = s.world.snapshot();
    expect(states).toHaveLength(s.specs.length);
    for (const b of states) {
      expect(b.pos.x).toBeGreaterThan(s.bounds.minX - 0.05);
      expect(b.pos.x).toBeLessThan(s.bounds.maxX + 0.05);
      expect(b.pos.z).toBeLessThan(s.bounds.maxZ + 0.05);
      expect(b.pos.z).toBeGreaterThan(s.bounds.minZ - 0.05);
      expect(b.pos.y).toBeGreaterThan(0.1);
      expect(b.pos.y).toBeLessThan(5);
    }
    expect(s.world.allAsleep()).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = setup(11);
    const b = setup(11);
    run(a, 3);
    run(b, 3);
    expect(a.world.snapshot()).toEqual(b.world.snapshot());
  });

  it('bounces a body thrown at the name and never moves the name', () => {
    const s = setup(3);
    run(s, 9);
    const before = s.world.nameSnapshot();
    const key = s.specs.find((x) => x.id === 'key-react')!;
    // From above the settled pile (the floor is crowded now), aimed down onto the lettering.
    s.world.throwBody(key.id, { x: 0, y: 3, z: 3 }, { x: 0, y: -8, z: -18 });
    let minZ = Infinity;
    for (let i = 0; i < 360; i++) {
      s.world.stepOnce();
      minZ = Math.min(minZ, s.world.get(key.id)!.pos.z);
    }
    expect(minZ).toBeGreaterThan(NAME_Z + 0.4);
    expect(s.world.get(key.id)!.vel.z).toBeGreaterThan(-3);
    expect(s.world.nameSnapshot()).toEqual(before);
  });

  it('survives a huge frame gap without exploding', () => {
    const s = setup(5);
    run(s, 2);
    for (let i = 0; i < 400; i++) s.world.stepOnce();
    for (const b of s.world.snapshot()) {
      expect(Number.isFinite(b.pos.x + b.pos.y + b.pos.z)).toBe(true);
      expect(Math.hypot(b.vel.x, b.vel.y, b.vel.z)).toBeLessThan(40);
    }
  });

  it('clamps launch speed so thrown bodies cannot tunnel', () => {
    const s = setup(5);
    run(s, 9);
    s.world.throwBody('dial', { x: 0, y: 1, z: 3 }, { x: 0, y: 0, z: -900 });
    expect(Math.hypot(...Object.values(s.world.get('dial')!.vel))).toBeLessThanOrEqual(24.01);
  });

  it('respawns a body at a new plan and wakes it', () => {
    const s = setup(5);
    run(s, 9);
    const p = s.plans[0]!;
    s.world.respawn(p.id, { ...p, x: 0, y: 4, z: 2 });
    expect(s.world.get(p.id)!.asleep).toBe(false);
    expect(s.world.get(p.id)!.pos.y).toBeCloseTo(4, 5);
  });

  it('counts real impacts on the name, once per impact, and nothing else', () => {
    const s = setup(3);
    const seen: string[] = [];
    s.world.onNameHit = (id) => seen.push(id);
    run(s, 9);
    const settled = s.world.nameHits;
    expect(s.world.nameHits).toBe(seen.length);
    // At rest nothing is counted.
    for (let i = 0; i < 240; i++) s.world.stepOnce();
    expect(s.world.nameHits).toBe(settled);
    // A hard throw at the lettering from above the pile counts as one hit (not one per letter touched).
    const key = s.specs.find((x) => x.id === 'key-react')!;
    s.world.throwBody(key.id, { x: 0, y: 3, z: 3 }, { x: 0, y: -8, z: -18 });
    for (let i = 0; i < 90; i++) s.world.stepOnce();
    expect(s.world.nameHits).toBeGreaterThan(settled);
    expect(seen[seen.length - 1]).toBe('key-react');
    const after = s.world.nameHits;
    // Resting contact does not keep adding hits.
    for (let i = 0; i < 480; i++) s.world.stepOnce();
    expect(s.world.nameHits - after).toBeLessThanOrEqual(3);
  });

  it('gives the project pieces real collision shapes that fall asleep inside the walls', () => {
    const s = setup(11);
    run(s, 9);
    for (const id of ['phone', 'drone', 'lens']) {
      const b = s.world.get(id)!;
      expect(b, id).toBeDefined();
      expect(b.asleep, id).toBe(true);
      expect(b.pos.y).toBeGreaterThan(0.05);
    }
  });

  it('gives a planned body its start velocity', () => {
    const s = setup(5);
    const p = { ...s.plans[0]!, vz: 2 };
    s.world.spawn(s.specs.find((x) => x.id === p.id)!, p);
    expect(s.world.get(p.id)!.vel.z).toBeCloseTo(2, 5);
  });
});

import { describe, expect, it } from 'vitest';
import { buildCatalogue } from '../logic/catalogue';
import { computeStage } from '../logic/stage';
import { footprintRadius, planSpawns } from '../logic/spawn';
import { PhysicsWorld } from './world';

const NAME_Z = 0;

function setup(seed: number, bp: 'desktop' | 'mobile' = 'desktop') {
  const specs = buildCatalogue(bp);
  const stage =
    bp === 'desktop'
      ? computeStage({
          canvas: { width: 1440, height: 900 },
          text: { right: 540, bottom: 540 },
          windowWidth: 1440,
        })
      : computeStage({
          canvas: { width: 390, height: 844 },
          text: { right: 360, bottom: 300 },
          windowWidth: 390,
        });
  const name = stage.layout;
  const bounds = stage.bounds;
  const world = new PhysicsWorld(bounds, name.colliders, NAME_Z);
  const plans = planSpawns(specs, bounds, name.keepOut, seed);
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
    const key = s.specs.find((x) => x.id === 'token-react')!;
    // From above the settled pile (the floor is crowded now), aimed down onto the lettering.
    s.world.throwBody(key.id, { x: 0, y: 3, z: 3 }, { x: 0, y: -8, z: -18 });
    let minZ = Infinity;
    for (let i = 0; i < 360; i++) {
      s.world.stepOnce();
      minZ = Math.min(minZ, s.world.get(key.id)!.pos.z);
    }
    expect(minZ).toBeGreaterThan(NAME_Z + 0.2);
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
    s.world.throwBody('token-react', { x: 0, y: 1, z: 3 }, { x: 0, y: 0, z: -900 });
    expect(Math.hypot(...Object.values(s.world.get('token-react')!.vel))).toBeLessThanOrEqual(
      24.01,
    );
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
    const key = s.specs.find((x) => x.id === 'token-react')!;
    s.world.throwBody(key.id, { x: 0, y: 3, z: 3 }, { x: 0, y: -8, z: -18 });
    for (let i = 0; i < 90; i++) s.world.stepOnce();
    expect(s.world.nameHits).toBeGreaterThan(settled);
    expect(seen[seen.length - 1]).toBe('token-react');
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

  it('puts slow, nearly settled bodies to sleep on demand but never a fast one', () => {
    const s = setup(7);
    run(s, 9);
    s.world.wakeAll();
    expect(s.world.allAsleep()).toBe(false);
    s.world.restSlow(1.2);
    expect(s.world.allAsleep()).toBe(true);
    const first = s.world.snapshot()[0]!.id;
    s.world.wakeAll();
    s.world.throwBody(first, s.world.get(first)!.pos, { x: 0, y: 0, z: -20 });
    s.world.restSlow(1.2);
    expect(s.world.get(first)!.asleep).toBe(false);
  });

  it('gives a planned body its start velocity', () => {
    const s = setup(5);
    const p = { ...s.plans[0]!, vz: 2 };
    s.world.spawn(
      s.specs.find((x) => x.id === p.id)!,
      p,
    );
    expect(s.world.get(p.id)!.vel.z).toBeCloseTo(2, 5);
  });
});

/** Planar distance between two resting bodies minus their footprint radii (negative: they overlap). */
function gaps(s: ReturnType<typeof setup>) {
  const st = s.world.snapshot();
  const r = new Map(s.specs.map((x) => [x.id, footprintRadius(x)]));
  const out: number[] = [];
  for (let i = 0; i < st.length; i++)
    for (let j = i + 1; j < st.length; j++) {
      const a = st[i]!;
      const b = st[j]!;
      out.push(Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) - r.get(a.id)! - r.get(b.id)!);
    }
  return out;
}

describe('hero physics: a loose scatter, not a heap', () => {
  it('lands the drop spread out: nothing stacked, almost nothing touching', () => {
    for (const seed of [7, 11, 20260]) {
      const s = setup(seed);
      run(s, 9);
      expect(s.world.allAsleep(), `seed ${seed} asleep`).toBe(true);
      const states = s.world.snapshot();
      const thick = Math.max(...s.specs.map((x) => x.size.h));
      // Nothing rests on top of another piece (a keycap is at most 0.45 thick, a drone 0.4 tall).
      const stacked = states.filter((b) => b.pos.y > thick * 1.1);
      expect(stacked.length, `stacked (seed ${seed})`).toBeLessThanOrEqual(2);
      const g = gaps(s);
      const touching = g.filter((x) => x < 0).length;
      expect(touching, `overlapping footprints (seed ${seed})`).toBeLessThanOrEqual(
        Math.ceil(states.length * 0.12),
      );
    }
  });

  it('keeps every body clear of the name after the drop', () => {
    const s = setup(7);
    run(s, 9);
    const k = s.name.keepOut;
    for (const b of s.world.snapshot()) {
      const r = footprintRadius(s.specs.find((x) => x.id === b.id)!);
      expect(b.pos.z - r * 0.8, b.id).toBeGreaterThan(k.maxZ - 0.35);
    }
  });

  it('settles into a loose scatter again after a hard throw into the crowd', () => {
    const s = setup(7);
    run(s, 9);
    const first = s.specs.find((x) => x.id === 'token-kotlin')!;
    for (let k = 0; k < 4; k++) {
      s.world.throwBody(first.id, { x: -4 + k, y: 1.2, z: 4.5 }, { x: 5, y: 1, z: -8 });
      for (let i = 0; i < 120 * 8; i++) s.world.stepOnce();
    }
    expect(s.world.allAsleep()).toBe(true);
    const states = s.world.snapshot();
    const thick = Math.max(...s.specs.map((x) => x.size.h));
    expect(states.filter((b) => b.pos.y > thick * 1.1).length).toBeLessThanOrEqual(3);
    for (const b of states) {
      expect(b.pos.x).toBeGreaterThan(s.bounds.minX - 0.05);
      expect(b.pos.x).toBeLessThan(s.bounds.maxX + 0.05);
    }
  });

  it('is stable on the narrow mobile floor too', () => {
    const s = setup(7, 'mobile');
    run(s, 9);
    expect(s.world.allAsleep()).toBe(true);
    const thick = Math.max(...s.specs.map((x) => x.size.h));
    expect(s.world.snapshot().filter((b) => b.pos.y > thick * 1.1).length).toBeLessThanOrEqual(2);
  });
});

import {
  Body,
  Box,
  ContactEquation,
  ConvexPolyhedron,
  ContactMaterial,
  GSSolver,
  Material,
  SAPBroadphase,
  Quaternion,
  Vec3 as CVec3,
  World,
} from 'cannon-es';
import type { Bounds, Vec3 } from '../logic/camera';
import type { ObjectSpec } from '../logic/catalogue';
import { clampVec, springAccel } from '../logic/drag';
import { regularPolygon, SHIELD_OUTLINE, tokenFootprint } from '../logic/token';
import type { Box as BoxDef } from '../logic/nameLayout';
import type { SpawnPlan } from '../logic/spawn';

/** Snapshot of one body, as plain numbers. */
export interface BodyState {
  id: string;
  pos: Vec3;
  quat: { x: number; y: number; z: number; w: number };
  vel: Vec3;
  asleep: boolean;
}

/** Fastest a body may move; with a 1/120 s step this keeps travel per step far below any wall thickness. */
export const MAX_SPEED = 24;
const GRAVITY = -24;
/** An impact counts as a hit on the name above this speed (m/s along the contact normal) ... */
const HIT_SPEED = 1.6;
/** ... and a body is counted at most once per this many simulated seconds. */
const HIT_COOLDOWN = 0.35;

/** Tuning of the grab spring (see report): stiff enough to feel attached, soft enough to swing. */
const GRAB_K = 220;
const GRAB_C = 26;
const GRAB_MAX_ACCEL = 900;

interface Grab {
  id: string;
  local: CVec3;
  target: Vec3;
}

/**
 * Rigid-body world for the hero (cannon-es). Fixed step, walls and floor from the bounds, the name
 * as static colliders that never move, and dynamic bodies per catalogue spec. DOM-free.
 */
export class PhysicsWorld {
  /** Seconds per physics step. */
  readonly step = 1 / 120;
  private readonly world: World;
  private readonly thing = new Material('thing');
  private readonly solid = new Material('solid');
  private readonly monument = new Material('monument');
  private readonly bodies = new Map<string, Body>();
  private readonly idOf = new Map<Body, string>();
  private readonly specs = new Map<string, ObjectSpec>();
  private readonly prev = new Map<string, { p: CVec3; q: Quaternion }>();
  private readonly nameBodies: Body[] = [];
  private walls: Body[] = [];
  private grab: Grab | null = null;
  private time = 0;
  private readonly lastHit = new Map<string, number>();
  /** Real impacts on the name so far (an impact: a body meeting the lettering at speed, once per body per 0.35 s). */
  nameHits = 0;
  /** Called with the body id on every counted hit on the name. */
  onNameHit: ((id: string) => void) | null = null;

  constructor(
    private bounds: Bounds,
    nameColliders: BoxDef[],
    nameZ: number,
  ) {
    this.world = new World({ gravity: new CVec3(0, GRAVITY, 0) });
    this.world.broadphase = new SAPBroadphase(this.world);
    this.world.allowSleep = true;
    (this.world.solver as GSSolver).iterations = 14;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    this.world.addContactMaterial(
      new ContactMaterial(this.thing, this.thing, { friction: 0.2, restitution: 0.3 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.thing, this.solid, { friction: 0.3, restitution: 0.3 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.thing, this.monument, { friction: 0.25, restitution: 0.45 }),
    );
    this.buildWalls();
    for (const b of nameColliders) {
      const body = new Body({ mass: 0, type: Body.STATIC, material: this.monument });
      body.addShape(new Box(new CVec3(b.hx, b.hy, b.hz)));
      body.position.set(b.cx, b.cy, b.cz + nameZ);
      this.world.addBody(body);
      this.nameBodies.push(body);
      body.addEventListener('collide', (e: { body: Body; contact: ContactEquation }) =>
        this.hit(e),
      );
    }
  }

  private hit(e: { body: Body; contact: ContactEquation }): void {
    const id = this.idOf.get(e.body);
    if (!id) return;
    if (Math.abs(e.contact.getImpactVelocityAlongNormal()) < HIT_SPEED) return;
    const last = this.lastHit.get(id);
    if (last !== undefined && this.time - last < HIT_COOLDOWN) return;
    this.lastHit.set(id, this.time);
    this.nameHits += 1;
    this.onNameHit?.(id);
  }

  private buildWalls(): void {
    for (const w of this.walls) this.world.removeBody(w);
    const b = this.bounds;
    const t = 2;
    const mk = (hx: number, hy: number, hz: number, x: number, y: number, z: number) => {
      const body = new Body({ mass: 0, type: Body.STATIC, material: this.solid });
      body.addShape(new Box(new CVec3(hx, hy, hz)));
      body.position.set(x, y, z);
      this.world.addBody(body);
      return body;
    };
    const midX = (b.minX + b.maxX) / 2;
    const midZ = (b.minZ + b.maxZ) / 2;
    this.walls = [
      mk(60, t, 60, midX, -t, midZ),
      mk(t, 30, 60, b.minX - t, 30, midZ),
      mk(t, 30, 60, b.maxX + t, 30, midZ),
      mk(60, 30, t, midX, 30, b.maxZ + t),
      mk(60, 30, t, midX, 30, b.minZ - t),
      // Well above any spawn height (spawns may sit above `bounds.height` in a crowded plan).
      mk(60, t, 60, midX, b.height + 10 + t, midZ),
    ];
  }

  /** Moves the walls (viewport resized). Bodies outside the new bounds are pushed back in. */
  setBounds(bounds: Bounds): void {
    this.bounds = bounds;
    this.buildWalls();
    for (const [id, body] of this.bodies) {
      const r = this.specs.get(id)!.radius;
      const x = Math.min(Math.max(body.position.x, bounds.minX + r), bounds.maxX - r);
      const z = Math.min(Math.max(body.position.z, bounds.minZ + r), bounds.maxZ - r);
      if (x !== body.position.x || z !== body.position.z) {
        body.position.x = x;
        body.position.z = z;
        body.wakeUp();
      }
    }
  }

  private shapes(body: Body, spec: ObjectSpec): void {
    const { w, h, d } = spec.size;
    const add = (hx: number, hy: number, hz: number, y = 0, rotY = 0) => {
      const q = new Quaternion();
      q.setFromEuler(0, rotY, 0);
      body.addShape(new Box(new CVec3(hx, hy, hz)), new CVec3(0, y, 0), q);
    };
    const addAt = (hx: number, hy: number, hz: number, x: number, y: number, z: number) =>
      body.addShape(new Box(new CVec3(hx, hy, hz)), new CVec3(x, y, z));
    const prism = (poly: ReadonlyArray<[number, number]>, y = 0, thick = h, x = 0, z = 0) =>
      body.addShape(convexPrism(poly, thick), new CVec3(x, y, z));
    switch (spec.kind) {
      case 'token': {
        // The die-cut silhouette's convex outline, extruded: a chunky pin that slides and tumbles.
        prism(tokenFootprint(spec.mark!, Math.max(w, d)).hull);
        break;
      }
      case 'shield':
        prism(SHIELD_OUTLINE.map(([x, z]) => [x * (w / 2), z * (d / 2)]));
        break;
      case 'logo':
        // A round token: a regular polygon prism that rolls a little and settles flat.
        prism(regularPolygon(18, w / 2));
        break;
      case 'drone': {
        // Hub, two crossed arms and four rotor guards: stays a sturdy compound when it lands on its side.
        const s = w / 1.9;
        add(0.4 * s, h / 2, 0.4 * s);
        const arm = w / 2 - 0.22 * s;
        add(arm, 0.07 * s, 0.08 * s, 0, Math.PI / 4);
        add(arm, 0.07 * s, 0.08 * s, 0, -Math.PI / 4);
        const o = (w / 2 - 0.33 * s) * 0.7071;
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            // Rotor guards sit below the hub's top, and skids reach the ground: upright is the stable pose.
            addAt(0.33 * s, 0.05 * s, 0.33 * s, sx * o, h / 2 - 0.2 * s, sz * o);
            addAt(0.1 * s, 0.1 * s, 0.1 * s, sx * o, -h / 2 + 0.1 * s, sz * o);
          }
        break;
      }
      case 'lens': {
        // A magnifier: a ring at the upper left and a handle running down to the lower right.
        const u = w / 1.82;
        const ring = 0.62 * u;
        const c = -0.28 * u;
        prism(regularPolygon(14, ring), 0, h, c, c);
        const from = ring - 0.04 * u;
        const to = 1.55 * u;
        const q = new Quaternion();
        q.setFromEuler(0, -Math.PI / 4, 0);
        const mid = c + ((from + to) / 2) * 0.7071;
        body.addShape(
          new Box(new CVec3((to - from) / 2, h * 0.4, 0.1 * u)),
          new CVec3(mid, 0, mid),
          q,
        );
        break;
      }
      default:
        add(w / 2, h / 2, d / 2);
    }
  }

  private place(body: Body, plan: SpawnPlan): void {
    body.position.set(plan.x, plan.y, plan.z);
    body.quaternion.setFromEuler(plan.rx, plan.ry, plan.rz, 'YXZ');
    body.velocity.set(0, 0, plan.vz ?? 0);
    body.angularVelocity.set(0, 0, 0);
    body.previousPosition.copy(body.position);
    this.toppleSteps.delete(this.idOf.get(body) ?? '');
    body.wakeUp();
  }

  /** Adds a body for `spec` at the planned spot. Replaces an existing body with the same id. */
  spawn(spec: ObjectSpec, plan: SpawnPlan): void {
    if (this.bodies.has(spec.id)) {
      this.respawn(spec.id, plan);
      return;
    }
    const body = new Body({
      mass: spec.mass,
      material: this.thing,
      linearDamping: 0.1,
      angularDamping: 0.32,
      allowSleep: true,
      sleepSpeedLimit: 0.3,
      sleepTimeLimit: 0.5,
    });
    this.shapes(body, spec);
    this.place(body, plan);
    this.world.addBody(body);
    this.bodies.set(spec.id, body);
    this.idOf.set(body, spec.id);
    this.specs.set(spec.id, spec);
    this.prev.set(spec.id, { p: body.position.clone(), q: body.quaternion.clone() });
  }

  /** Puts an existing body at a new plan and wakes it (the reset re-drop). */
  respawn(id: string, plan: SpawnPlan): void {
    const body = this.bodies.get(id);
    if (!body) return;
    if (this.grab?.id === id) this.grab = null;
    this.place(body, plan);
    const p = this.prev.get(id);
    p?.p.copy(body.position);
    p?.q.copy(body.quaternion);
  }

  /** Teleports a body and gives it a velocity (clamped). Used by tests and by the throw. */
  throwBody(id: string, pos: Vec3, vel: Vec3): void {
    this.toppleSteps.delete(id);
    const body = this.bodies.get(id);
    if (!body) return;
    body.position.set(pos.x, pos.y, pos.z);
    const v = clampVec(vel, MAX_SPEED);
    body.velocity.set(v.x, v.y, v.z);
    body.wakeUp();
  }

  /** Applies an impulse at an offset from the centre (click pokes, keyboard pushes, idle nudges). */
  impulse(id: string, impulse: Vec3, offset: Vec3 = { x: 0, y: 0, z: 0 }): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.wakeUp();
    body.applyImpulse(
      new CVec3(impulse.x, impulse.y, impulse.z),
      new CVec3(offset.x, offset.y, offset.z),
    );
  }

  /** Starts holding a body at a world point (on its surface). */
  beginGrab(id: string, worldPoint: Vec3): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.wakeUp();
    body.angularDamping = 0.85;
    const local = body.pointToLocalFrame(new CVec3(worldPoint.x, worldPoint.y, worldPoint.z));
    this.grab = { id, local, target: worldPoint };
  }

  /** Moves the spring's anchor (the pointer, projected on the drag plane). */
  updateGrab(target: Vec3): void {
    if (this.grab) this.grab.target = target;
  }

  /** The id being held, if any. */
  get grabbedId(): string | null {
    return this.grab?.id ?? null;
  }

  /** Lets go. `velocity` (the estimated pointer velocity) becomes the body's velocity: the throw. */
  endGrab(velocity?: Vec3): void {
    const g = this.grab;
    if (!g) return;
    const body = this.bodies.get(g.id);
    this.grab = null;
    if (!body) return;
    body.angularDamping = 0.32;
    if (velocity) {
      const v = clampVec(velocity, MAX_SPEED);
      body.velocity.set(v.x, v.y, v.z);
    }
    body.wakeUp();
  }

  /** Advances one fixed step. */
  stepOnce(): void {
    for (const [id, body] of this.bodies) {
      const p = this.prev.get(id)!;
      p.p.copy(body.position);
      p.q.copy(body.quaternion);
    }
    if (this.grab) this.applyGrab(this.grab);
    this.topple();
    this.world.step(this.step);
    this.time += this.step;
    for (const body of this.bodies.values()) {
      const v = body.velocity;
      const s = v.length();
      if (s > MAX_SPEED) v.scale(MAX_SPEED / s, v);
      if (!Number.isFinite(body.position.x + body.position.y + body.position.z)) {
        body.position.set(0, 3, 2);
        body.velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * A thin piece balanced on its edge is an unstable equilibrium that a solver with friction can hold
   * forever. Real pieces fall over; nudge slow, upright flat pieces toward lying down.
   */
  private readonly toppleSteps = new Map<string, number>();

  private topple(): void {
    for (const [id, body] of this.bodies) {
      if (this.grab?.id === id) continue;
      const kind = this.specs.get(id)?.kind;
      if (!kind) continue;
      if (body.velocity.length() > 0.8 || body.angularVelocity.length() > 2) continue;
      const q = body.quaternion;
      const ux = 2 * (q.x * q.y - q.z * q.w);
      const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
      const uz = 2 * (q.y * q.z + q.x * q.w);
      const sided = kind !== 'token' && kind !== 'logo';
      if (body.position.y > 1.2 || (uy > 0.96 && uy <= 1) || (uy < -0.96 && !sided)) continue;
      // A piece jammed against its neighbours gets a few seconds of help, then is left to sleep.
      const used = this.toppleSteps.get(id) ?? 0;
      if (used > 480) continue;
      this.toppleSteps.set(id, used + 1);
      if (body.sleepState === Body.SLEEPING) body.wakeUp();
      // Anything with a printed or lit top (all but the double-sided tokens) is nudged face up; tokens take the nearer flat side.
      const sy = sided || uy >= 0 ? 1 : -1;
      // up x (sy * worldY): the axis that rotates the plate's normal toward vertical.
      // Stronger the closer to upright, where the ground's restitution would otherwise bounce it back.
      const k = body.mass * (2.2 + 8 * Math.max(0, 1 - Math.abs(uy) / 0.25));
      if (sided && uy < -0.7) {
        // Upside down is balanced too: kick it over so the printed side faces up.
        if (body.angularVelocity.length() < 0.5) body.angularVelocity.x += 6;
        continue;
      }
      body.torque.x += (uy * 0 - uz * sy) * k;
      body.torque.z += (ux * sy - 0) * k;
    }
  }

  private applyGrab(g: Grab): void {
    const body = this.bodies.get(g.id);
    if (!body) return;
    const wp = body.pointToWorldFrame(g.local);
    const a = springAccel(
      { x: g.target.x - wp.x, y: g.target.y - wp.y, z: g.target.z - wp.z },
      { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z },
      GRAB_K,
      GRAB_C,
      GRAB_MAX_ACCEL,
    );
    // Cancel gravity while held so the body hangs from the pointer instead of sagging.
    const f = new CVec3(a.x * body.mass, (a.y - GRAVITY) * body.mass, a.z * body.mass);
    body.wakeUp();
    body.applyForce(f, wp.vsub(body.position));
  }

  /** Current state of one body, or undefined. */
  get(id: string): BodyState | undefined {
    const b = this.bodies.get(id);
    return b && this.state(id, b);
  }

  private state(id: string, b: Body): BodyState {
    return {
      id,
      pos: { x: b.position.x, y: b.position.y, z: b.position.z },
      quat: { x: b.quaternion.x, y: b.quaternion.y, z: b.quaternion.z, w: b.quaternion.w },
      vel: { x: b.velocity.x, y: b.velocity.y, z: b.velocity.z },
      asleep: b.sleepState === Body.SLEEPING,
    };
  }

  /** All dynamic bodies. */
  snapshot(): BodyState[] {
    return [...this.bodies].map(([id, b]) => this.state(id, b));
  }

  /** Position and rotation of every name collider; must never change. */
  nameSnapshot(): number[][] {
    return this.nameBodies.map((b) => [
      b.position.x,
      b.position.y,
      b.position.z,
      b.quaternion.x,
      b.quaternion.y,
      b.quaternion.z,
      b.quaternion.w,
    ]);
  }

  /** Position and rotation blended between the last two steps, for smooth rendering at any refresh rate. */
  interpolated(id: string, alpha: number): { pos: Vec3; quat: BodyState['quat'] } | undefined {
    const b = this.bodies.get(id);
    const p = this.prev.get(id);
    if (!b || !p) return undefined;
    const pos = {
      x: p.p.x + (b.position.x - p.p.x) * alpha,
      y: p.p.y + (b.position.y - p.p.y) * alpha,
      z: p.p.z + (b.position.z - p.p.z) * alpha,
    };
    const q = new Quaternion();
    p.q.slerp(b.quaternion, alpha, q);
    return { pos, quat: { x: q.x, y: q.y, z: q.z, w: q.w } };
  }

  /** True when every body is asleep (the scene has settled). */
  allAsleep(): boolean {
    for (const b of this.bodies.values()) if (b.sleepState !== Body.SLEEPING) return false;
    return this.bodies.size > 0;
  }

  /**
   * Puts bodies that are nearly at rest to sleep now (speed under `maxSpeed`). Floating-point
   * differences between machines can leave one body jittering just above the sleep limit; this is
   * how a pre-settled scene is guaranteed to end fully asleep on every platform.
   */
  restSlow(maxSpeed: number): void {
    for (const b of this.bodies.values()) {
      if (b.sleepState === Body.SLEEPING) continue;
      if (b.velocity.length() < maxSpeed && b.angularVelocity.length() < maxSpeed * 2) {
        b.velocity.setZero();
        b.angularVelocity.setZero();
        b.sleep();
      }
    }
  }

  /** Ids of all dynamic bodies. */
  ids(): string[] {
    return [...this.bodies.keys()];
  }

  /** Wakes everything (shuffle, resize). */
  wakeAll(): void {
    for (const b of this.bodies.values()) b.wakeUp();
  }
}

/** A convex prism (outline in x, z; thickness along y) centred on the origin, with CCW faces for cannon. */
export function convexPrism(
  poly: ReadonlyArray<[number, number]>,
  thick: number,
): ConvexPolyhedron {
  const n = poly.length;
  const verts: CVec3[] = [];
  for (const [x, z] of poly) verts.push(new CVec3(x, thick / 2, z));
  for (const [x, z] of poly) verts.push(new CVec3(x, -thick / 2, z));
  const faces: number[][] = [
    Array.from({ length: n }, (_, i) => i),
    Array.from({ length: n }, (_, i) => n + i),
  ];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
  // Wind every face counter-clockwise seen from outside (the solid is centred on the origin).
  for (const f of faces) {
    const [a, b, c] = [verts[f[0]!]!, verts[f[1]!]!, verts[f[2]!]!];
    const nrm = b.vsub(a).cross(c.vsub(b));
    const centre = new CVec3();
    for (const i of f) centre.vadd(verts[i]!, centre);
    centre.scale(1 / f.length, centre);
    if (nrm.dot(centre) < 0) f.reverse();
  }
  return new ConvexPolyhedron({ vertices: verts, faces });
}

import {
  Body,
  Box,
  ContactMaterial,
  Material,
  SAPBroadphase,
  Quaternion,
  Vec3 as CVec3,
  World,
} from 'cannon-es';
import type { Bounds, Vec3 } from '../logic/camera';
import type { ObjectSpec } from '../logic/catalogue';
import { clampVec, springAccel } from '../logic/drag';
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
  private readonly specs = new Map<string, ObjectSpec>();
  private readonly prev = new Map<string, { p: CVec3; q: Quaternion }>();
  private readonly nameBodies: Body[] = [];
  private walls: Body[] = [];
  private grab: Grab | null = null;

  constructor(
    private bounds: Bounds,
    nameColliders: BoxDef[],
    nameZ: number,
  ) {
    this.world = new World({ gravity: new CVec3(0, GRAVITY, 0) });
    this.world.broadphase = new SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 14;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    this.world.addContactMaterial(
      new ContactMaterial(this.thing, this.thing, { friction: 0.38, restitution: 0.22 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.thing, this.solid, { friction: 0.5, restitution: 0.28 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.thing, this.monument, { friction: 0.3, restitution: 0.42 }),
    );
    this.buildWalls();
    for (const b of nameColliders) {
      const body = new Body({ mass: 0, type: Body.STATIC, material: this.monument });
      body.addShape(new Box(new CVec3(b.hx, b.hy, b.hz)));
      body.position.set(b.cx, b.cy, b.cz + nameZ);
      this.world.addBody(body);
      this.nameBodies.push(body);
    }
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
      mk(60, t, 60, midX, b.height + t, midZ),
    ];
  }

  /** Moves the walls (viewport resized). Bodies outside the new bounds are pushed back in. */
  setBounds(bounds: Bounds): void {
    this.bounds = bounds;
    this.buildWalls();
    for (const [id, body] of this.bodies) {
      const r = Math.hypot(this.specs.get(id)!.size.w, this.specs.get(id)!.size.d) / 2;
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
    switch (spec.kind) {
      case 'dial': {
        const a = w / 2 / 1.0824;
        add(a, h / 2, a);
        add(a, h / 2, a, 0, Math.PI / 4);
        break;
      }
      case 'toggle':
        add(w / 2, 0.25, d / 2, -h / 2 + 0.25);
        add(0.2, (h - 0.5) / 2, 0.2, -h / 2 + 0.5 + (h - 0.5) / 2);
        break;
      case 'lock':
        add(w / 2, 0.25, d / 2, -h / 2 + 0.25);
        add(w / 2 - 0.3, (h - 0.5) / 2, 0.12, -h / 2 + 0.5 + (h - 0.5) / 2);
        break;
      default:
        add(w / 2, h / 2, d / 2);
    }
  }

  private place(body: Body, plan: SpawnPlan): void {
    body.position.set(plan.x, plan.y, plan.z);
    body.quaternion.setFromEuler(plan.rx, plan.ry, plan.rz, 'YXZ');
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.previousPosition.copy(body.position);
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
    this.world.step(this.step);
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

  /** Ids of all dynamic bodies. */
  ids(): string[] {
    return [...this.bodies.keys()];
  }

  /** Wakes everything (shuffle, resize). */
  wakeAll(): void {
    for (const b of this.bodies.values()) b.wakeUp();
  }
}

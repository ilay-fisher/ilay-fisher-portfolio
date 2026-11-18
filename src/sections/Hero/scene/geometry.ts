import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  SphereGeometry,
  Shape,
  ShapePath,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ObjectSpec } from '../logic/catalogue';
import type { PlacedGlyph } from '../logic/nameLayout';

/** Materials the builders need; created by `materials.ts`. */
export interface MaterialSet {
  body: MeshPhysicalMaterial;
  /** Key top with the printed legend (keys only). */
  top?: MeshPhysicalMaterial;
  metal: MeshPhysicalMaterial;
  polished: MeshPhysicalMaterial;
  accent: MeshPhysicalMaterial;
  /** Dark glossy glass for the phone screen and the lens. */
  glass: MeshPhysicalMaterial;
}

/** A built object: the visual group (centred on the body origin) and the materials that react to hover. */
export interface BuiltObject {
  group: Group;
  hoverMaterials: MeshPhysicalMaterial[];
}

const mesh = (g: BufferGeometry, m: Material | Material[]) => {
  const x = new Mesh(g, m);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
};

/** Keycap: bevelled block whose top is a little narrower than its base, legend on the top face. */
function buildKey(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const g = new RoundedBoxGeometry(w, h, d, 6, 0.13);
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const k = 1 - 0.1 * (pos.getY(i) / h + 0.5);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  pos.needsUpdate = true;
  const side = m.body;
  const group = new Group();
  group.add(mesh(g, [side, side, m.top ?? side, side, side, side]));
  return group;
}

/** Dial: turned alloy cylinder with a knurled edge, a shallow dished top and an accent pointer. */
function buildDial(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const r = w / 2;
  const t = h / 2;
  const prof: Vector2[] = [new Vector2(0, -t)];
  const arc = (cx: number, cy: number, a0: number, a1: number, rad: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      prof.push(new Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
    }
  };
  arc(r - 0.1, -t + 0.1, -Math.PI / 2, 0, 0.1);
  arc(r - 0.07, t - 0.07, 0, Math.PI / 2, 0.07);
  prof.push(new Vector2(r * 0.8, t), new Vector2(r * 0.72, t - 0.03), new Vector2(0, t - 0.06));
  const lathe = new LatheGeometry(prof, 120);
  const p = lathe.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const rad = Math.hypot(x, z);
    if (Math.abs(p.getY(i)) < t - 0.12 && rad > r - 0.03) {
      const k = (rad + 0.022 * Math.cos(Math.atan2(z, x) * 30)) / rad;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  lathe.computeVertexNormals();
  const group = new Group();
  group.add(mesh(lathe, m.metal));
  const pointer = mesh(new RoundedBoxGeometry(0.1, 0.05, 0.4, 3, 0.02), m.accent);
  pointer.position.set(0, t - 0.035, -r * 0.5);
  group.add(pointer);
  return group;
}

/** Toggle: anodised base plate, polished collar, brushed lever with an accent tip. */
function buildToggle(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const group = new Group();
  const base = mesh(new RoundedBoxGeometry(w, 0.5, d, 5, 0.14), m.body);
  base.position.y = -h / 2 + 0.25;
  group.add(base);
  const collar = mesh(new CylinderGeometry(0.26, 0.3, 0.12, 40), m.polished);
  collar.position.y = -h / 2 + 0.56;
  group.add(collar);
  const lever = new Group();
  lever.position.set(0, -h / 2 + 0.6, 0);
  lever.rotation.z = 0.22;
  const rod = mesh(new CylinderGeometry(0.1, 0.15, 0.55, 32), m.metal);
  rod.position.y = 0.27;
  const tip = mesh(new SphereGeometry(0.17, 32, 20), m.accent);
  tip.position.y = 0.58;
  lever.add(rod, tip);
  group.add(lever);
  return group;
}

const shieldShape = (w: number, d: number): Shape => {
  const s = new Shape();
  const hw = w / 2;
  const hd = d / 2;
  s.moveTo(-hw, hd);
  s.lineTo(hw, hd);
  s.lineTo(hw, -hd * 0.1);
  s.bezierCurveTo(hw, -hd * 0.62, hw * 0.4, -hd * 0.88, 0, -hd);
  s.bezierCurveTo(-hw * 0.4, -hd * 0.88, -hw, -hd * 0.62, -hw, -hd * 0.1);
  s.lineTo(-hw, hd);
  return s;
};

/** Shield block: a thick bevelled shield with a raised accent inset, lying flat. */
function buildShield(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const group = new Group();
  const opts = (depth: number, bevel: number) => ({
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 5,
    curveSegments: 28,
  });
  const body = new ExtrudeGeometry(shieldShape(w - 0.14, d - 0.14), opts(h - 0.14, 0.07));
  body.rotateX(-Math.PI / 2);
  body.translate(0, -h / 2 + 0.07, 0);
  group.add(mesh(body, m.body));
  const inset = new ExtrudeGeometry(shieldShape(w * 0.52, d * 0.52), opts(0.03, 0.03));
  inset.rotateX(-Math.PI / 2);
  inset.translate(0, h / 2 - 0.02, d * 0.02);
  group.add(mesh(inset, m.accent));
  return group;
}

/** Lock block: machined body, polished shackle arc, small key slot. */
function buildLock(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const group = new Group();
  const body = mesh(new RoundedBoxGeometry(w, 0.5, d, 5, 0.12), m.body);
  body.position.y = -h / 2 + 0.25;
  group.add(body);
  const R = 0.27;
  const arc = mesh(new TorusGeometry(R, 0.075, 18, 40, Math.PI), m.polished);
  arc.position.y = -h / 2 + 0.5 + 0.12;
  group.add(arc);
  for (const sx of [-1, 1]) {
    const leg = mesh(new CylinderGeometry(0.075, 0.075, 0.12, 18), m.polished);
    leg.position.set(sx * R, -h / 2 + 0.5 + 0.06, 0);
    group.add(leg);
  }
  const slot = mesh(new RoundedBoxGeometry(0.08, 0.04, 0.26, 2, 0.015), m.accent);
  slot.position.set(0, -h / 2 + 0.5, d * 0.28);
  group.add(slot);
  return group;
}

/** Phone slab: anodised body, black glass screen set into the top, a small lens at one end. */
function buildPhone(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const group = new Group();
  group.add(mesh(new RoundedBoxGeometry(w, h, d, 5, 0.1), m.body));
  const screen = mesh(new RoundedBoxGeometry(w - 0.14, 0.03, d - 0.22, 3, 0.012), m.glass);
  screen.position.set(0, h / 2 - 0.004, 0.02);
  group.add(screen);
  const cam = mesh(new CylinderGeometry(0.045, 0.05, 0.03, 24), m.polished);
  cam.position.set(0, h / 2 + 0.002, -d / 2 + 0.11);
  group.add(cam);
  const bar = mesh(new RoundedBoxGeometry(0.26, 0.012, 0.03, 2, 0.006), m.accent);
  bar.position.set(0, h / 2 + 0.012, d / 2 - 0.15);
  group.add(bar);
  return group;
}

/** Quadcopter: hub, crossed arms, four motors with ringed rotors; the colliders in the physics world match. */
function buildDrone(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const group = new Group();
  const hub = mesh(new RoundedBoxGeometry(0.72, h * 0.8, 0.72, 4, 0.14), m.body);
  group.add(hub);
  const reach = w / 2 - 0.2;
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = mesh(new RoundedBoxGeometry(reach * 2, 0.12, 0.14, 3, 0.045), m.metal);
    arm.rotation.y = a;
    group.add(arm);
  }
  const o = (w / 2 - 0.3) * 0.7071;
  const y = h / 2 - 0.05;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const motor = mesh(new CylinderGeometry(0.1, 0.12, 0.16, 28), m.polished);
      motor.position.set(sx * o, y - 0.02, sz * o);
      group.add(motor);
      const ring = mesh(new TorusGeometry(0.27, 0.03, 12, 40), m.metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(sx * o, y, sz * o);
      group.add(ring);
      const blade = mesh(new RoundedBoxGeometry(0.5, 0.014, 0.07, 2, 0.006), m.body);
      blade.position.set(sx * o, y + 0.07, sz * o);
      blade.rotation.y = sx * sz * 0.6;
      group.add(blade);
    }
  const led = mesh(new SphereGeometry(0.06, 20, 12), m.accent);
  led.position.set(0, 0.02, -0.38);
  group.add(led);
  return group;
}

/** Lens: polished ring with a glass disc, and a handle; centred on its bounding box like the colliders. */
function buildLens(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, d, h } = spec.size;
  const group = new Group();
  const r = Math.min(w, d) / 2;
  const zr = -d / 2 + r;
  const ring = mesh(new TorusGeometry(r - 0.1, 0.1, 18, 56), m.polished);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0, zr);
  group.add(ring);
  const glass = mesh(new CylinderGeometry(r - 0.1, r - 0.1, 0.05, 56), m.glass);
  glass.position.set(0, 0, zr);
  group.add(glass);
  const hl = d - 2 * r + 0.12;
  const handle = mesh(new CylinderGeometry(0.085, 0.1, hl, 28), m.body);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, d / 2 - hl / 2);
  group.add(handle);
  const collar = mesh(new CylinderGeometry(0.115, 0.115, 0.1, 28), m.accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0, zr + r + 0.02);
  group.add(collar);
  const cap = mesh(new SphereGeometry(0.1, 20, 14), m.metal);
  cap.position.set(0, 0, d / 2 - 0.02);
  group.add(cap);
  void h;
  return group;
}

/** Builds the visual for one catalogue object. */
export function buildObject(spec: ObjectSpec, m: MaterialSet): BuiltObject {
  const group =
    spec.kind === 'key'
      ? buildKey(spec, m)
      : spec.kind === 'dial'
        ? buildDial(spec, m)
        : spec.kind === 'toggle'
          ? buildToggle(spec, m)
          : spec.kind === 'shield'
            ? buildShield(spec, m)
            : spec.kind === 'lock'
              ? buildLock(spec, m)
              : spec.kind === 'phone'
                ? buildPhone(spec, m)
                : spec.kind === 'drone'
                  ? buildDrone(spec, m)
                  : buildLens(spec, m);
  const hoverMaterials = [m.body, m.top, m.metal, m.polished].filter(
    (x): x is MeshPhysicalMaterial => Boolean(x),
  );
  return { group, hoverMaterials };
}

/** Parses the generated glyph path (absolute M, L, Q, C, Z in em units) into extrudable shapes. */
export function glyphShapes(d: string): Shape[] {
  const sp = new ShapePath();
  const re = /([MLQCZ])([^MLQCZ]*)/g;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    const n = m[2]!.trim().split(/\s+/).filter(Boolean).map(Number) as number[];
    switch (m[1]) {
      case 'M':
        sp.moveTo(n[0]!, n[1]!);
        break;
      case 'L':
        sp.lineTo(n[0]!, n[1]!);
        break;
      case 'Q':
        sp.quadraticCurveTo(n[0]!, n[1]!, n[2]!, n[3]!);
        break;
      case 'C':
        sp.bezierCurveTo(n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!);
        break;
      default:
    }
  }
  return sp.toShapes(false);
}

/** One letter of the name as a heavy, bevelled extrusion, positioned in world space. */
export function buildLetter(g: PlacedGlyph, material: Material): Mesh {
  // Rounded bevels that stay inside the outline (negative offset), so the letterforms keep their
  // true width and counters while the edges catch the light.
  const bevel = 0.042;
  const depthEm = g.depth / g.scale;
  const geo = new ExtrudeGeometry(glyphShapes(g.d), {
    depth: depthEm - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelThickness: bevel,
    bevelSegments: 8,
    curveSegments: 14,
  });
  geo.translate(0, 0, -depthEm / 2 + bevel);
  const m = mesh(geo, material);
  m.scale.setScalar(g.scale);
  m.position.set(g.ox, g.oy, 0);
  return m;
}

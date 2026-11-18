import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  Path,
  SphereGeometry,
  Shape,
  ShapePath,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { ObjectSpec } from '../logic/catalogue';
import type { PlacedGlyph } from '../logic/nameLayout';
import { SHIELD_OUTLINE, tokenFootprint } from '../logic/token';
import { MARKS } from './marks';
import { TOKEN_SHAPES } from './tokenData';

/** Materials the builders need; created by `materials.ts`. */
export interface MaterialSet {
  body: MeshPhysicalMaterial;
  /** Key top with the printed legend (keys only). */
  top?: MeshPhysicalMaterial;
  metal: MeshPhysicalMaterial;
  polished: MeshPhysicalMaterial;
  accent: MeshPhysicalMaterial;
  /** Dark glossy glass (camera pod, keyhole, fallback). */
  glass: MeshPhysicalMaterial;
  /** Thin metal rim of a die-cut token or shield (the plate's side and bevel). */
  rim?: MeshPhysicalMaterial;
  /** Raised mark on a token, in white or near-black, whichever reads on the brand colour. */
  ink?: MeshPhysicalMaterial;
  /** Brass of the padlock body. */
  brass?: MeshPhysicalMaterial;
  /** The SafeSurf logo printed on both faces of its token. */
  logo?: MeshPhysicalMaterial;
  /** Magnifier glass showing a tiny circuit. */
  circuit?: MeshPhysicalMaterial;
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

/** Closed loop smoothed by corner cutting, so a traced outline reads as a rounded die cut. */
function chaikin(pts: ReadonlyArray<[number, number]>, rounds: number): Array<[number, number]> {
  let p = pts.map(([x, y]) => [x, y] as [number, number]);
  for (let r = 0; r < rounds; r++) {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const b = p[(i + 1) % p.length]!;
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

/**
 * Extrudes outlines (x, z on the floor, +z toward the camera) into a plate lying flat: thickness `h` centred
 * on y = 0, rounded edges. The sides (rim and edge bevel) take the second material.
 */
function plateGeometry(loops: Array<Array<[number, number]>>, h: number, bevel: number) {
  const shapes = loops.map((l) => new Shape(l.map(([x, z]) => new Vector2(x, -z))));
  const g = new ExtrudeGeometry(shapes, {
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: true,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelThickness: bevel,
    bevelSegments: 4,
    curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2 + bevel, 0);
  return g;
}

/** Raised flat shapes (the mark, a check) sitting on the plate top. */
function inlayGeometry(shapes: Shape[], height: number, bevel: number) {
  const g = new ExtrudeGeometry(shapes, {
    depth: height - bevel,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** The official mark as shapes in plate coordinates: centred on the plate, scaled, y down becomes +z. */
function markShapes(slug: string, unit: number): Shape[] {
  const mark = MARKS[slug];
  const t = TOKEN_SHAPES[slug];
  if (!mark || !t) return [];
  const data = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${mark.path}"/></svg>`,
  );
  const out: Shape[] = [];
  const tx = (v: Vector2) => new Vector2((v.x - t.cx) * unit, -(v.y - t.cy) * unit);
  for (const p of data.paths)
    for (const sh of SVGLoader.createShapes(p)) {
      const { shape, holes } = sh.extractPoints(6);
      const s = new Shape(shape.map(tx));
      s.holes = holes.map((hole) => new Path(hole.map(tx)));
      out.push(s);
    }
  return out;
}

/** Keycap: bevelled block whose top is a little narrower than its base, legend on the top face. */
function buildKey(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const g = new RoundedBoxGeometry(w, h, d, 6, Math.min(w, d) * 0.14);
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

/**
 * Die-cut token: the logo's silhouette (grown by a thin margin) extruded into a chunky, rounded plate in the
 * brand colour, a thin metal rim, and the official mark raised on top. Like an enamel pin.
 */
function buildToken(spec: ObjectSpec, m: MaterialSet): Group {
  const { h } = spec.size;
  const slug = spec.mark!;
  const t = TOKEN_SHAPES[slug]!;
  const unit = tokenFootprint(slug, Math.max(spec.size.w, spec.size.d)).unit;
  const loops = t.cut.map((flat) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < flat.length; i += 2) pts.push([flat[i]! * unit, flat[i + 1]! * unit]);
    return chaikin(pts, 2);
  });
  const group = new Group();
  const plate = mesh(plateGeometry(loops, h, h * 0.3), [m.body, m.rim ?? m.metal]);
  group.add(plate);
  const raise = h * 0.2;
  const mk = mesh(inlayGeometry(markShapes(slug, unit), raise, raise * 0.35), m.ink ?? m.polished);
  mk.position.y = h / 2 - 0.002;
  group.add(mk);
  // Double sided, like a real pin: the same mark on the back.
  const back = mk.clone();
  back.position.y = -(h / 2 - 0.002);
  back.rotation.x = Math.PI;
  group.add(back);
  return group;
}

/** Shield: a die-cut shield in SafeSurf blue with a raised check, the SafeGuard promise. */
function buildShield(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h, d } = spec.size;
  const group = new Group();
  const loop = chaikin(
    SHIELD_OUTLINE.map(([x, z]) => [x * (w / 2) * 0.97, z * (d / 2) * 0.97] as [number, number]),
    3,
  );
  group.add(mesh(plateGeometry([loop], h, h * 0.3), [m.body, m.rim ?? m.metal]));
  // Raised inner shield rim and a check mark.
  const inner = chaikin(
    SHIELD_OUTLINE.map(
      ([x, z]) => [x * (w / 2) * 0.66, z * (d / 2) * 0.66 + d * 0.01] as [number, number],
    ),
    3,
  );
  const innerShape = new Shape(inner.map(([x, z]) => new Vector2(x, -z)));
  const hole = new Path(
    chaikin(
      SHIELD_OUTLINE.map(
        ([x, z]) => [x * (w / 2) * 0.56, z * (d / 2) * 0.56 + d * 0.01] as [number, number],
      ),
      3,
    )
      .reverse()
      .map(([x, z]) => new Vector2(x, -z)),
  );
  innerShape.holes = [hole];
  const k = Math.min(w, d) / 2;
  const tick = new Shape(
    (
      [
        [-0.42, 0.02],
        [-0.26, -0.14],
        [-0.08, 0.06],
        [0.3, -0.38],
        [0.46, -0.22],
        [-0.08, 0.4],
      ] as const
    ).map(([x, z]) => new Vector2(x * k * 0.95, -(z * k * 0.95 + d * 0.02))),
  );
  const raise = h * 0.18;
  const inlay = mesh(inlayGeometry([innerShape, tick], raise, raise * 0.3), m.ink ?? m.polished);
  inlay.position.y = h / 2 - 0.002;
  group.add(inlay);
  return group;
}

/**
 * SafeSurf logo token: a round, double-sided enamel disc with the owner's own logo printed on both faces
 * (the logo is a raster file, so it is a decal on a disc rather than a cut-out silhouette).
 */
function buildLogo(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const R = w / 2;
  const group = new Group();
  const disc = new CylinderGeometry(R, R, h, 48, 1);
  group.add(mesh(disc, [m.rim ?? m.metal, m.body, m.body]));
  const decal = new CircleGeometry(R * 0.9, 48);
  decal.rotateX(-Math.PI / 2);
  for (const side of [1, -1]) {
    const face = new Mesh(decal, m.logo ?? m.glass);
    face.position.y = side * (h / 2 + 0.0015);
    if (side < 0) face.rotation.x = Math.PI;
    face.receiveShadow = true;
    group.add(face);
  }
  return group;
}

/** Quadcopter: a body with a camera pod, four diagonal arms, motors and ringed rotors. */
function buildDrone(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const s = w / 1.9;
  const group = new Group();
  const hub = mesh(new RoundedBoxGeometry(0.78 * s, h * 0.8, 0.78 * s, 4, 0.16 * s), m.body);
  group.add(hub);
  const reach = w / 2 - 0.22 * s;
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = mesh(new RoundedBoxGeometry(reach * 2, 0.13 * s, 0.15 * s, 3, 0.05 * s), m.metal);
    arm.rotation.y = a;
    group.add(arm);
  }
  const o = (w / 2 - 0.33 * s) * 0.7071;
  const y = h / 2 - 0.2 * s;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const foot = mesh(new CylinderGeometry(0.07 * s, 0.1 * s, 0.2 * s, 18), m.body);
      foot.position.set(sx * o, -h / 2 + 0.1 * s, sz * o);
      group.add(foot);
      const motor = mesh(new CylinderGeometry(0.11 * s, 0.13 * s, 0.18 * s, 28), m.polished);
      motor.position.set(sx * o, y - 0.02 * s, sz * o);
      group.add(motor);
      const ring = mesh(new TorusGeometry(0.3 * s, 0.035 * s, 12, 40), m.metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(sx * o, y, sz * o);
      group.add(ring);
      for (const a of [0.55, 0.55 + Math.PI / 2]) {
        const blade = mesh(
          new RoundedBoxGeometry(0.54 * s, 0.014 * s, 0.075 * s, 2, 0.006),
          m.accent,
        );
        blade.position.set(sx * o, y + 0.08 * s, sz * o);
        blade.rotation.y = a;
        group.add(blade);
      }
    }
  // Camera pod at the front (toward the viewer) and a status light at the back.
  const pod = mesh(new SphereGeometry(0.17 * s, 24, 16), m.glass);
  pod.position.set(0, -0.02 * s, 0.4 * s);
  group.add(pod);
  const led = mesh(new SphereGeometry(0.06 * s, 20, 12), m.accent);
  led.position.set(0, h * 0.4, -0.3 * s);
  group.add(led);
  return group;
}

/** Magnifier: a brass ring around a glass disc that shows a tiny circuit, with a handle running to the lower right. */
function buildLens(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const u = w / 1.82;
  const ring = 0.62 * u;
  const c = -0.28 * u;
  const group = new Group();
  const tube = Math.min(h * 0.5, ring * 0.22);
  const rim = mesh(new TorusGeometry(ring - tube, tube, 18, 56), m.polished);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(c, 0, c);
  group.add(rim);
  const glass = mesh(
    new CylinderGeometry(ring - tube, ring - tube, h * 0.35, 56),
    m.circuit ?? m.glass,
  );
  glass.position.set(c, 0, c);
  group.add(glass);
  const from = ring - 0.04 * u;
  const to = 1.55 * u;
  const mid = c + ((from + to) / 2) * 0.7071;
  const arm = new Group();
  arm.position.set(mid, 0, mid);
  arm.rotation.y = Math.PI / 4;
  const grip = mesh(new CylinderGeometry(0.095 * u, 0.12 * u, to - from, 28), m.body);
  grip.rotation.x = Math.PI / 2;
  arm.add(grip);
  const collar = mesh(new CylinderGeometry(0.13 * u, 0.13 * u, 0.12 * u, 28), m.accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = -(to - from) / 2 + 0.03 * u;
  arm.add(collar);
  const cap = mesh(new SphereGeometry(0.12 * u, 20, 14), m.metal);
  cap.position.z = (to - from) / 2;
  arm.add(cap);
  group.add(arm);
  return group;
}

/** Builds the visual for one catalogue object. */
export function buildObject(spec: ObjectSpec, m: MaterialSet): BuiltObject {
  const group =
    spec.kind === 'key'
      ? buildKey(spec, m)
      : spec.kind === 'token'
        ? buildToken(spec, m)
        : spec.kind === 'shield'
          ? buildShield(spec, m)
          : spec.kind === 'logo'
            ? buildLogo(spec, m)
            : spec.kind === 'drone'
              ? buildDrone(spec, m)
              : buildLens(spec, m);
  const hoverMaterials = [m.body, m.top, m.metal, m.polished, m.brass, m.ink, m.rim, m.logo].filter(
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

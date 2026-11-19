import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
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
import {
  GOLD_STOPS,
  ICON_FACE_CORNER,
  ICON_SHIELD,
  ICON_TILES,
  ICON_TILE_RADIUS,
  ICON_TILE_SIZE,
  ICON_VIEW,
  TILE_STOPS,
  faceToIcon,
  goldAt,
  iconToFace,
  tileAt,
} from '../logic/safeguardIcon';
import {
  BADGE_CORNER,
  DISC_PLATE_RADIUS,
  FILLED_TOKENS,
  roundedSquareOutline,
  tokenFootprint,
} from '../logic/token';
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
  /** Raised blue tiles of the SafeGuard icon (per-vertex gradient colour). */
  iconBlue?: MeshPhysicalMaterial;
  /** Raised gold shield of the SafeGuard icon (per-vertex gradient colour). */
  iconGold?: MeshPhysicalMaterial;
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
  // Finer curve sampling on the filled disc: the octocat's ears and tail are what the piece is recognised by.
  const divisions = FILLED_TOKENS.has(slug) ? 20 : 6;
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
      const { shape, holes } = sh.extractPoints(divisions);
      const s = new Shape(shape.map(tx));
      s.holes = holes.map((hole) => new Path(hole.map(tx)));
      out.push(s);
    }
  return out;
}

/**
 * The letters of a logo that is a tile with its glyph cut out (TypeScript's "TS", LinkedIn's "in"): the holes of
 * the official path, in tile coordinates. The tile is the mark's own 24 x 24 box, centred, `unit` world units per
 * mark unit, y down becomes +z. The artwork is not altered, only read: its outer tile is the badge's plate and
 * its holes are the raised letters.
 */
export function badgeGlyphShapes(slug: string, unit: number): Shape[] {
  const mark = MARKS[slug];
  if (!mark) return [];
  const data = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${mark.path}"/></svg>`,
  );
  const tx = (v: Vector2) => new Vector2((v.x - 12) * unit, -(v.y - 12) * unit);
  const out: Shape[] = [];
  for (const p of data.paths)
    for (const sh of SVGLoader.createShapes(p)) {
      const { holes } = sh.extractPoints(8);
      for (const hole of holes) out.push(new Shape(hole.map(tx)));
    }
  return out;
}

/**
 * Logo badge (TypeScript, LinkedIn): the official mark is a rounded tile in the brand colour with its letters
 * cut out in white. Built as a bevelled tile in the brand colour with a metal rim and the letters raised in white
 * ceramic on both faces. Not a keycap: the object is the logo's own shape.
 */
function buildBadge(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const half = w / 2;
  const group = new Group();
  const loop = roundedSquareOutline(BADGE_CORNER, 9).map(
    ([x, z]) => [x * half, z * half] as [number, number],
  );
  group.add(mesh(plateGeometry([loop], h, h * 0.22), [m.body, m.rim ?? m.metal]));
  const raise = Math.min(0.04, h * 0.2);
  const letters = mesh(
    inlayGeometry(badgeGlyphShapes(spec.mark!, w / 24), raise, raise * 0.35),
    m.ink ?? m.polished,
  );
  letters.position.y = h / 2 - 0.002;
  group.add(letters);
  // Double sided, like the tokens: the same letters on the back.
  const back = letters.clone();
  back.position.y = -(h / 2 - 0.002);
  back.rotation.x = Math.PI;
  group.add(back);
  return group;
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

/** A circle of radius `r` on the floor plane as a plate outline. */
function discLoop(r: number): Array<[number, number]> {
  const n = 72;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
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
  const loops = FILLED_TOKENS.has(slug)
    ? [discLoop(DISC_PLATE_RADIUS * unit)]
    : t.cut.map((flat) => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < flat.length; i += 2) pts.push([flat[i]! * unit, flat[i + 1]! * unit]);
        return chaikin(pts, 2);
      });
  const group = new Group();
  const plate = mesh(plateGeometry(loops, h, h * 0.3), [m.body, m.rim ?? m.metal]);
  group.add(plate);
  // A filled disc is raised higher: the cut-out is a real recess whose wall throws a shadow line.
  const raise = h * (FILLED_TOKENS.has(slug) ? 0.4 : 0.2);
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

/** Rounded rectangle on the floor plane as an extrudable shape (y of the shape is -z), corners as arcs. */
function roundedRectShape(cx: number, cz: number, hw: number, hd: number, r: number): Shape {
  const s = new Shape();
  const x0 = cx - hw;
  const x1 = cx + hw;
  const y0 = -(cz + hd);
  const y1 = -(cz - hd);
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Paints a geometry's vertices with a two-stop gradient chosen by position on the face (linear sRGB blend). */
function paintGradient(
  g: BufferGeometry,
  stops: readonly [string, string],
  at: (x: number, z: number) => number,
) {
  const a = new Color(stops[0]);
  const b = new Color(stops[1]);
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, at(pos.getX(i), pos.getZ(i)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
}

/**
 * SafeGuard piece: the app's real launcher icon ("Guarded Grid") as hardware. A bevelled ceramic tile with a
 * metal rim carries the three blue tiles and the gold shield as raised, bevelled inlays in the icon's exact
 * colours and proportions, on both faces. Not a decal: the art is geometry, so it catches the one light.
 */
function buildShield(spec: ObjectSpec, m: MaterialSet): Group {
  const { w, h } = spec.size;
  const half = w / 2;
  // World units per artwork unit; the face is ICON_VIEW artwork units across.
  const k = w / ICON_VIEW;
  const group = new Group();
  const loop = roundedSquareOutline(ICON_FACE_CORNER, 9).map(
    ([x, z]) => [x * half, z * half] as [number, number],
  );
  group.add(mesh(plateGeometry([loop], h, h * 0.2), [m.body, m.rim ?? m.metal]));

  const raise = Math.min(0.034, h * 0.16);
  const bevel = raise * 0.38;
  const tileShapes = ICON_TILES.map((t) => {
    const c = iconToFace(t.x + ICON_TILE_SIZE / 2, t.y + ICON_TILE_SIZE / 2);
    const hw = (ICON_TILE_SIZE / 2) * (iconToFace(1, 0).x - iconToFace(0, 0).x) * k;
    return roundedRectShape(
      c.x * k,
      c.z * k,
      hw,
      hw,
      ICON_TILE_RADIUS * (iconToFace(1, 0).x - iconToFace(0, 0).x) * k,
    );
  });
  const tiles = inlayGeometry(tileShapes, raise, bevel);
  paintGradient(tiles, TILE_STOPS, (x, z) => {
    const p = faceToIcon(x / k, z / k);
    return tileAt(p.u, p.v);
  });

  const sh = new Shape();
  for (const seg of ICON_SHIELD.path) {
    const p = (q: [number, number]) => {
      const f = iconToFace(q[0], q[1]);
      return new Vector2(f.x * k, -f.z * k);
    };
    if (seg.op === 'C') {
      const [c1, c2, to] = [p(seg.c1), p(seg.c2), p(seg.to)];
      sh.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
    } else {
      const to = p(seg.to);
      if (seg.op === 'M') sh.moveTo(to.x, to.y);
      else sh.lineTo(to.x, to.y);
    }
  }
  const shield = inlayGeometry([sh], raise * 1.15, bevel);
  paintGradient(shield, GOLD_STOPS, (x, z) => goldAt(faceToIcon(x / k, z / k).v));

  const front = new Group();
  front.add(mesh(tiles, m.iconBlue ?? m.accent), mesh(shield, m.iconGold ?? m.brass ?? m.accent));
  front.position.y = h / 2 - 0.002;
  group.add(front);
  // Double sided, like the logo piece: the same art on the back, so it never lands as a blank tile.
  const back = front.clone();
  back.position.y = -(h / 2 - 0.002);
  back.rotation.x = Math.PI;
  group.add(back);
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
        : spec.kind === 'badge'
          ? buildBadge(spec, m)
          : spec.kind === 'shield'
            ? buildShield(spec, m)
            : spec.kind === 'logo'
              ? buildLogo(spec, m)
              : spec.kind === 'drone'
                ? buildDrone(spec, m)
                : buildLens(spec, m);
  const hoverMaterials = [
    m.body,
    m.top,
    m.metal,
    m.polished,
    m.brass,
    m.ink,
    m.rim,
    m.logo,
    m.iconBlue,
    m.iconGold,
  ].filter((x): x is MeshPhysicalMaterial => Boolean(x));
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
  const bevel = 0.06;
  const depthEm = g.depth / g.scale;
  const geo = new ExtrudeGeometry(glyphShapes(g.d), {
    depth: depthEm - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelThickness: bevel,
    bevelSegments: 12,
    curveSegments: 22,
  });
  geo.translate(0, 0, -depthEm / 2 + bevel);
  const m = mesh(geo, material);
  m.scale.setScalar(g.scale);
  m.position.set(g.ox, g.oy, 0);
  return m;
}

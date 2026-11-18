import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Euler,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createLogger } from '../../../lib/logger';
import { computeBounds, fitRig, type Bounds, type Rig, type Vec3 } from '../logic/camera';
import { buildCatalogue, type Breakpoint, type ObjectSpec } from '../logic/catalogue';
import { VelocityTracker } from '../logic/drag';
import { FixedStepper } from '../logic/fixedStep';
import { IdleScheduler } from '../logic/idle';
import { mapKey } from '../logic/keys';
import { layoutName, type NameLayout } from '../logic/nameLayout';
import { QualityController } from '../logic/quality';
import { breakpointFor, computeRegion } from '../logic/region';
import { createRng } from '../logic/rng';
import { planSpawns, type SpawnPlan } from '../logic/spawn';
import { MAX_SPEED, PhysicsWorld, type BodyState } from '../physics/world';
import { readPalette, type Palette } from './css';
import { buildEnvironment } from './env';
import { buildLetter, buildObject } from './geometry';
import { makeLegendTextures, type LegendTextures } from './legend';
import { bodyMaterial, materialSet, nameMaterials } from './materials';

const log = createLogger('hero');

/** What the host component passes in. */
export interface RuntimeOptions {
  canvas: HTMLCanvasElement;
  /** The text block; objects live beside it (wide) or below it (stacked). */
  textEl: HTMLElement;
  seed: number;
  /** Expose `window.__hero` (tests and still generation only). */
  debug: boolean;
  onContextLost: () => void;
  onContextRestored: () => void;
  onAnnounce: (message: string) => void;
}

/** What the host can do with a running scene. */
export interface HeroRuntime {
  /** Pause or resume the frame loop (off screen, hidden tab). */
  setActive(on: boolean): void;
  /** Re-drop everything. */
  reset(): void;
  dispose(): void;
}

/** Test-only inspection API, installed only with `?heroSeed` or `?heroDebug`. */
export interface HeroDebug {
  ids(): string[];
  snapshot(): BodyState[];
  nameSnapshot(): number[][];
  bounds(): Bounds;
  /** Client-pixel position of a body's centre. */
  project(id: string): { x: number; y: number } | null;
  throwBody(id: string, vel: Vec3): void;
  reset(): void;
  stats(): { count: number; median: number; p95: number; max: number };
}

interface Tuning {
  worldWidth: number;
  elevationDeg: number;
  fovDeg: number;
  targetZ: number;
}

const TUNING: Record<Breakpoint, Tuning> = {
  desktop: { worldWidth: 15.5, elevationDeg: 36, fovDeg: 26, targetZ: 1.7 },
  mobile: { worldWidth: 9.4, elevationDeg: 40, fovDeg: 30, targetZ: 1.5 },
};

/** Share of the world width the name occupies. */
const NAME_SHARE = 0.86;
const MAX_DPR = 2;
const WARMUP_FRAMES = 24;

interface Item {
  spec: ObjectSpec;
  group: Group;
  hover: MeshPhysicalMaterial[];
  blob: Mesh;
  blobMat: MeshBasicMaterial;
  lift: number;
  spawned: boolean;
  plan: SpawnPlan | null;
}

interface Content {
  bp: Breakpoint;
  world: PhysicsWorld;
  layout: NameLayout;
  nameGroup: Group;
  items: Map<string, Item>;
  order: string[];
  disposables: Array<{ dispose(): void }>;
}

interface Grab {
  id: string;
  pointerId: number;
  pointerType: string;
  planeY: number;
  startX: number;
  startY: number;
  startT: number;
}

const hex = (c: { getHexString(): string }) => `#${c.getHexString()}`;

const radialTexture = (alphaStops: Array<[number, number]>): CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, a] of alphaStops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
};

const disposeObject = (root: Group) => {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) (m.geometry as BufferGeometry).dispose();
  });
};

const fontFamily = (): string => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
  return raw || "'Bricolage Grotesque Variable', system-ui, sans-serif";
};

/** Builds the renderer, scene and input handling. Resolves once fonts are ready and the first frame is drawn. */
export async function createHeroRuntime(o: RuntimeOptions): Promise<HeroRuntime> {
  const { canvas } = o;
  const family = fontFamily();
  try {
    await document.fonts.load(`600 40px ${family}`);
    await document.fonts.ready;
  } catch (err) {
    log.warn('font load failed; legends use the fallback face', err);
  }

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const palette: Palette = readPalette();
  const scene = new Scene();
  let envTexture: Texture = buildEnvironment(renderer, palette);
  scene.environment = envTexture;
  scene.environmentIntensity = 0.95;

  const camera = new PerspectiveCamera(26, 1, 0.5, 90);
  const key = new DirectionalLight('#fff0dc', 2.6);
  key.castShadow = true;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new DirectionalLight(palette.accentHi, 1.1);
  rim.position.set(9, 6, -10);
  scene.add(rim);
  scene.add(new AmbientLight('#8da0bd', 0.12));

  const shadowFloor = new Mesh(new PlaneGeometry(80, 80), new ShadowMaterial({ opacity: 0.55 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.004;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  const poolTex = radialTexture([
    [0, 1],
    [0.55, 0.35],
    [1, 0],
  ]);
  const pool = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      map: poolTex,
      color: '#ffd8b4',
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.002;
  scene.add(pool);

  const blobTex = radialTexture([
    [0, 0.85],
    [0.5, 0.45],
    [1, 0],
  ]);
  const blobGeo = new PlaneGeometry(1, 1);
  blobGeo.rotateX(-Math.PI / 2);

  const quality = new QualityController({ window: 30, budgetMs: 21 });
  const stepper = new FixedStepper(1 / 120);
  const idle = new IdleScheduler({ idleMs: 4500, minGapMs: 3500, maxGapMs: 7000, seed: o.seed + 7 });
  const tracker = new VelocityTracker(90);
  const raycaster = new Raycaster();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  let content: Content | null = null;
  let rig: Rig;
  let bounds: Bounds;
  let canvasW = 1;
  let canvasH = 1;
  let active = false;
  let contextLost = false;
  let disposed = false;
  let raf = 0;
  let lastT: number | null = null;
  let simMs = 0;
  let resets = 0;
  let frameNo = 0;
  let readyFlag = false;
  let pending: Array<{ id: string; at: number }> = [];
  let selected = 0;
  let hoverId: string | null = null;
  let grab: Grab | null = null;
  let hoverDirty = false;
  const pointer = { x: 0, y: 0, inside: false, mouse: false };
  const par = new Vector2(0, 0);
  const parTarget = new Vector2(0, 0);
  const frameLog: number[] = [];
  const attrCache = new Map<string, string>();
  const rng = createRng(o.seed ^ 0x9e3779b9);

  const setAttr = (name: string, value: string) => {
    if (attrCache.get(name) === value) return;
    attrCache.set(name, value);
    canvas.setAttribute(name, value);
  };
  setAttr('data-ready', 'false');
  setAttr('data-seed', String(o.seed));

  // ---- content ---------------------------------------------------------------------------

  const buildContent = (bp: Breakpoint): Content => {
    const tune = TUNING[bp];
    const unit = layoutName(1).width;
    const approxWidth = tune.worldWidth * 0.94;
    const cap = Math.min(2, Math.max(0.5, (NAME_SHARE * approxWidth) / unit));
    const layout = layoutName(cap);
    const specs = buildCatalogue(bp);
    const disposables: Content['disposables'] = [];
    const nameGroup = new Group();
    const mats = nameMaterials(palette);
    disposables.push(mats.letters, mats.slab);
    for (const g of layout.glyphs) nameGroup.add(buildLetter(g, mats.letters));
    for (const s of layout.slabs) {
      const slab = new Mesh(
        new RoundedBoxGeometry(s.hx * 2, s.hy * 2, s.hz * 2, 4, Math.min(0.1, s.hy * 0.8)),
        mats.slab,
      );
      slab.position.set(s.cx, s.cy, s.cz);
      slab.castShadow = true;
      slab.receiveShadow = true;
      nameGroup.add(slab);
    }
    scene.add(nameGroup);

    const world = new PhysicsWorld(bounds, layout.colliders, 0);
    const items = new Map<string, Item>();
    for (const spec of specs) {
      let legend: LegendTextures | null = null;
      if (spec.kind === 'key' && spec.legend) {
        const probe = bodyMaterial(spec, palette);
        const topTone = probe.color.clone().offsetHSL(0, 0, 0.035);
        probe.dispose();
        legend = makeLegendTextures({
          label: spec.legend,
          w: spec.size.w,
          d: spec.size.d,
          top: hex(topTone),
          ink: spec.accentBody ? '#fff1e4' : spec.accentLegend ? hex(palette.accent) : '#e8e3d8',
          glow: !spec.accentBody && spec.accentLegend ? hex(palette.accentDeep) : null,
          fontFamily: family,
          anisotropy,
        });
      }
      const set = materialSet(spec, palette, legend);
      const built = buildObject(spec, set);
      built.group.userData.id = spec.id;
      built.group.visible = false;
      scene.add(built.group);
      const blobMat = new MeshBasicMaterial({
        map: blobTex,
        color: '#000000',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const blob = new Mesh(blobGeo, blobMat);
      blob.position.y = 0.012;
      blob.visible = false;
      scene.add(blob);
      disposables.push(set.body, set.metal, set.polished, set.accent, blobMat);
      if (set.top) disposables.push(set.top);
      if (legend) disposables.push(legend.map, legend.bump);
      if (legend?.emissive) disposables.push(legend.emissive);
      items.set(spec.id, {
        spec,
        group: built.group,
        hover: built.hoverMaterials,
        blob,
        blobMat,
        lift: 0,
        spawned: false,
        plan: null,
      });
    }
    return { bp, world, layout, nameGroup, items, order: specs.map((s) => s.id), disposables };
  };

  const disposeContent = (c: Content) => {
    scene.remove(c.nameGroup);
    disposeObject(c.nameGroup);
    for (const it of c.items.values()) {
      scene.remove(it.group, it.blob);
      disposeObject(it.group);
    }
    for (const d of c.disposables) d.dispose();
  };

  const schedule = (c: Content, seed: number) => {
    const specs = c.order.map((id) => c.items.get(id)!.spec);
    const plans = planSpawns(specs, bounds, c.layout.keepOut, seed);
    pending = plans
      .map((p) => {
        c.items.get(p.id)!.plan = p;
        return { id: p.id, at: simMs + p.delayMs };
      })
      .sort((a, b) => a.at - b.at);
  };

  // ---- camera, size, quality ---------------------------------------------------------------

  const applyQuality = () => {
    const q = quality.settings;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR) * q.dprScale);
    renderer.setSize(canvasW, canvasH, false);
    if (key.shadow.mapSize.x !== q.shadowSize) {
      key.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
  };

  const layoutScene = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    canvasW = rect.width;
    canvasH = rect.height;
    const bp = breakpointFor(window.innerWidth);
    const tune = TUNING[bp];
    const t = o.textEl.getBoundingClientRect();
    const region = computeRegion(
      { width: canvasW, height: canvasH },
      { right: t.right - rect.left, bottom: t.bottom - rect.top },
      bp === 'mobile',
    );
    const aspect = canvasW / canvasH;
    rig = fitRig({ aspect, region, ...tune });
    const unit = layoutName(1).width;
    const cap = Math.min(2, Math.max(0.5, (NAME_SHARE * tune.worldWidth * 0.94) / unit));
    const backZ = -layoutName(cap).depth / 2 - 0.35;
    const raw = computeBounds(rig, region, backZ);
    const probeKeep = layoutName(cap).keepOut;
    bounds = { ...raw, maxZ: Math.max(raw.maxZ, probeKeep.maxZ + 3.2) };

    camera.aspect = aspect;
    camera.fov = rig.fovDeg;
    camera.setViewOffset(
      canvasW,
      canvasH,
      (-rig.shiftNdcX * canvasW) / 2,
      (rig.shiftNdcY * canvasH) / 2,
      canvasW,
      canvasH,
    );
    camera.updateProjectionMatrix();

    const mid = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const half = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 3.5;
    key.position.set(mid.x - 6.5, 13, mid.z + 7);
    key.target.position.set(mid.x, 0, mid.z);
    const sc = key.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 2;
    sc.far = 40;
    sc.updateProjectionMatrix();
    pool.position.x = mid.x;
    pool.position.z = mid.z;
    pool.scale.set((bounds.maxX - bounds.minX) * 1.7, (bounds.maxX - bounds.minX) * 1.2, 1);

    if (!content || content.bp !== bp) {
      if (content) disposeContent(content);
      content = buildContent(bp);
      simMs = 0;
      selected = 0;
      schedule(content, o.seed + resets);
      log.info('built scene', { bp, bodies: content.items.size });
    } else {
      content.world.setBounds(bounds);
    }
    applyQuality();
  };

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!disposed && !contextLost) layoutScene();
    }, 120);
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(canvas);
  ro.observe(o.textEl);

  // ---- picking and input ---------------------------------------------------------------------

  const ndcOf = (cx: number, cy: number): Vector2 => {
    const r = canvas.getBoundingClientRect();
    return new Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
  };

  const pickAt = (cx: number, cy: number): { id: string; point: Vector3 } | null => {
    if (!content) return null;
    raycaster.setFromCamera(ndcOf(cx, cy), camera);
    const roots: Group[] = [content.nameGroup];
    for (const it of content.items.values()) if (it.spawned) roots.push(it.group);
    const hit = raycaster.intersectObjects(roots, true)[0];
    if (!hit) return null;
    let n: Group | null = hit.object as unknown as Group;
    while (n && n.userData.id === undefined) n = n.parent as Group | null;
    return n ? { id: n.userData.id as string, point: hit.point.clone() } : null;
  };

  const planePoint = (cx: number, cy: number, y: number): Vec3 | null => {
    raycaster.setFromCamera(ndcOf(cx, cy), camera);
    const out = new Vector3();
    if (!raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), out)) return null;
    const m = 0.45;
    return {
      x: Math.min(Math.max(out.x, bounds.minX + m), bounds.maxX - m),
      y,
      z: Math.min(Math.max(out.z, bounds.minZ + m), bounds.maxZ - m),
    };
  };

  const endGrab = (throwIt: boolean, clickPoint?: Vec3) => {
    if (!grab || !content) return;
    const g = grab;
    grab = null;
    canvas.style.cursor = hoverId ? 'grab' : '';
    const world = content.world;
    if (throwIt) world.endGrab(tracker.estimate(MAX_SPEED, performance.now()));
    else world.endGrab();
    if (clickPoint) {
      const it = content.items.get(g.id)!;
      const st = world.get(g.id);
      const m = it.spec.mass;
      const off = st
        ? {
            x: Math.max(-0.4, Math.min(0.4, clickPoint.x - st.pos.x)),
            y: 0,
            z: Math.max(-0.4, Math.min(0.4, clickPoint.z - st.pos.z)),
          }
        : undefined;
      world.impulse(
        g.id,
        { x: (rng() - 0.5) * m * 3, y: m * 5.5, z: (rng() - 0.5) * m * 3 },
        off,
      );
    }
    try {
      canvas.releasePointerCapture(g.pointerId);
    } catch {
      /* capture already gone */
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!content || contextLost) return;
    idle.interact();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = pickAt(e.clientX, e.clientY);
    if (!hit || !content.items.has(hit.id)) return;
    const planeY = Math.max(hit.point.y, 0) + 0.75;
    grab = {
      id: hit.id,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      planeY,
      startX: e.clientX,
      startY: e.clientY,
      startT: performance.now(),
    };
    selected = Math.max(0, content.order.indexOf(hit.id));
    tracker.reset();
    content.world.beginGrab(hit.id, { x: hit.point.x, y: hit.point.y, z: hit.point.z });
    const p = planePoint(e.clientX, e.clientY, planeY);
    if (p) {
      content.world.updateGrab(p);
      tracker.push(performance.now(), p);
    }
    canvas.style.cursor = 'grabbing';
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers cannot be captured */
    }
    if (e.pointerType === 'mouse') e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    pointer.mouse = e.pointerType === 'mouse';
    if (pointer.mouse) {
      const r = canvas.getBoundingClientRect();
      parTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    }
    if (grab && e.pointerId === grab.pointerId && content) {
      idle.interact();
      const p = planePoint(e.clientX, e.clientY, grab.planeY);
      if (p) {
        content.world.updateGrab(p);
        tracker.push(performance.now(), p);
      }
    } else if (pointer.mouse) {
      hoverDirty = true;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!grab || e.pointerId !== grab.pointerId) return;
    const moved = Math.hypot(e.clientX - grab.startX, e.clientY - grab.startY);
    const quick = performance.now() - grab.startT < 320;
    if (moved < 6 && quick) {
      const p = planePoint(e.clientX, e.clientY, 0.5) ?? undefined;
      endGrab(false, p);
    } else {
      endGrab(true);
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (grab && e.pointerId === grab.pointerId) endGrab(false);
  };

  const onPointerLeave = () => {
    pointer.inside = false;
    parTarget.set(0, 0);
    hoverDirty = true;
  };

  // Pointer events fire before touch events: a grab already exists here if the touch landed on an
  // object, so only then do we block scrolling. Empty space keeps `touch-action: pan-y` scrolling.
  const onTouchStart = (e: TouchEvent) => {
    if (grab && grab.pointerType === 'touch') e.preventDefault();
  };

  const announce = (msg: string) => o.onAnnounce(msg);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!content || contextLost) return;
    const cmd = mapKey(e);
    if (!cmd) return;
    e.preventDefault();
    idle.interact();
    const c = content;
    const id = c.order[selected % c.order.length]!;
    const it = c.items.get(id)!;
    const m = it.spec.mass;
    switch (cmd.type) {
      case 'push':
        c.world.impulse(id, { x: cmd.dx * m * 5, y: m * 2.2, z: cmd.dz * m * 5 });
        announce(`${it.spec.label} pushed`);
        break;
      case 'select': {
        selected = (selected + cmd.dir + c.order.length) % c.order.length;
        announce(`${c.items.get(c.order[selected]!)!.spec.label} selected`);
        break;
      }
      case 'hop':
        c.world.impulse(id, { x: 0, y: m * 8, z: 0 });
        announce(`${it.spec.label} hopped`);
        break;
      case 'shuffle':
        for (const other of c.order) {
          const om = c.items.get(other)!.spec.mass;
          c.world.impulse(other, {
            x: (rng() - 0.5) * om * 9,
            y: om * (4 + rng() * 4),
            z: (rng() - 0.5) * om * 9,
          });
        }
        announce('Shuffled');
        break;
      default:
        reset();
        announce('Dropped again');
    }
  };

  const onFocus = () => {
    if (content) announce(`${content.items.get(content.order[selected % content.order.length]!)!.spec.label} selected`);
  };

  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    stopLoop();
    log.warn('webgl context lost');
    o.onContextLost();
  };
  const onRestored = () => {
    envTexture.dispose();
    envTexture = buildEnvironment(renderer, palette);
    scene.environment = envTexture;
    contextLost = false;
    layoutScene();
    log.info('webgl context restored');
    o.onContextRestored();
    if (active) startLoop();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('focus', onFocus);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // ---- frame ---------------------------------------------------------------------------------

  const tmpQ = new Quaternion();
  const tmpE = new Euler();
  const tmpV = new Vector3();

  const placeCamera = (t: number) => {
    const base = rig.position;
    const tg = rig.target;
    par.lerp(parTarget, 0.05);
    tmpV.set(base.x - tg.x, base.y - tg.y, base.z - tg.z);
    const yaw = par.x * 0.045 + Math.sin(t * 0.00013) * 0.012;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const vx = tmpV.x * cos + tmpV.z * sin;
    const vz = -tmpV.x * sin + tmpV.z * cos;
    camera.position.set(tg.x + vx, tg.y + tmpV.y + par.y * 0.35, tg.z + vz);
    camera.lookAt(tg.x, tg.y, tg.z);
  };

  const spawnDue = (c: Content) => {
    while (pending.length && pending[0]!.at <= simMs) {
      const { id } = pending.shift()!;
      const it = c.items.get(id)!;
      if (it.plan) c.world.spawn(it.spec, it.plan);
      it.spawned = true;
      it.group.visible = true;
      it.blob.visible = true;
    }
  };

  const updateVisuals = (c: Content, alpha: number) => {
    const hovered = grab?.id ?? hoverId;
    const selectedId = document.activeElement === canvas ? c.order[selected % c.order.length] : null;
    for (const it of c.items.values()) {
      if (!it.spawned) continue;
      const s = c.world.interpolated(it.spec.id, alpha);
      if (!s) continue;
      const target = it.spec.id === hovered || it.spec.id === selectedId ? 1 : 0;
      it.lift += (target - it.lift) * 0.18;
      it.group.position.set(s.pos.x, s.pos.y + it.lift * 0.14, s.pos.z);
      it.group.quaternion.set(s.quat.x, s.quat.y, s.quat.z, s.quat.w);
      for (const m of it.hover) m.envMapIntensity = 1 + it.lift * 0.7;
      tmpQ.set(s.quat.x, s.quat.y, s.quat.z, s.quat.w);
      tmpE.setFromQuaternion(tmpQ, 'YXZ');
      const lowest = s.pos.y - it.spec.size.h / 2;
      const gap = Math.max(0, lowest);
      const spread = 1 + gap * 0.22;
      const r = Math.max(it.spec.size.w, it.spec.size.d);
      it.blob.position.set(s.pos.x, 0.012, s.pos.z);
      it.blob.rotation.y = tmpE.y;
      it.blob.scale.set((it.spec.size.w * 1.35 + 0.35) * spread, 1, (it.spec.size.d * 1.35 + 0.35) * spread);
      it.blobMat.opacity = 0.62 * Math.max(0, 1 - gap / (3 + r));
    }
  };

  const hoverPick = () => {
    hoverDirty = false;
    if (grab || !pointer.inside || !pointer.mouse) {
      if (hoverId && !grab) hoverId = null;
      return;
    }
    const hit = pickAt(pointer.x, pointer.y);
    const id = hit && content?.items.has(hit.id) ? hit.id : null;
    if (id !== hoverId) {
      hoverId = id;
      canvas.style.cursor = id ? 'grab' : '';
    }
  };

  const frame = (t: number) => {
    raf = 0;
    if (!active || contextLost || disposed || !content) return;
    const c = content;
    const dtMs = lastT === null ? 0 : Math.min(t - lastT, 250);
    lastT = t;
    frameNo++;
    if (dtMs > 0 && frameNo > WARMUP_FRAMES) {
      frameLog.push(dtMs);
      if (frameLog.length > 900) frameLog.shift();
      const next = quality.record(dtMs);
      if (next) {
        applyQuality();
        log.info('quality stepped down', { level: quality.level, ...next });
        setAttr('data-quality', String(quality.level));
      }
    }
    const { steps, alpha } = stepper.advance(dtMs / 1000);
    simMs += dtMs;
    spawnDue(c);
    if (grab) {
      const p = planePoint(pointer.x, pointer.y, grab.planeY);
      if (p) c.world.updateGrab(p);
    }
    for (let i = 0; i < steps; i++) c.world.stepOnce();
    if (!grab) {
      const nudge = idle.tick(dtMs);
      if (nudge) {
        const id = c.order[Math.floor(nudge.pick * c.order.length)]!;
        const m = c.items.get(id)!.spec.mass;
        c.world.impulse(id, { x: (nudge.pick - 0.5) * m * 3, y: m * 3.2, z: 0 });
      }
    }
    if (hoverDirty) hoverPick();
    updateVisuals(c, alpha);
    placeCamera(t);
    renderer.render(scene, camera);

    const spawned = [...c.items.values()].filter((i) => i.spawned).length;
    setAttr('data-bodies', String(spawned));
    setAttr(
      'data-sleeping',
      String(spawned === c.items.size && pending.length === 0 && c.world.allAsleep()),
    );
    setAttr('data-breakpoint', c.bp);
    if (!readyFlag) {
      readyFlag = true;
      setAttr('data-ready', 'true');
      log.info('ready', { bodies: c.items.size, bp: c.bp, dpr: renderer.getPixelRatio() });
    }
    raf = requestAnimationFrame(frame);
  };

  function startLoop() {
    if (raf || disposed || contextLost) return;
    lastT = null;
    stepper.reset();
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function reset() {
    if (!content) return;
    endGrab(false);
    resets++;
    schedule(content, o.seed + resets);
    // Everything in the plan waits for its slot; bodies already in the world stay put until then.
    content.world.wakeAll();
    idle.interact();
  }

  layoutScene();

  if (o.debug) {
    const api: HeroDebug = {
      ids: () => content?.order.slice() ?? [],
      snapshot: () => content?.world.snapshot() ?? [],
      nameSnapshot: () => content?.world.nameSnapshot() ?? [],
      bounds: () => ({ ...bounds }),
      project: (id) => {
        const st = content?.world.get(id);
        if (!st) return null;
        const v = new Vector3(st.pos.x, st.pos.y, st.pos.z).project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      throwBody: (id, vel) => {
        const st = content?.world.get(id);
        if (st) content?.world.throwBody(id, st.pos, vel);
      },
      reset: () => reset(),
      stats: () => {
        const s = [...frameLog].sort((a, b) => a - b);
        const at = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0;
        return { count: s.length, median: at(0.5), p95: at(0.95), max: s[s.length - 1] ?? 0 };
      },
    };
    (window as unknown as { __hero?: HeroDebug }).__hero = api;
  }

  return {
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) startLoop();
      else stopLoop();
    },
    reset,
    dispose() {
      disposed = true;
      stopLoop();
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('focus', onFocus);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (content) disposeContent(content);
      content = null;
      blobTex.dispose();
      poolTex.dispose();
      blobGeo.dispose();
      shadowFloor.geometry.dispose();
      (shadowFloor.material as Material).dispose();
      pool.geometry.dispose();
      (pool.material as Material).dispose();
      envTexture.dispose();
      key.shadow.map?.dispose();
      // No forceContextLoss: React StrictMode mounts twice and would lose the shared canvas context.
      renderer.dispose();
      const w = window as unknown as { __hero?: HeroDebug };
      if (o.debug) delete w.__hero;
    },
  };
}

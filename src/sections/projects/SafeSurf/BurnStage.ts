import { Geometry, Mesh, Program, Texture, Transform } from 'ogl';
import { createLogger } from '../../../lib/logger';
import { loadGlStage } from '../../../lib/lazyGl';
import type { GlStage } from '../../../lib/glStage';
import {
  bakeNoise,
  burnPhase,
  createBurn,
  easeBurn,
  EDGE,
  FIELD_NORM,
  NOISE2_SCALE,
  NOISE2_WEIGHT,
  NOISE_SCALE,
  NOISE_WEIGHT,
  ORIGIN_WEIGHT,
  EmberPool,
  emberSpawnCount,
  isAnimating,
  NOISE_SIZE,
  pickFrontPoint,
  seededRng,
  setBurnTarget,
  staggerMs,
  stepBurn,
  type BurnState,
} from './dissolve';

const log = createLogger('safesurf');

/** Seconds a full burn or re-form sweep takes. */
const DURATION_MS = 1000;
const EMBER_CAPACITY = 380;
const EMBER_RATE = 150;
const PAD = 44;
/** WebGL2 single-channel texture formats (not in OGL's WebGL1-era typings). */
const GL_RED = 0x1903;
const GL_R8 = 0x8229;

const VERT = /* glsl */ `#version 300 es
in vec2 position;
uniform vec4 uRect;
uniform vec2 uRes;
uniform float uPad;
out vec2 vUv;
void main() {
  vec2 size = uRect.zw;
  vec2 px = uRect.xy - uPad + position * (size + 2.0 * uPad);
  vUv = (px - uRect.xy) / size;
  vec2 ndc = px / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

/**
 * Threshold dissolve with an emissive front. Burn: the front eats the image along a two-octave
 * noise field, a thin char border darkens just ahead of it, a white-hot to paint to char colour
 * ramp glows on it, the pixels ahead shimmer, and a soft halo spills past the image edge.
 * Re-form: the same field runs back, but the new image knits in as coarse blocks that sharpen
 * to full resolution behind a mint front. Noise scales, weights and the front mapping match dissolve.ts.
 */
const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uImg;
uniform sampler2D uNoise;
uniform float uP;
uniform float uEdge;
uniform float uTime;
uniform float uMode;
uniform float uHeat;
uniform float uRadius;
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform vec3 uHot;
uniform vec3 uHi;
uniform vec3 uMid;
uniform vec3 uChar;
in vec2 vUv;
out vec4 o;

float field(vec2 uv, float form, float depth) {
  float n1 = texture(uNoise, uv * ${NOISE_SCALE.toFixed(2)}).r;
  float n2 = texture(uNoise, uv * ${NOISE2_SCALE.toFixed(2)} + vec2(0.37, 0.71)).r;
  // Burn spreads from a point; the re-form knits in from the rim, so its field is the rim distance.
  float lead = mix(distance(uv, uOrigin), 1.0 - depth, form);
  float f = n1 * ${NOISE_WEIGHT.toFixed(3)} + n2 * ${NOISE2_WEIGHT.toFixed(3)} + lead * ${ORIGIN_WEIGHT.toFixed(3)};
  return clamp(f / ${FIELD_NORM.toFixed(3)}, 0.0, 1.0);
}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
vec4 over(vec4 top, vec4 under) {
  return top + under * (1.0 - top.a);
}

void main() {
  vec2 uvc = clamp(vUv, 0.0, 1.0);
  // Rounded-rect mask, so the burn respects the image's rounded corners.
  vec2 q = abs(vUv - 0.5) * uSize - (uSize * 0.5 - uRadius);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float inside = 1.0 - smoothstep(-0.7, 0.7, sd);
  float form = step(0.5, uMode);
  float depth = clamp(-sd / (0.5 * min(uSize.x, uSize.y)), 0.0, 1.0);
  float d = field(uvc, form, depth) - mix(-uEdge * 2.0, 1.0 + uEdge * 2.0, uP);

  // Heat shimmer: the pixels just ahead of the front wobble.
  float near = 1.0 - smoothstep(0.0, uEdge * 5.0, max(d, 0.0));
  vec2 w = vec2(
    texture(uNoise, uvc * 7.0 + vec2(uTime * 0.35, 0.0)).r,
    texture(uNoise, uvc * 7.0 + vec2(3.1, uTime * 0.3)).r
  ) - 0.5;
  vec2 suv = uvc + w * 0.02 * near * step(0.0, d) * (1.0 - form * 0.6);

  // Knit: just behind the re-forming front the image is coarse blocks that sharpen.
  float knit = form * (1.0 - clamp(d / (uEdge * 5.0), 0.0, 1.0));
  float cell = mix(1.0, 5.0, knit * knit);
  vec2 px = suv * uSize;
  vec2 cellId = floor(px / cell);
  suv = (cellId + 0.5) * cell / uSize;
  float ragged = form * (hash(cellId) - 0.5) * uEdge * 1.2 * knit;

  vec4 img = texture(uImg, clamp(suv, 0.0, 1.0));
  float alive = step(ragged, d) * inside;

  float t = -d / (uEdge * 0.3);
  float ah = max(d, 0.0) / uEdge; // > 0 behind a burn front (gone), < 0 ahead of it (still image)
  float flick = 0.8 + 0.4 * texture(uNoise, uvc * 6.0 + vec2(uTime * 0.9, -uTime * 0.6)).r;

  // Heat: the image darkens and warms just ahead of a burn front, then chars at the very edge.
  float scorch = (1.0 - smoothstep(0.0, 2.4, ah)) * (1.0 - form) * step(0.0, d);
  float chr = (1.0 - smoothstep(0.0, 0.5, max(-t, 0.0))) * (1.0 - form);
  vec3 lum = vec3(dot(img.rgb, vec3(0.33)));
  vec3 col = mix(img.rgb, img.rgb * vec3(0.42, 0.62, 0.72), scorch * 0.7);
  col = mix(col, uChar * img.a, chr * 0.95);
  // Cooling: a re-formed edge starts bright and settles into the image over a few edge widths.
  float cool = form * step(0.0, d) * (1.0 - smoothstep(0.0, 3.0, ah));
  col = mix(col, uMid * (0.55 + lum * 0.9), cool * 0.28);
  col = mix(col, uMid * lum * 1.4, knit * 0.16);
  vec4 base = vec4(col, img.a) * alive;

  // The plasma front, outward from the white-hot line: pale cyan, accent, then a dark char band behind it.
  float tt = mix(t, -t, form);
  float band = flick * (1.0 - form);
  float charBand = smoothstep(1.9, 2.6, tt) * (1.0 - smoothstep(3.4, 4.6, tt)) * band;
  float acc = (1.0 - smoothstep(0.0, 1.1, abs(tt - 1.7))) * flick;
  float pale = (1.0 - smoothstep(0.0, 1.0, abs(tt - 0.85))) * flick;
  float core = (1.0 - smoothstep(0.0, 0.7, abs(tt - 0.1))) * flick;
  // A burn glows on both sides of the line; a re-form is a cooling lip on the formed side only.
  float side = mix(1.0, step(0.0, d), form);
  float od = max(sd, 0.0);
  float fade = exp(-od / 2.5);
  vec4 r = base;
  r = over(vec4(uChar * charBand * 0.92, charBand * 0.92) * fade, r);
  r = over(vec4(uMid * acc * 0.9, acc * 0.9) * fade * side, r);
  r = over(vec4(uHi * pale, pale) * fade * side, r);
  r = over(vec4(uHot * core, core) * fade * side, r);

  // Glow spill: soft light thrown past the front, and past the image edge at peak heat.
  float bloom = (1.0 - smoothstep(0.0, uEdge * 2.2, abs(d))) * 0.14 * fade * side;
  float halo = uHeat * exp(-od / 20.0) * 0.4 * (1.0 - inside) * (1.0 - form * 0.5);
  r = over(vec4(uHi * halo, halo), r);
  r = over(vec4(uMid * bloom, bloom), r);
  o = r;
}`;

const EMBER_VERT = /* glsl */ `#version 300 es
in vec2 position;
in vec4 color;
in float psize;
uniform vec2 uRes;
uniform float uDpr;
out vec4 vCol;
void main() {
  vCol = color;
  vec2 ndc = position / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  gl_PointSize = psize * 2.0 * uDpr;
}`;

const EMBER_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 vCol;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float glow = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0);
  float core = 1.0 - smoothstep(0.0, 0.4, r);
  vec3 rgb = mix(vCol.rgb, vec3(1.0, 0.92, 0.8), core * 0.5);
  float a = clamp(glow * 0.8 + core * 0.5, 0.0, 1.0) * vCol.a;
  o = vec4(rgb * a, a * 0.8);
}`;

interface Palette {
  hot: [number, number, number];
  hi: [number, number, number];
  mid: [number, number, number];
  char: [number, number, number];
}

/** Parses `#rgb`, `#rrggbb` or `rgb()` into 0 to 1 channels; null when it is anything else. */
function parseColor(raw: string): [number, number, number] | null {
  const v = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join('') : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  }
  const rgb = /^rgba?\(([^)]+)\)/i.exec(v);
  if (rgb) {
    const p = rgb[1]!.split(/[\s,/]+/).map(Number);
    return [p[0]! / 255, p[1]! / 255, p[2]! / 255];
  }
  return null;
}

const mix3 = (a: readonly number[], b: readonly number[], m: number): [number, number, number] => [
  a[0]! + (b[0]! - a[0]!) * m,
  a[1]! + (b[1]! - a[1]!) * m,
  a[2]! + (b[2]! - a[2]!) * m,
];

/**
 * Burn and re-form palettes from the live design tokens, so a token change recolours the burn
 * without touching this file. The fallbacks only apply where the tokens are missing.
 */
function readPalettes(el: HTMLElement): { warm: Palette; cool: Palette } {
  const cs = getComputedStyle(el);
  const tok = (name: string, fb: [number, number, number]) =>
    parseColor(cs.getPropertyValue(name)) ?? fb;
  const paint = tok('--paint', [0.12, 0.82, 0.95]);
  const paintHi = tok('--paint-hi', [0.55, 0.95, 1]);
  const paintDeep = tok('--paint-deep', [0.04, 0.42, 0.53]);
  const pass = tok('--pass', [0.6, 0.88, 0.42]);
  const white: [number, number, number] = [0.92, 0.99, 1];
  return {
    warm: {
      hot: white,
      hi: mix3(paintHi, [0.7, 0.98, 1], 0.5),
      mid: paint,
      char: mix3(paintDeep, [0, 0, 0], 0.88),
    },
    cool: {
      hot: mix3(pass, white, 0.8),
      hi: mix3(pass, white, 0.35),
      mid: pass,
      char: mix3(pass, [0, 0, 0], 0.85),
    },
  };
}

interface Item {
  img: HTMLImageElement;
  index: number;
  burn: BurnState;
  origin: [number, number];
  carry: number;
  ready: boolean;
  radius: number;
  tex: Texture | null;
  mesh: Mesh | null;
  uniforms: Record<string, { value: unknown }> | null;
}

/** Options for {@link BurnStage.create}. */
export interface BurnStageOptions {
  /** The element the canvas fills; image positions are measured relative to it. */
  screen: HTMLElement;
  /** Element that receives the canvas. */
  mount: HTMLElement;
  /** The WebGL context was lost: switch to the CSS fallback. */
  onLost: () => void;
  /** The context came back and every GL object was rebuilt. */
  onRestored: () => void;
  /**
   * Test and capture hook: ignore the wall clock and advance only when the page dispatches a
   * `safesurf:step` event on `window` with the milliseconds to advance in `detail`.
   */
  manualClock?: boolean;
}

/**
 * ONE shared WebGL2 canvas over the mock page: one quad per image, a baked-noise threshold
 * dissolve with an emissive edge, and a pool of embers drawn as points. Images are only drawn
 * while burning or re-forming; at rest the real `<img>` shows (or the blocked tile does), so
 * a settled page costs nothing and always keeps its alt text and layout.
 */
export class BurnStage {
  private items = new Map<HTMLImageElement, Item>();
  private noise = bakeNoise(NOISE_SIZE, 11);
  private noiseTex: Texture | null = null;
  private root: Transform | null = null;
  private emberMesh: Mesh | null = null;
  private emberGeo: Geometry | null = null;
  private emberUniforms: Record<string, { value: unknown }> | null = null;
  private readonly pool = new EmberPool(EMBER_CAPACITY, seededRng(42));
  private readonly spawnRng = seededRng(7);
  private readonly pos = new Float32Array(EMBER_CAPACITY * 2);
  private readonly col = new Float32Array(EMBER_CAPACITY * 4);
  private readonly siz = new Float32Array(EMBER_CAPACITY);
  private drewLast = false;
  private disposed = false;
  private palettes: { warm: Palette; cool: Palette } | null = null;
  private stage: GlStage | null = null;
  private clock = 0;
  private stepMs = 0;
  private readonly onStep = (e: Event) => {
    this.stepMs += (e as CustomEvent<number>).detail;
  };

  private constructor(private readonly opts: BurnStageOptions) {}

  /** Creates the stage, or resolves null when WebGL2 is unavailable (use the CSS fallback). */
  static async create(opts: BurnStageOptions): Promise<BurnStage | null> {
    const { GlStage } = await loadGlStage();
    const bs = new BurnStage(opts);
    const stage = GlStage.create({
      container: opts.mount,
      name: 'safesurf',
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
      onFrame: (dt) => bs.frame(dt),
      onContextLost: () => opts.onLost(),
      onContextRestored: () => {
        bs.initGl();
        opts.onRestored();
      },
    });
    if (!stage) return null;
    bs.stage = stage;
    if (opts.manualClock) window.addEventListener('safesurf:step', bs.onStep);
    bs.initGl();
    stage.start();
    log.info('burn stage ready');
    return bs;
  }

  /** (Re)creates every GL object from CPU state. Called at start and after a context restore. */
  private initGl(): void {
    const stage = this.stage;
    if (!stage) return;
    const gl = stage.gl;
    this.root = new Transform();
    this.palettes = readPalettes(this.opts.screen);
    const { warm, cool } = this.palettes;
    this.pool.palettes = {
      warm: { hot: warm.hi, mid: warm.mid, char: mix3(warm.mid, warm.char, 0.7) },
      cool: { hot: mix3(cool.mid, [0, 0, 0], 0.35), mid: cool.mid, char: cool.hot },
    };
    this.noiseTex = new Texture(gl, {
      image: this.noise,
      width: NOISE_SIZE,
      height: NOISE_SIZE,
      format: GL_RED,
      internalFormat: GL_R8,
      type: gl.UNSIGNED_BYTE,
      wrapS: gl.REPEAT,
      wrapT: gl.REPEAT,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      flipY: false,
      unpackAlignment: 1,
    });
    for (const item of this.items.values()) {
      item.tex = null;
      item.mesh = null;
      item.uniforms = null;
      item.ready = false;
      void this.prepare(item);
    }
    this.emberGeo = new Geometry(gl, {
      position: { size: 2, data: this.pos, usage: gl.DYNAMIC_DRAW },
      color: { size: 4, data: this.col, usage: gl.DYNAMIC_DRAW },
      psize: { size: 1, data: this.siz, usage: gl.DYNAMIC_DRAW },
    });
    this.emberGeo.setDrawRange(0, 0);
    this.emberUniforms = {
      uRes: { value: [1, 1] },
      uDpr: { value: stage.currentSize.dpr },
    };
    const program = new Program(gl, {
      vertex: EMBER_VERT,
      fragment: EMBER_FRAG,
      uniforms: this.emberUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    });
    this.emberMesh = new Mesh(gl, {
      geometry: this.emberGeo,
      program,
      mode: gl.POINTS,
      frustumCulled: false,
    });
    this.emberMesh.visible = false;
    this.emberMesh.setParent(this.root);
  }

  /** Registers the images to manage. Existing ones keep their state; removed ones are dropped. */
  setItems(imgs: HTMLImageElement[]): void {
    const keep = new Set(imgs);
    for (const [img, item] of this.items) {
      if (!keep.has(img)) {
        item.mesh?.setParent(null);
        this.items.delete(img);
      }
    }
    imgs.forEach((img, index) => {
      const known = this.items.get(img);
      if (known) {
        known.index = index;
        return;
      }
      const rng = seededRng(100 + index * 13);
      const item: Item = {
        img,
        index,
        burn: createBurn(true),
        origin: [0.2 + rng() * 0.6, 0.1 + rng() * 0.8],
        carry: 0,
        ready: false,
        radius: 0,
        tex: null,
        mesh: null,
        uniforms: null,
      };
      this.items.set(img, item);
      void this.prepare(item);
    });
  }

  private async prepare(item: Item): Promise<void> {
    try {
      if (!item.img.complete || item.img.naturalWidth === 0) await item.img.decode();
      const stage = this.stage;
      if (this.disposed || !stage || stage.status !== 'ok' || !this.root || !this.noiseTex) return;
      if (this.items.get(item.img) !== item) return;
      const gl = stage.gl;
      item.tex = new Texture(gl, {
        image: item.img,
        flipY: false,
        generateMipmaps: false,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        premultiplyAlpha: true,
      });
      const quad = new Geometry(gl, {
        position: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) },
        index: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
      });
      item.uniforms = {
        uImg: { value: item.tex },
        uNoise: { value: this.noiseTex },
        uP: { value: 0 },
        uEdge: { value: EDGE },
        uTime: { value: 0 },
        uMode: { value: 0 },
        uHeat: { value: 0 },
        uRadius: { value: 0 },
        uOrigin: { value: item.origin },
        uSize: { value: [1, 1] },
        uRect: { value: [0, 0, 1, 1] },
        uRes: { value: [1, 1] },
        uPad: { value: PAD },
        uHot: { value: [1, 1, 1] },
        uHi: { value: [1, 1, 1] },
        uMid: { value: [1, 1, 1] },
        uChar: { value: [0, 0, 0] },
      };
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: item.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        cullFace: false,
      });
      item.mesh = new Mesh(gl, { geometry: quad, program, frustumCulled: false });
      item.mesh.visible = false;
      item.mesh.setParent(this.root);
      item.ready = true;
    } catch (err) {
      log.error('could not prepare an image texture', err);
    }
  }

  /**
   * Points every image at blocked or allowed. `animate` false snaps (page change, first load);
   * true burns or re-forms, staggered down the page. Images without a texture yet snap.
   */
  apply(isBlocked: (img: HTMLImageElement) => boolean, animate: boolean): void {
    let n = 0;
    for (const item of this.items.values()) {
      const frame = item.img.parentElement;
      if (frame) item.radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
      const blocked = isBlocked(item.img);
      if (!animate || !item.ready) {
        item.burn = createBurn(blocked);
        this.syncDom(item);
      } else {
        // The DOM image is hidden by the frame loop, in the same task as the first GL draw, so it never flickers.
        item.burn = setBurnTarget(item.burn, blocked, staggerMs(n));
        if (isAnimating(item.burn)) n++;
      }
    }
  }

  private syncDom(item: Item): void {
    if (burnPhase(item.burn) === 'intact') delete item.img.dataset.glHidden;
    else item.img.dataset.glHidden = 'true';
  }

  private frame(realDt: number): void {
    let dt = realDt;
    if (this.opts.manualClock) {
      dt = this.stepMs;
      this.stepMs = 0;
    }
    this.clock += dt;
    const stage = this.stage;
    if (!stage || this.disposed || !this.emberMesh || !this.emberGeo || !this.emberUniforms) return;
    let animating = false;
    for (const item of this.items.values()) {
      if (isAnimating(item.burn)) {
        animating = true;
        item.burn = stepBurn(item.burn, dt, DURATION_MS);
      }
    }
    if (!animating && !this.drewLast && this.pool.count === 0) return;

    const screen = this.opts.screen.getBoundingClientRect();
    const { width, height, dpr } = stage.currentSize;
    for (const item of this.items.values()) {
      const phase = burnPhase(item.burn);
      const drawn =
        item.ready && item.mesh && item.uniforms && (phase === 'burning' || phase === 'forming');
      if (item.mesh) item.mesh.visible = Boolean(drawn);
      if (drawn && item.uniforms) {
        const r = item.img.getBoundingClientRect();
        const rect = [r.left - screen.left, r.top - screen.top, r.width, r.height];
        const p = easeBurn(item.burn.p);
        const pals = this.palettes ?? readPalettes(this.opts.screen);
        const palette = phase === 'forming' ? pals.cool : pals.warm;
        item.uniforms.uRect!.value = rect;
        item.uniforms.uSize!.value = [r.width, r.height];
        item.uniforms.uRadius!.value = item.radius;
        item.uniforms.uRes!.value = [width, height];
        item.uniforms.uP!.value = p;
        item.uniforms.uTime!.value = this.clock / 1000;
        item.uniforms.uMode!.value = phase === 'forming' ? 1 : 0;
        item.uniforms.uHeat!.value = Math.sin(Math.PI * item.burn.p) ** 1.5;
        item.uniforms.uHot!.value = palette.hot;
        item.uniforms.uHi!.value = palette.hi;
        item.uniforms.uMid!.value = palette.mid;
        item.uniforms.uChar!.value = palette.char;
        const spawn = emberSpawnCount(
          phase,
          dt,
          item.carry,
          phase === 'burning' ? EMBER_RATE : EMBER_RATE * 0.7,
        );
        item.carry = spawn.carry;
        for (let i = 0; i < spawn.count; i++) {
          const pt = pickFrontPoint(this.noise, NOISE_SIZE, item.origin, p, EDGE, this.spawnRng);
          if (pt)
            this.pool.spawn(
              rect[0]! + pt.u * rect[2]!,
              rect[1]! + pt.v * rect[3]!,
              phase === 'forming',
            );
        }
      }
      this.syncDom(item);
    }
    this.pool.step(dt);
    const n = this.pool.write(this.pos, this.col, this.siz);
    this.emberUniforms.uRes!.value = [width, height];
    this.emberUniforms.uDpr!.value = dpr;
    this.emberGeo.setDrawRange(0, n);
    for (const a of Object.values(this.emberGeo.attributes)) a.needsUpdate = true;
    this.emberMesh.visible = n > 0;
    stage.renderer.render({ scene: this.root!, sort: false, frustumCull: false });
    this.drewLast = animating || n > 0;
  }

  /** Releases the GL context, textures and listeners. Images go back to their DOM state. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('safesurf:step', this.onStep);
    for (const item of this.items.values()) delete item.img.dataset.glHidden;
    this.items.clear();
    this.stage?.dispose();
    this.stage = null;
    log.info('burn stage disposed');
  }
}

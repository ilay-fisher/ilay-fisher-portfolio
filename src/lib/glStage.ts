import { Renderer } from 'ogl';
import { canvasPixelSize, nextStatus, shouldRun, type StageStatus } from './glStageLogic';
import { createLogger } from './logger';
import { cappedDpr, isWebGLAvailable } from './webgl';

const log = createLogger('glstage');

/** Size of the stage in CSS pixels plus the device pixel ratio actually used. */
export interface StageSize {
  width: number;
  height: number;
  dpr: number;
}

/** Options for {@link GlStage.create}. */
export interface GlStageOptions {
  /** Element that sizes the canvas. The canvas is appended to it. */
  container: HTMLElement;
  /** Scope name for log lines and the `data-*` probes, e.g. `hero`. */
  name: string;
  /** Maximum device pixel ratio. Default 2. */
  maxDpr?: number;
  alpha?: boolean;
  premultipliedAlpha?: boolean;
  /** `high-performance` only for the hero; `low-power` elsewhere. */
  powerPreference?: WebGLPowerPreference;
  /** Called once per frame while running. Never log in here. */
  onFrame?: (dtMs: number, tMs: number) => void;
  /** Called after the canvas was resized (and once at start). */
  onResize?: (size: StageSize) => void;
  /** Context lost: show your DOM/CSS fallback. The stage has already stopped. */
  onContextLost?: () => void;
  /** Context restored: every GL object is invalid, rebuild from CPU state. */
  onContextRestored?: () => void;
}

/**
 * Thin OGL wrapper shared by the hero and SafeSurf. Owns one canvas and one WebGL2
 * context: capped DPR, resize handling, pause when off screen or the tab is hidden,
 * context-lost/restored hooks, dispose.
 *
 * Import it lazily through `loadGlStage()` so first paint does not carry OGL.
 * The canvas exposes Playwright probes: `data-webgl="ok|lost"`, `data-frame` and `data-ready`.
 */
export class GlStage {
  /** OGL renderer. Replaced after a context restore, so always read it from the stage. */
  renderer: Renderer;
  readonly canvas: HTMLCanvasElement;
  private _status: StageStatus = 'ok';
  private inView = false;
  private tabVisible = !document.hidden;
  private started = false;
  private rafId = 0;
  private looping = false;
  private lastT: number | null = null;
  private frame = 0;
  private size: StageSize = { width: 1, height: 1, dpr: 1 };
  private readonly ro: ResizeObserver | null;
  private readonly io: IntersectionObserver | null;

  private constructor(
    private readonly opts: GlStageOptions,
    canvas: HTMLCanvasElement,
    renderer: Renderer,
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    canvas.dataset.webgl = 'ok';
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.ro =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.resize());
    this.ro?.observe(opts.container);
    this.io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            const last = entries[entries.length - 1];
            if (last) {
              this.inView = last.isIntersecting;
              this.sync();
            }
          });
    if (this.io) this.io.observe(canvas);
    else this.inView = true;
    this.resize();
  }

  /**
   * Creates a stage, or returns `null` when WebGL2 is unavailable (show your fallback).
   * Never falls back to WebGL1.
   */
  static create(opts: GlStageOptions): GlStage | null {
    if (!isWebGLAvailable()) {
      log.warn(`${opts.name}: WebGL2 unavailable, using fallback`);
      return null;
    }
    const canvas = document.createElement('canvas');
    const renderer = GlStage.makeRenderer(canvas, opts);
    if (!renderer.isWebgl2) {
      log.warn(`${opts.name}: renderer is not WebGL2, using fallback`);
      return null;
    }
    opts.container.appendChild(canvas);
    log.info(`${opts.name}: WebGL2 context created`);
    return new GlStage(opts, canvas, renderer);
  }

  private static makeRenderer(canvas: HTMLCanvasElement, o: GlStageOptions): Renderer {
    return new Renderer({
      canvas,
      webgl: 2,
      dpr: cappedDpr(o.maxDpr ?? 2),
      alpha: o.alpha ?? false,
      premultipliedAlpha: o.premultipliedAlpha ?? false,
      powerPreference: o.powerPreference ?? 'default',
    });
  }

  /** The WebGL2 context. */
  get gl() {
    return this.renderer.gl;
  }

  get status(): StageStatus {
    return this._status;
  }

  /** Current size in CSS pixels and the DPR in use. */
  get currentSize(): StageSize {
    return this.size;
  }

  /** Begin the loop. It still pauses itself while off screen or the tab is hidden. */
  start(): void {
    this.started = true;
    this.sync();
  }

  /** Stop the loop (for example when idle and settled). Call `start()` to resume. */
  stop(): void {
    this.started = false;
    this.sync();
  }

  /** Re-measure the container and resize the canvas. Called automatically by ResizeObserver. */
  resize(): void {
    if (this._status === 'disposed') return;
    const { clientWidth, clientHeight } = this.opts.container;
    const dpr = cappedDpr(this.opts.maxDpr ?? 2);
    this.renderer.dpr = dpr;
    this.renderer.setSize(clientWidth || 1, clientHeight || 1);
    const px = canvasPixelSize(clientWidth, clientHeight, dpr);
    this.size = { width: clientWidth || 1, height: clientHeight || 1, dpr };
    log.debug(`${this.opts.name}: resize`, { css: [clientWidth, clientHeight], px });
    this.opts.onResize?.(this.size);
  }

  /** Release the context, observers and listeners. The stage cannot be reused. */
  dispose(): void {
    if (this._status === 'disposed') return;
    this._status = nextStatus(this._status, 'dispose');
    this.sync();
    this.ro?.disconnect();
    this.io?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
    log.info(`${this.opts.name}: disposed`);
  }

  private readonly onLost = (e: Event): void => {
    e.preventDefault();
    this._status = nextStatus(this._status, 'lost');
    this.canvas.dataset.webgl = 'lost';
    this.sync();
    log.warn(`${this.opts.name}: context lost`);
    this.opts.onContextLost?.();
  };

  private readonly onRestored = (): void => {
    if (this._status !== 'lost') return;
    this._status = nextStatus(this._status, 'restored');
    this.renderer = GlStage.makeRenderer(this.canvas, this.opts);
    this.canvas.dataset.webgl = 'ok';
    this.resize();
    log.info(`${this.opts.name}: context restored`);
    this.opts.onContextRestored?.();
    this.sync();
  };

  private readonly onVisibility = (): void => {
    this.tabVisible = !document.hidden;
    this.sync();
  };

  private sync(): void {
    const run = shouldRun({
      status: this._status,
      inView: this.inView,
      tabVisible: this.tabVisible,
      started: this.started,
    });
    if (run && !this.looping) {
      this.looping = true;
      this.lastT = null;
      this.rafId = requestAnimationFrame(this.tick);
    } else if (!run && this.looping) {
      this.looping = false;
      cancelAnimationFrame(this.rafId);
    }
  }

  private readonly tick = (t: number): void => {
    if (!this.looping) return;
    const dt = this.lastT === null ? 0 : t - this.lastT;
    this.lastT = t;
    this.opts.onFrame?.(dt, t);
    this.frame += 1;
    if (this.frame <= 5 || this.frame % 30 === 0) {
      this.canvas.dataset.frame = String(this.frame);
      if (this.frame >= 2) this.canvas.dataset.ready = 'true';
    }
    this.rafId = requestAnimationFrame(this.tick);
  };
}

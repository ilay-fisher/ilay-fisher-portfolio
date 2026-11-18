import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { createLogger } from '../../../lib/logger';
import { useInView, usePrefersReducedMotion, useRafLoop } from '../../../lib/motion';
import { DroneModel, type Algo, type Outcome, type Tool } from './model';
import { formatCost, formatCount, formatMs } from './readout';
import { DroneRenderer, readPalette, type PointerView } from './render';
import './DroneRig.css';

const log = createLogger('drone');

/** Props for {@link DroneRig}. */
export interface DroneRigProps {
  /** Seed for the city and the idle run, so a run can be repeated. */
  seed?: number;
  /** Whether the rig drops obstacles by itself until the visitor interacts. Default true. */
  autoRun?: boolean;
  /** Publish `window.__drone` for end-to-end tests. Default false. */
  expose?: boolean;
  /** Milliseconds to wait after arriving before flying to a new goal. 0 never does. */
  regoalMs?: number;
  /**
   * `raf` (default) runs the simulation from the animation frame loop. `manual` runs no loop at
   * all: the simulation only advances when `window.__drone.step()` is called, which makes tests
   * independent of wall-clock frame rate.
   */
  clock?: 'raf' | 'manual';
}

/** The test-only probe published on `window.__drone` when `expose` is set. */
export interface DroneProbe {
  /** A plain snapshot of the simulation plus UI mode and frame count. */
  state(): ProbeState;
  /** Frame timing since mount, in ms: draw plus simulation per frame. */
  timing(): { frames: number; mean: number; p95: number; max: number };
  /** Every re-plan the planners measured since mount: ms and expanded nodes for both. */
  plans(): PlanRecord[];
  /**
   * Advances the simulation by `n` ticks of `dtMs` simulated milliseconds (default 16), then
   * draws one frame. Works with either clock; with the `manual` clock it is the only thing that
   * moves time.
   */
  step(n: number, dtMs?: number): ProbeState;
  /** Whether the frame loop is currently running (in view, motion allowed, `raf` clock). */
  loopActive(): boolean;
}

/** One recorded re-plan, for the evidence in the report. */
export interface PlanRecord {
  astarMs: number;
  dstarMs: number;
  astarNodes: number;
  dstarNodes: number;
}

/** What `window.__drone.state()` returns. */
export interface ProbeState {
  cols: number;
  rows: number;
  replans: number;
  status: 'flying' | 'arrived' | 'blocked';
  algo: Algo;
  mode: 'demo' | 'manual';
  obstacles: number;
  wind: number;
  route: number[];
  goal: { x: number; y: number };
  drone: { x: number; y: number };
  /** Simulation ticks run since mount, by either clock. */
  frames: number;
  /** Simulated milliseconds since mount. */
  simTime: number;
  clock: 'raf' | 'manual';
}

interface Snap {
  algo: Algo;
  status: 'flying' | 'arrived' | 'blocked';
  expanded: number;
  ms: number;
  cost: number;
  replans: number;
  astar: number;
  dstar: number;
  totalAstar: number;
  totalDstar: number;
}

function snapshot(m: DroneModel): Snap {
  const p = m.lastPlan;
  return {
    algo: m.algo,
    status: m.status,
    expanded: p?.expanded ?? 0,
    ms: p?.ms ?? 0,
    cost: p?.cost ?? -1,
    replans: m.replans,
    astar: m.compare.astar?.expanded ?? 0,
    dstar: m.compare.dstar?.expanded ?? 0,
    totalAstar: m.totals.astar,
    totalDstar: m.totals.dstar,
  };
}

type Tier = { cols: number; rows: number };

/** Grid size for the width the map gets: 40x24 on desktop, fewer columns on narrow screens. */
export function tierFor(stageWidth: number): Tier {
  if (stageWidth <= 0 || stageWidth >= 700) return { cols: 40, rows: 24 };
  if (stageWidth >= 440) return { cols: 28, rows: 20 };
  return { cols: 20, rows: 22 };
}

const SIDE_PANEL = 340;
const SIDE_BREAKPOINT = 900;

/** Estimates the map width from the whole rig width (the panel sits beside it on wide screens). */
function stageWidthFor(hostWidth: number): number {
  return hostWidth >= SIDE_BREAKPOINT ? hostWidth - SIDE_PANEL : hostWidth;
}

/** Cells on the line from a to b, inclusive, so a fast drag leaves no gaps. */
function lineCells(ax: number, ay: number, bx: number, by: number): [number, number][] {
  const out: [number, number][] = [];
  let x = ax;
  let y = ay;
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 400; guard++) {
    out.push([x, y]);
    if (x === bx && y === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/**
 * The drone rig: a city map, a drone that flies across it, tools to block its way, and a bench
 * readout of what the planners measured. Picks a grid size from the width it gets and remounts
 * the simulation when that changes.
 */
export function DroneRig(props: DroneRigProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<Tier>(() =>
    tierFor(
      typeof window === 'undefined' ? 0 : stageWidthFor(Math.min(window.innerWidth - 48, 1216)),
    ),
  );
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[entries.length - 1]?.contentRect.width ?? 0;
      const next = tierFor(stageWidthFor(w));
      setTier((cur) => (cur.cols === next.cols && cur.rows === next.rows ? cur : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={hostRef} className="drone-host">
      <Rig key={`${tier.cols}x${tier.rows}`} {...props} cols={tier.cols} rows={tier.rows} />
    </div>
  );
}

interface RigProps extends DroneRigProps {
  cols: number;
  rows: number;
}

function Rig({
  seed = 7,
  autoRun = true,
  expose = false,
  regoalMs = 2500,
  clock = 'raf',
  cols,
  rows,
}: RigProps) {
  const [model] = useState(() => new DroneModel({ cols, rows, seed, algo: 'astar', regoalMs }));
  const [snap, setSnap] = useState<Snap>(() => snapshot(model));
  const [live, setLive] = useState('');
  const [mode, setMode] = useState<'demo' | 'manual'>(autoRun ? 'demo' : 'manual');
  const [tool, setTool] = useState<Tool | 'goal'>('obstacle');
  const [erase, setErase] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [ready, setReady] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [viewRef, inView] = useInView<HTMLDivElement>({ threshold: 0.05 });
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DroneRenderer | null>(null);

  // values the native pointer handlers and the frame loop read without re-subscribing
  const live_ = useRef({
    tool: 'obstacle' as Tool | 'goal',
    erase: false,
    drawMode: false,
    mode: autoRun ? ('demo' as const) : ('manual' as const),
    reduced: false,
    animating: false,
  });
  const ptr = useRef({
    cell: -1,
    down: false,
    eraseNow: false,
    trail: [] as { cell: number; t: number }[],
    dirty: false,
    lastOutcome: null as Outcome | null,
  });
  const seen = useRef({ planVersion: -1, status: '', frames: 0 });
  const timing = useRef<number[]>([]);
  const plans = useRef<PlanRecord[]>([]);
  const lastReplans = useRef(0);

  useEffect(() => {
    live_.current.tool = tool;
    live_.current.erase = erase;
    live_.current.drawMode = drawMode;
    live_.current.mode = mode;
    live_.current.reduced = reduced;
    model.setAutoplay(autoRun && mode === 'demo' && !reduced);
  }, [tool, erase, drawMode, mode, reduced, model, autoRun]);

  const refresh = useCallback(() => {
    const s = snapshot(model);
    seen.current.planVersion = model.planVersion;
    seen.current.status = model.status;
    setSnap(s);
    if (model.replans !== lastReplans.current) {
      lastReplans.current = model.replans;
      const a = model.compare.astar;
      const d = model.compare.dstar;
      if (a && d) {
        plans.current.push({
          astarMs: a.ms,
          dstarMs: d.ms,
          astarNodes: a.expanded,
          dstarNodes: d.expanded,
        });
      }
    }
  }, [model]);

  const pointerView = useCallback(
    (): PointerView => ({
      cell: ptr.current.cell,
      tool: live_.current.tool,
      erase: ptr.current.eraseNow || live_.current.erase,
      down: ptr.current.down,
      trail: ptr.current.trail,
    }),
    [],
  );

  /** One still frame: used when no loop runs (reduced motion, off screen) and after changes. */
  const drawStill = useCallback(() => {
    rendererRef.current?.draw(0, false, undefined);
  }, []);

  const interact = useCallback(() => {
    if (live_.current.mode === 'manual') return;
    live_.current.mode = 'manual';
    setMode('manual');
    model.setAutoplay(false);
    log.debug('visitor took over', {});
  }, [model]);

  const announce = useCallback(
    (out: Outcome | null) => {
      refresh();
      if (out) setLive(out.text);
      if (live_.current.reduced) drawStill();
    },
    [refresh, drawStill],
  );

  // renderer + sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setReady(true);
      return;
    }
    const renderer = new DroneRenderer(canvas, ctx, model, readPalette(stage));
    rendererRef.current = renderer;
    const fit = () => {
      renderer.resize(stage.clientWidth || 960);
      renderer.draw(0, !live_.current.reduced && live_.current.animating, undefined);
    };
    fit();
    setReady(true);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit);
      ro.observe(stage);
    }
    return () => {
      ro?.disconnect();
      rendererRef.current = null;
    };
  }, [model]);

  // frame loop: simulate, apply pending paint, draw
  const active = inView && !reduced && clock === 'raf';
  useEffect(() => {
    live_.current.animating = active;
  }, [active]);

  /** One simulation tick: pending paint, time, and a React refresh when something changed. */
  const advance = useCallback(
    (dt: number) => {
      const p = ptr.current;
      if (p.dirty) {
        p.dirty = false;
        const out = model.flush();
        if (out) p.lastOutcome = out;
      }
      const ev = model.step(dt);
      if (ev && live_.current.mode === 'manual') setLive(ev.text);
      if (
        ev ||
        model.planVersion !== seen.current.planVersion ||
        model.status !== seen.current.status
      ) {
        refresh();
      }
      seen.current.frames++;
    },
    [model, refresh],
  );
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);
  const clockT = useRef(0);

  useRafLoop((dt, t) => {
    const t0 = performance.now();
    advance(dt);
    rendererRef.current?.draw(t, true, pointerView());
    const ms = performance.now() - t0;
    const buf = timing.current;
    buf.push(ms);
    if (buf.length > 600) buf.shift();
  }, active);

  // out of view or reduced motion: keep the picture current without a loop
  useEffect(() => {
    if (!active) rendererRef.current?.draw(0, false, undefined);
  }, [active, snap, ready]);

  // pointer painting, attached natively so the canvas stays a plain element
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = () => rendererRef.current;
    if (!canvas) return;
    const cellOf = (e: PointerEvent): number => {
      const r = renderer();
      if (!r) return -1;
      const box = canvas.getBoundingClientRect();
      const sx = box.width > 0 ? r.width / box.width : 1;
      return r.cellAt((e.clientX - box.left) * sx, (e.clientY - box.top) * sx);
    };
    const paintCell = (c: number) => {
      const x = c % cols;
      const y = Math.floor(c / cols);
      const tl = live_.current.tool;
      if (tl === 'goal') return;
      const changed = model.paint(x, y, tl, ptr.current.eraseNow || live_.current.erase);
      if (changed) {
        ptr.current.dirty = true;
        ptr.current.trail.push({ cell: c, t: performance.now() });
        if (ptr.current.trail.length > 24) ptr.current.trail.shift();
      }
    };
    const settle = () => {
      if (!live_.current.animating) {
        const out = model.flush();
        if (out) ptr.current.lastOutcome = out;
        ptr.current.dirty = false;
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !live_.current.drawMode) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const c = cellOf(e);
      if (c < 0) return;
      e.preventDefault();
      interact();
      canvas.setPointerCapture(e.pointerId);
      ptr.current.down = true;
      ptr.current.eraseNow = e.altKey || e.shiftKey;
      ptr.current.cell = c;
      ptr.current.lastOutcome = null;
      if (live_.current.tool === 'goal') {
        const out = model.setGoal(c % cols, Math.floor(c / cols));
        if (out) ptr.current.lastOutcome = out;
      } else {
        paintCell(c);
      }
      settle();
      announce(ptr.current.lastOutcome);
    };
    let lastBatch = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !live_.current.drawMode) return;
      const c = cellOf(e);
      const prev = ptr.current.cell;
      ptr.current.cell = c;
      if (!ptr.current.down || c < 0) {
        if (!live_.current.animating) renderer()?.draw(0, false, pointerView());
        return;
      }
      if (live_.current.tool !== 'goal') {
        if (prev >= 0 && prev !== c) {
          for (const [x, y] of lineCells(
            prev % cols,
            Math.floor(prev / cols),
            c % cols,
            Math.floor(c / cols),
          )) {
            paintCell(y * cols + x);
          }
        } else {
          paintCell(c);
        }
        settle();
        const now = performance.now();
        if (!live_.current.animating && now - lastBatch > 40) {
          lastBatch = now;
          announce(null);
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!ptr.current.down) return;
      ptr.current.down = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const c = cellOf(e);
      if (live_.current.tool === 'goal' && c >= 0) {
        const out = model.setGoal(c % cols, Math.floor(c / cols));
        if (out) ptr.current.lastOutcome = out;
      }
      if (ptr.current.dirty) {
        const out = model.flush();
        if (out) ptr.current.lastOutcome = out;
        ptr.current.dirty = false;
      }
      announce(ptr.current.lastOutcome);
      ptr.current.eraseNow = false;
    };
    const onLeave = () => {
      if (!ptr.current.down) ptr.current.cell = -1;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [model, cols, interact, announce, pointerView]);

  // test probe
  useEffect(() => {
    if (!expose) return;
    const probe: DroneProbe = {
      state: () => ({
        ...model.state(),
        mode: live_.current.mode,
        frames: seen.current.frames,
        simTime: model.simTime,
        clock,
      }),
      step: (n, dtMs = 16) => {
        for (let i = 0; i < n; i++) {
          clockT.current += dtMs;
          advanceRef.current(dtMs);
        }
        rendererRef.current?.draw(clockT.current, !live_.current.reduced, pointerView());
        return {
          ...model.state(),
          mode: live_.current.mode,
          frames: seen.current.frames,
          simTime: model.simTime,
          clock,
        };
      },
      loopActive: () => live_.current.animating,
      timing: () => {
        const xs = [...timing.current].sort((a, b) => a - b);
        const n = xs.length;
        const mean = n ? xs.reduce((a, b) => a + b, 0) / n : 0;
        return { frames: n, mean, p95: xs[Math.floor(n * 0.95)] ?? 0, max: xs[n - 1] ?? 0 };
      },
      plans: () => [...plans.current],
    };
    (window as unknown as { __drone?: DroneProbe }).__drone = probe;
    return () => {
      delete (window as unknown as { __drone?: DroneProbe }).__drone;
    };
  }, [expose, model, clock, pointerView]);

  // buttons
  const run = (fn: () => Outcome | null) => {
    interact();
    announce(fn());
  };
  const pickTool = (t: Tool | 'goal') => {
    interact();
    setTool(t);
  };

  const status =
    snap.status === 'blocked'
      ? 'No route: holding'
      : snap.status === 'arrived'
        ? 'Arrived'
        : 'Flying';
  const maxNodes = Math.max(1, snap.astar, snap.dstar);
  const algoName = snap.algo === 'astar' ? 'A*' : 'D* Lite';

  return (
    <div
      ref={viewRef}
      className="drone"
      data-testid="drone-demo"
      data-mode={mode}
      data-motion={reduced ? 'static' : 'live'}
      data-clock={clock}
      data-ready={ready ? 'true' : 'false'}
      data-status={snap.status}
    >
      <div className="drone__map">
        <p className="drone__invite" data-testid="drone-invite">
          Get in its way. It won&apos;t take it personally. It re-plans.
        </p>
        <div
          className="drone__stage"
          ref={stageRef}
          data-cursor="draw"
          data-cursor-label="draw"
          style={{ aspectRatio: `${cols} / ${rows}` }}
        >
          <canvas
            ref={canvasRef}
            className="drone__canvas"
            data-testid="drone-canvas"
            data-draw={drawMode ? 'true' : 'false'}
            data-tool={tool}
            role="img"
            aria-label="City map. A drone flies from the left edge to the goal on the right. Use the buttons below the map, or drag on the map, to block its route."
          />
          <p className="drone__status" data-testid="drone-status">
            <span className="drone__dot" aria-hidden="true" />
            {status}
          </p>
        </div>
        <div className="drone__toolbar">
          <div className="drone__row" role="group" aria-label="Drawing tool">
            {(
              [
                ['obstacle', 'Obstacle'],
                ['wind', 'Wind'],
                ['goal', 'Move goal'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                className="drone__chip"
                aria-pressed={tool === id}
                data-testid={`drone-tool-${id}`}
                onClick={() => pickTool(id)}
              >
                {label}
              </Button>
            ))}
            <Button
              className="drone__chip"
              aria-pressed={erase}
              data-testid="drone-erase"
              onClick={() => {
                interact();
                setErase((v) => !v);
              }}
            >
              Erase
            </Button>
            <Button
              className="drone__chip"
              aria-pressed={drawMode}
              data-testid="drone-draw-mode"
              onClick={() => {
                interact();
                setDrawMode((v) => !v);
              }}
            >
              Draw mode
            </Button>
          </div>
          <p className="drone__hint">
            Drag on the map to place obstacles; hold Shift or Alt to erase. On touch, turn on Draw
            mode first so the page still scrolls.
          </p>
        </div>
      </div>

      <div className="drone__panel">
        <div className="drone__row" role="group" aria-label="Route actions">
          <Button
            className="drone__chip drone__chip--wide"
            data-testid="drone-btn-drop"
            onClick={() => run(() => model.dropObstacleOnRoute())}
          >
            Drop obstacle on the route
          </Button>
          <Button
            className="drone__chip"
            data-testid="drone-btn-wind"
            onClick={() => run(() => model.addWindZone())}
          >
            Add wind zone
          </Button>
          <Button
            className="drone__chip"
            data-testid="drone-btn-goal"
            onClick={() => run(() => model.newGoal())}
          >
            New goal
          </Button>
          <Button
            className="drone__chip"
            data-testid="drone-btn-reset"
            onClick={() => run(() => model.reset())}
          >
            Reset
          </Button>
        </div>

        <div className="drone__row" role="group" aria-label="Planner">
          <Button
            className="drone__chip"
            aria-pressed={snap.algo === 'astar'}
            data-testid="drone-algo-astar"
            onClick={() => run(() => model.setAlgo('astar'))}
          >
            A*
          </Button>
          <Button
            className="drone__chip"
            aria-pressed={snap.algo === 'dstar'}
            data-testid="drone-algo-dstar"
            onClick={() => run(() => model.setAlgo('dstar'))}
          >
            D* Lite
          </Button>
        </div>

        <section className="drone__bench" aria-label="Planner readout">
          <dl className="drone__readout mono">
            <div>
              <dt>Algorithm</dt>
              <dd data-testid="drone-readout-algorithm">{algoName}</dd>
            </div>
            <div>
              <dt>Nodes expanded</dt>
              <dd data-testid="drone-readout-expanded">{formatCount(snap.expanded)}</dd>
            </div>
            <div>
              <dt>Re-plan time</dt>
              <dd data-testid="drone-readout-time">{formatMs(snap.ms)}</dd>
            </div>
            <div>
              <dt>Path cost</dt>
              <dd data-testid="drone-readout-cost">{formatCost(snap.cost)}</dd>
            </div>
            <div>
              <dt>Re-plans</dt>
              <dd data-testid="drone-readout-replans">{snap.replans}</dd>
            </div>
          </dl>
          <div
            className="drone__compare mono"
            aria-label="Nodes expanded by each planner on the last plan"
          >
            <p className="drone__compare-title">Last plan, nodes expanded</p>
            {(
              [
                ['astar', 'A*', snap.astar, snap.totalAstar],
                ['dstar', 'D* Lite', snap.dstar, snap.totalDstar],
              ] as const
            ).map(([id, name, n, total]) => (
              <div key={id} className={`drone__bar drone__bar--${id}`}>
                <span className="drone__bar-name">{name}</span>
                <span className="drone__bar-track" aria-hidden="true">
                  <span
                    className="drone__bar-fill"
                    style={{ width: `${Math.max(3, (n / maxNodes) * 100)}%` }}
                  />
                </span>
                <span className="drone__bar-n" data-testid={`drone-compare-${id}`}>
                  {formatCount(n)}
                </span>
                <span className="drone__bar-total">
                  total <span data-testid={`drone-compare-total-${id}`}>{formatCount(total)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="drone__live mono" role="status" aria-live="polite" data-testid="drone-live">
            {live}
          </p>
        </section>

        <p className="drone__caption mono" data-testid="drone-caption">
          Bench rig: this planner runs in TypeScript in your browser. The real project is C++17
          compiled to WebAssembly.
        </p>
      </div>
    </div>
  );
}

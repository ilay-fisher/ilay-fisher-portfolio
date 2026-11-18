import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createLogger } from '../../../lib/logger';
import { useInView, usePrefersReducedMotion } from '../../../lib/motion';
import { analyzePreset, fallbackAnalysis, type Analysis, type AnalyzeFn } from './analysis';
import { clampPercent, handleLeft, sliderToClip, sliderValueText, sweepValue } from './clip';
import { pairLayout } from './crop';
import { BENCHMARK, PRESETS, diagnosisFor, type Diagnosis, type Preset } from './data';
import { formatMs, formatPct, formatTokens } from './readout';
import { runStream } from './stream';
import './XRay.css';

const log = createLogger('xray');
const SWEEP_MS = 2600;
const STREAM_CPS = 90;
const SEVERITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
} as const;

/** Props of {@link XRayDemo}. */
export interface XRayDemoProps {
  /** Replaces the real client-side diff. Used by tests and to exercise the fallback path. */
  analyze?: AnalyzeFn;
}

const humanCategory = (c: string): string => c.replace(/_/g, ' ');

/** Plain-language sentence announced once a diagnosis has finished. */
function announcement(n: number, total: number, d: Diagnosis): string {
  const sev = d.severity ? `, ${d.severity} severity` : '';
  const conf =
    d.confidence !== null ? `, ${Math.round(d.confidence * 100)} percent confidence` : '';
  return `Region ${n} of ${total}: ${humanCategory(d.category)}${sev}${conf}. ${d.description}`;
}

/** Paints RGBA heat into a canvas; failures (no 2D context) are logged, not thrown. */
function paintHeat(canvas: HTMLCanvasElement | null, heat: Analysis['heat']) {
  if (!canvas || heat.width === 0) return;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(heat.rgba), heat.width, heat.height),
      0,
      0,
    );
  } catch (err) {
    log.error('could not paint heatmap', err);
  }
}

/** A baseline or target crop drawn with CSS background positioning, no canvas needed. */
function Crop({
  src,
  preset,
  box,
  label,
}: {
  src: string;
  preset: Preset;
  box: { x: number; y: number; w: number; h: number };
  label: string;
}) {
  const px = preset.width - box.w > 0 ? (box.x / (preset.width - box.w)) * 100 : 0;
  const py = preset.height - box.h > 0 ? (box.y / (preset.height - box.h)) * 100 : 0;
  return (
    <figure className="xray__crop">
      <div
        className="xray__crop-img"
        role="img"
        aria-label={label}
        style={{
          aspectRatio: `${box.w} / ${box.h}`,
          backgroundImage: `url(${src})`,
          backgroundSize: `${(preset.width / box.w) * 100}% ${(preset.height / box.h) * 100}%`,
          backgroundPosition: `${px}% ${py}%`,
        }}
      />
      <figcaption className="mono">{label}</figcaption>
    </figure>
  );
}

/**
 * The X-Ray Lens rig: a split slider over the target image (diff heatmap on one side), regions of
 * interest found by the diff stage, and a replayed diagnosis for the selected region. The diff runs
 * in this browser; the diagnosis is a recorded result, never a live model call.
 */
export function XRayDemo({ analyze = analyzePreset }: XRayDemoProps) {
  const reduced = usePrefersReducedMotion();
  const [presetId, setPresetId] = useState<Preset['id']>('pcb');
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [value, setValue] = useState(50);
  const [selected, setSelected] = useState<number | null>(null);
  const [guess, setGuess] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const [stream, setStream] = useState({ key: '', visible: 0, done: false });

  const [rigRef, rigInView] = useInView<HTMLDivElement>({ rootMargin: '200px 0px' });
  const [stageRef, stageInView] = useInView<HTMLDivElement>({ threshold: 0.5 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swept = useRef(false);
  const touched = useRef(false);
  const sweepId = useRef(0);
  const descId = useId();
  const canObserve = typeof IntersectionObserver !== 'undefined';
  const started = rigInView || !canObserve;

  useEffect(() => {
    log.info('demo mounted');
    return () => log.info('demo unmounted');
  }, []);

  // Run the diff for the current preset once the rig is near the viewport.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    analyze(preset)
      .then((a) => {
        if (!cancelled) setAnalysis(a);
      })
      .catch((err: unknown) => {
        log.warn('pixel access failed, using the precomputed heatmap and regions', err);
        if (!cancelled) setAnalysis(fallbackAnalysis(preset));
      });
    return () => {
      cancelled = true;
    };
  }, [analyze, preset, started]);

  useEffect(() => {
    if (analysis?.source === 'computed') paintHeat(canvasRef.current, analysis.heat);
  }, [analysis]);

  const stopSweep = useCallback(() => {
    if (sweepId.current) cancelAnimationFrame(sweepId.current);
    sweepId.current = 0;
  }, []);

  // One intro sweep the first time the stage is in view with a result to show.
  useEffect(() => {
    if (reduced || swept.current || touched.current || !stageInView || !analysis || guess) return;
    swept.current = true;
    log.info('intro sweep');
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / SWEEP_MS;
      setValue(sweepValue(t));
      sweepId.current = t < 1 ? requestAnimationFrame(frame) : 0;
    };
    sweepId.current = requestAnimationFrame(frame);
    return stopSweep;
  }, [reduced, stageInView, analysis, guess, stopSweep]);

  const regions = useMemo(() => (analysis ? analysis.regions : []), [analysis]);
  const sel = selected !== null ? regions[selected] : undefined;
  const diag = sel ? diagnosisFor(preset, sel) : undefined;

  // Replay the recorded description for the selected region.
  useEffect(() => {
    if (!diag) return;
    const key = `${presetId}:${selected}`;
    log.debug('replay start', { region: selected, category: diag.category });
    return runStream(diag.description, {
      cps: STREAM_CPS,
      reduced,
      onProgress: (n) => setStream({ key, visible: n, done: false }),
      onDone: () => {
        setStream((st) => ({ ...st, key, done: true }));
        log.debug('replay done');
      },
    });
  }, [diag, reduced, selected, presetId]);

  const selectPreset = (id: Preset['id']) => {
    if (id === presetId) return;
    log.info('preset switch', { to: id });
    stopSweep();
    setPresetId(id);
    setAnalysis(null);
    setSelected(null);
    setValue(50);
    setGuess(false);
    setShowBase(false);
  };
  const reset = () => {
    log.debug('reset');
    stopSweep();
    setSelected(null);
    setValue(50);
    setGuess(false);
    setShowBase(false);
  };
  const onSlide = (v: number) => {
    stopSweep();
    touched.current = true;
    if (guess) setGuess(false);
    setValue(clampPercent(v));
  };
  const toggleGuess = () => {
    stopSweep();
    touched.current = true;
    if (guess) {
      log.debug('reveal');
      setGuess(false);
      setValue(50);
    } else {
      log.debug('guess first');
      setGuess(true);
      setSelected(null);
      setShowBase(false);
      setValue(0);
    }
  };

  const shown = guess ? 0 : value;
  const total = regions.length;
  const layout = sel ? pairLayout(sel) : null;
  const live = stream.key === `${presetId}:${selected}`;
  const visible = live ? stream.visible : 0;
  const done = live && stream.done;
  const text = diag ? diag.description.slice(0, visible) : '';

  return (
    <div className="xray" data-testid="xray-demo" ref={rigRef}>
      <div className="xray__bar">
        <div
          className="xray__presets"
          role="group"
          aria-label="Sample pair"
          data-testid="xray-preset"
        >
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="xray__chip mono"
              aria-pressed={p.id === presetId}
              data-testid={`xray-preset-${p.id}`}
              onClick={() => selectPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="xray__tools">
          <button type="button" className="xray__chip mono" onClick={toggleGuess}>
            {guess ? 'Reveal' : 'Guess first'}
          </button>
          <button
            type="button"
            className="xray__chip mono"
            aria-pressed={showBase}
            onClick={() => setShowBase((v) => !v)}
          >
            Show baseline
          </button>
          <button type="button" className="xray__chip mono" onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      <p className="xray__hint">
        {guess
          ? 'Look at the target, flip to the baseline, and spot what changed. Then reveal.'
          : 'Drag the slider. The heatmap is on the left, the plain target on the right.'}
      </p>

      <div className="xray__grid">
        <div className="xray__main">
          <div
            className="xray__stage"
            ref={stageRef}
            style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
            data-testid="xray-stage"
          >
            <img
              className="xray__img"
              src={preset.target}
              alt={preset.alt}
              data-testid="xray-target-image"
              width={preset.width}
              height={preset.height}
            />
            <div
              className="xray__heat"
              data-testid="xray-heatmap"
              data-source={analysis?.source ?? 'pending'}
              style={{ clipPath: sliderToClip(shown) }}
            >
              {analysis?.source === 'computed' && (
                <canvas ref={canvasRef} width={analysis.heat.width} height={analysis.heat.height} />
              )}
              {analysis?.source === 'fallback' && <img src={preset.heatFallback} alt="" />}
            </div>
            <img
              className="xray__img xray__base"
              src={preset.baseline}
              alt={showBase ? 'Baseline image, before the change' : ''}
              aria-hidden={!showBase}
              data-testid="xray-baseline-image"
              data-shown={showBase}
              width={preset.width}
              height={preset.height}
            />
            {analysis && !guess && (
              <>
                <svg
                  className="xray__boxes"
                  viewBox={`0 0 ${preset.width} ${preset.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {regions.map((r, i) => (
                    <rect
                      key={`${presetId}-${i}`}
                      className={i === selected ? 'is-selected' : undefined}
                      style={{ animationDelay: `${120 * i}ms` }}
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      pathLength={1}
                    />
                  ))}
                </svg>
                {regions.map((r, i) => (
                  <button
                    key={`${presetId}-b${i}`}
                    type="button"
                    className="xray__region"
                    data-testid={`xray-region-${i + 1}`}
                    aria-label={`Region ${i + 1} of ${total}`}
                    aria-pressed={i === selected}
                    aria-controls={descId}
                    style={{
                      left: `${(r.x / preset.width) * 100}%`,
                      top: `${(r.y / preset.height) * 100}%`,
                      width: `${(r.w / preset.width) * 100}%`,
                      height: `${(r.h / preset.height) * 100}%`,
                    }}
                    onClick={() => {
                      log.debug('region selected', { region: i + 1 });
                      setSelected(i);
                    }}
                  >
                    <span className="xray__num mono" aria-hidden="true">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </>
            )}
            <div className="xray__handle" aria-hidden="true" style={{ left: handleLeft(shown) }}>
              <span className="xray__grip" />
            </div>
            <input
              className="xray__range"
              type="range"
              min={0}
              max={100}
              step={1}
              value={shown}
              data-testid="xray-slider"
              aria-label="Compare the diff heatmap with the plain target"
              aria-valuetext={sliderValueText(shown)}
              onChange={(e) => onSlide(Number(e.target.value))}
              onPointerDown={() => {
                stopSweep();
                touched.current = true;
              }}
            />
            {!analysis && <p className="xray__busy mono">Computing the diff in this browser</p>}
          </div>
          <p className="xray__caption mono">
            {analysis?.source === 'computed' && analysis.ms !== null
              ? `Diff computed in this browser in ${formatMs(analysis.ms)}.`
              : analysis?.source === 'fallback'
                ? 'Pixel access failed here. Showing a precomputed heatmap.'
                : 'Preparing the diff.'}{' '}
            {total > 0 && !guess ? `${total} ${total === 1 ? 'region' : 'regions'} found.` : ''}
          </p>
        </div>

        <aside className="xray__panel" data-testid="xray-diagnosis" aria-label="Diagnosis">
          {!diag || !sel || !layout ? (
            <p className="xray__idle">
              {guess
                ? 'Reveal the heatmap, then select a region.'
                : 'Select a region to see what the model is asked.'}
            </p>
          ) : (
            <>
              <h3 className="xray__panel-title">
                Region {(selected ?? 0) + 1} of {total}: {diag.label}
              </h3>
              <div className="xray__pair" data-testid="xray-crop-pair">
                <Crop src={preset.baseline} preset={preset} box={sel} label="baseline" />
                <Crop src={preset.target} preset={preset} box={sel} label="target" />
              </div>
              <p className="xray__sent mono">
                Composite sent to the model: {layout.width} x {layout.height} px
                {layout.scale > 1 ? `, crop upscaled ${layout.scale}x` : ''}
              </p>
              <dl className="xray__fields">
                <div>
                  <dt>Category</dt>
                  <dd className="mono">{diag.category}</dd>
                </div>
                <div>
                  <dt>Severity</dt>
                  <dd className={diag.severity ? 'xray__sev' : 'xray__na'}>
                    {diag.severity ? SEVERITY_LABEL[diag.severity] : 'not recorded'}
                  </dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd className={diag.confidence !== null ? 'mono' : 'xray__na'}>
                    {diag.confidence !== null
                      ? `${Math.round(diag.confidence * 100)}%`
                      : 'not recorded'}
                  </dd>
                </div>
              </dl>
              <p
                id={descId}
                className={`xray__desc${done ? ' is-done' : ''}`}
                data-testid="xray-description"
                aria-hidden={!done}
              >
                {text}
              </p>
              <p className="visually-hidden" role="status" aria-live="polite">
                {done ? announcement((selected ?? 0) + 1, total, diag) : ''}
              </p>
              <p className="xray__note mono" data-testid="xray-replay-note">
                <strong>Recorded result, replayed from a real run. Not a live model call.</strong>{' '}
                {diag.provenance}
              </p>
            </>
          )}
        </aside>
      </div>

      <div className="xray__readout" data-testid="xray-readout">
        <h3 className="xray__readout-title">Why it matters</h3>
        <p className="xray__readout-lead">
          The model never sees the whole frame, only the regions that changed.
        </p>
        <dl className="xray__bench">
          <div>
            <dt>Image tokens, full frame</dt>
            <dd>
              <span className="xray__bar-fill xray__bar-fill--full" style={{ width: '100%' }} />
              <span className="mono">{formatTokens(BENCHMARK.fullTokens)}</span>
            </dd>
          </div>
          <div>
            <dt>Image tokens, ROI crops</dt>
            <dd>
              <span
                className="xray__bar-fill"
                style={{ width: `${(BENCHMARK.roiTokens[1] / BENCHMARK.fullTokens) * 100}%` }}
              />
              <span className="mono">
                {BENCHMARK.roiTokens[0]} to {BENCHMARK.roiTokens[1]}
              </span>
            </dd>
          </div>
          <div>
            <dt>Cloud time, full frame</dt>
            <dd>
              <span className="xray__bar-fill xray__bar-fill--full" style={{ width: '100%' }} />
              <span className="mono">{formatMs(BENCHMARK.cloudMs.full)}</span>
            </dd>
          </div>
          <div>
            <dt>Cloud time, ROI crops</dt>
            <dd>
              <span
                className="xray__bar-fill"
                style={{ width: `${(BENCHMARK.cloudMs.roi / BENCHMARK.cloudMs.full) * 100}%` }}
              />
              <span className="mono">{formatMs(BENCHMARK.cloudMs.roi)}</span>
            </dd>
          </div>
        </dl>
        <p className="xray__summary">
          About 95% fewer image tokens. Cloud latency {formatPct(BENCHMARK.cloudLatencySavedPct)}{' '}
          lower.
        </p>
        <p className="xray__note mono">
          Benchmark figures from the project README, Claude Haiku 5.5. Cloud times are totals: one
          full-frame call per preset (three) versus the four ROI calls.
        </p>
        <p className="xray__measured mono" data-testid="xray-measured">
          {analysis?.source === 'computed' && analysis.ms !== null
            ? `Diff on this device: ${formatMs(analysis.ms)}, measured here, no server involved.`
            : analysis
              ? 'Diff on this device: not measured, the precomputed result was used.'
              : 'Diff on this device: measuring.'}
        </p>
      </div>
    </div>
  );
}

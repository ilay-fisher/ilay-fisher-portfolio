import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Button } from '../../../components/Button/Button';
import { createLogger } from '../../../lib/logger';
import { useInView, usePrefersReducedMotion } from '../../../lib/motion';
import { isWebGLAvailable } from '../../../lib/webgl';
import { BYPASSES, PAGES, mediaOf, type MediaItem } from './content';
import type { BurnStage } from './BurnStage';
import {
  initialRules,
  remainingMs,
  rulesReducer,
  visibility,
  type BypassId,
  type PageId,
  type Scope,
} from './rules';
import { describeRequest, formatAnnouncement, formatStatus } from './status';
import './SafeSurf.css';

const log = createLogger('safesurf');

/** Props for {@link SafeSurfDemo}. */
export interface SafeSurfDemoProps {
  /** How long a loosening waits, in ms. The product uses an hour; the rig compresses it. Default 8000. */
  delayMs?: number;
  /** Capture hook: the burn advances only on `safesurf:step` events (see BurnStage). Default false. */
  manualClock?: boolean;
}

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const secondsLabel = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${s} ${s === 1 ? 'second' : 'seconds'}`;
};

/** Points the burn stage at the current rules: every image blocked or allowed, burning when `animate`. */
function syncStage(
  stage: BurnStage | null,
  scroller: HTMLElement | null,
  imagesVisible: boolean,
  videoVisible: boolean,
  animate: boolean,
): void {
  if (!stage || !scroller) return;
  stage.setItems(Array.from(scroller.querySelectorAll<HTMLImageElement>('img.ss-media__img')));
  stage.apply((img) => {
    const isVideo = img.closest('[data-ss-media]')?.getAttribute('data-ss-media') === 'video';
    return isVideo ? !videoVisible : !imagesVisible;
  }, animate);
}

/** A 16 px inline icon: a picture frame with a slash through it. */
function BlockedIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="1.75" y="2.75" width="12.5" height="10.5" />
      <path d="M2 13.5 14 2.5" />
    </svg>
  );
}

function Media({ item, blocked, n }: { item: MediaItem; blocked: boolean; n: number }) {
  const video = item.kind === 'video';
  return (
    <figure
      className="ss-media"
      data-ss-media={item.kind}
      data-state={blocked ? 'blocked' : 'allowed'}
      data-testid={`safesurf-media-${item.id}`}
      style={{ '--i': n } as CSSProperties}
    >
      <div className="ss-media__frame">
        <div className="ss-media__tile">
          <span className="ss-media__tag mono">
            {video ? 'Video' : 'Image'} {n + 1}
          </span>
          <span className="ss-media__msg mono">
            <BlockedIcon />
            {video ? 'Video blocked' : 'Image blocked'}
          </span>
          <span className="ss-media__sub mono">Withheld by SafeSurf</span>
        </div>
        <img
          className="ss-media__img"
          src={item.src}
          alt={blocked ? '' : item.alt}
          aria-hidden={blocked || undefined}
          width={item.width}
          height={item.height}
          decoding="async"
        />
        {video && <span className="ss-media__play" aria-hidden="true" />}
      </div>
      <figcaption>{item.caption}</figcaption>
    </figure>
  );
}

/**
 * The SafeSurf rig: a mock phone browser with a mock article, and a bench panel to try the
 * product's two ideas. Block images, not sites (allow per site, page or video), and tighten
 * instantly, loosen after a delay (queued behind a countdown, or approved by a sponsor).
 * Everything is a simulation in the browser. The burn is one shared WebGL2 canvas; without
 * WebGL2, or under reduced motion, it is a CSS fade or an instant swap.
 */
export function SafeSurfDemo({ delayMs = 8000, manualClock = false }: SafeSurfDemoProps) {
  const [state, dispatch] = useReducer(rulesReducer, delayMs, initialRules);
  const [now, setNow] = useState(() => Date.now());
  const [lastBypass, setLastBypass] = useState<BypassId | null>(null);
  const [render, setRender] = useState<'css' | 'webgl'>('css');
  const reduced = usePrefersReducedMotion();
  const [rootRef, inView] = useInView<HTMLDivElement>({ rootMargin: '100% 0px' });
  const [wantGl, setWantGl] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<BurnStage | null>(null);
  const switchLabelId = useId();
  const deviceRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  const vis = visibility(state);
  const page = PAGES[state.page];
  const media = mediaOf(page);
  const imageCount = media.filter((m) => m.kind === 'image').length;
  const videoCount = media.length - imageCount;
  const hasVideo = videoCount > 0;
  const remaining = remainingMs(state, now);
  const pending = state.pending;

  const statusInput = {
    filter: state.filter,
    imageCount,
    videoCount,
    imagesVisible: vis.images,
    videoVisible: vis.video,
  };
  const status = formatStatus({ ...statusInput, remainingMs: pending ? remaining : null });
  const announcement = formatAnnouncement(state.lastEvent, {
    delayLabel: secondsLabel(state.delayMs),
    statusNoClock: formatStatus({ ...statusInput, remainingMs: null }),
  });
  const delaySeconds = Math.round(state.delayMs / 1000);

  // Time only runs while a request waits.
  useEffect(() => {
    if (!state.pending) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, 100);
    return () => window.clearInterval(id);
  }, [state.pending]);

  const act = useCallback((a: 'allowSite' | 'allowPage' | 'allowVideo' | 'filter') => {
    const t = Date.now();
    setNow(t);
    if (a === 'filter') dispatch({ type: 'toggleFilter', now: t });
    else {
      const scope: Scope = a === 'allowSite' ? 'site' : a === 'allowPage' ? 'page' : 'video';
      dispatch({ type: 'requestAllow', scope, now: t });
    }
  }, []);

  useEffect(() => {
    if (state.lastEvent) log.info('rules event', state.lastEvent);
  }, [state.lastEvent]);

  useEffect(() => {
    log.info('demo mounted', { delayMs });
    if (reduced) log.warn('reduced motion: images swap instantly');
  }, [delayMs, reduced]);

  // Load the WebGL stage once the rig is near the viewport. Never when motion is reduced.
  if (inView && !wantGl) setWantGl(true);

  useEffect(() => {
    if (!wantGl || reduced || !isWebGLAvailable()) return;
    let cancelled = false;
    let created: BurnStage | null = null;
    void import('./BurnStage')
      .then(({ BurnStage }) =>
        BurnStage.create({
          screen: screenRef.current!,
          mount: glRef.current!,
          manualClock,
          onLost: () => setRender('css'),
          onRestored: () => {
            setRender('webgl');
          },
        }),
      )
      .then((stage) => {
        if (cancelled) {
          stage?.dispose();
          return;
        }
        if (!stage) {
          log.warn('WebGL2 not available, using the CSS fallback');
          return;
        }
        created = stage;
        stageRef.current = stage;
        setRender('webgl');
      })
      .catch((err: unknown) => log.error('could not start the burn stage', err));
    return () => {
      cancelled = true;
      created?.dispose();
      stageRef.current = null;
      setRender('css');
    };
  }, [wantGl, reduced, manualClock]);

  // Snap on page change or when the stage appears; animate when the rules change.
  const pageKey = state.page;
  const imagesVisible = vis.images;
  const videoVisible = vis.video;
  useEffect(() => {
    if (render === 'webgl')
      syncStage(stageRef.current, scrollRef.current, imagesVisible, videoVisible, false);
    // Snap only when the page or the render mode changes; visibility changes animate below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, pageKey]);
  useEffect(() => {
    if (render === 'webgl')
      syncStage(stageRef.current, scrollRef.current, imagesVisible, videoVisible, true);
  }, [render, imagesVisible, videoVisible]);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [pageKey]);

  const go = (id: PageId) => (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch({ type: 'navigate', page: id });
  };

  // Restrained pointer tilt: a few degrees and a soft sheen, mouse only, never under reduced motion.
  const onDeviceMove = (e: React.PointerEvent) => {
    const dev = deviceRef.current;
    const phone = phoneRef.current;
    if (!dev || !phone || reduced || e.pointerType !== 'mouse') return;
    const r = dev.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    phone.style.setProperty('--rx', `${((0.5 - py) * 5).toFixed(2)}deg`);
    phone.style.setProperty('--ry', `${((px - 0.5) * 6).toFixed(2)}deg`);
    phone.style.setProperty('--mx', `${(px * 100).toFixed(0)}%`);
    phone.style.setProperty('--my', `${(py * 100).toFixed(0)}%`);
  };
  const onDeviceLeave = () => {
    const phone = phoneRef.current;
    if (!phone) return;
    for (const k of ['--rx', '--ry', '--mx', '--my']) phone.style.removeProperty(k);
  };

  const requestLabel = pending ? ucfirst(describeRequest(pending.request)) : null;
  const ringR = 22;
  const circ = 2 * Math.PI * ringR;
  // The ring ticks once a second with weight, rather than draining smoothly.
  const totalSec = Math.max(1, Math.ceil(state.delayMs / 1000));
  const secLeft = pending ? Math.ceil(remaining / 1000) : 0;
  const ticks = Math.min(12, totalSec);
  const frac = pending ? Math.min(1, secLeft / totalSec) : 0;
  const ev = state.lastEvent;
  const doneVia = ev?.type === 'applied' ? ev.via : null;
  const shake = ev?.type === 'ignored' && ev.reason === 'busy' ? state.seq % 2 : undefined;
  const busy = pending !== null;
  const bypass = BYPASSES.find((b) => b.id === lastBypass);

  return (
    <div
      ref={rootRef}
      className={`ss${render === 'webgl' ? ' is-gl' : ''}`}
      data-testid="safesurf-demo"
      data-render={render}
      data-motion={reduced ? 'reduced' : 'full'}
      data-filter={state.filter}
    >
      <div
        className="ss__device"
        ref={deviceRef}
        onPointerMove={onDeviceMove}
        onPointerLeave={onDeviceLeave}
      >
        <div className="ss-phone" ref={phoneRef} data-cursor="tilt">
          <div className="ss-bar">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="3.75" y="7.25" width="8.5" height="6" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            <span className="ss-bar__url mono">{page.path}</span>
            <span className="ss-bar__mode mono" data-on={state.filter === 'on'}>
              {state.filter === 'on' ? 'SafeSurf' : 'Regular'}
            </span>
          </div>
          <div className="ss-screen" ref={screenRef}>
            <div
              className="ss-scroll"
              ref={scrollRef}
              role="region"
              aria-label="Mock news article, scrollable"
              // A scrollable region must be focusable so keyboard users can scroll the article.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              data-cursor="scroll"
            >
              <p className="ss-masthead">Tidewatch</p>
              <article>
                <h3 className="ss-headline">{page.headline}</h3>
                <p className="ss-byline mono">{page.byline}</p>
                {page.blocks.map((b, i) =>
                  b.type === 'p' ? (
                    <p key={`${page.id}-${i}`} className="ss-text">
                      {b.text}
                    </p>
                  ) : (
                    <Media
                      key={`${page.id}-${b.media.id}`}
                      item={b.media}
                      blocked={b.media.kind === 'video' ? !vis.video : !vis.images}
                      n={media.indexOf(b.media)}
                    />
                  ),
                )}
              </article>
              <p className="ss-more">
                {state.page === 'harbour' ? (
                  <a href="/#safesurf" data-cursor="open" onClick={go('weather')}>
                    Next story: Wind at the bar, and why it matters
                  </a>
                ) : (
                  <a href="/#safesurf" data-cursor="open" onClick={go('harbour')}>
                    Back to the harbour story
                  </a>
                )}
              </p>
            </div>
            <div className="ss-gl" ref={glRef} aria-hidden="true" />
          </div>
        </div>
        <p className="ss-readout mono" data-testid="safesurf-status">
          <span className="ss-readout__dot" aria-hidden="true" />
          {status}
        </p>
      </div>

      <div className="ss__bench">
        <div className="ss-console">
          <p className="ss-invite">
            {busy
              ? 'Want it now? So did I. Come back in an hour.'
              : 'Go ahead, turn it off. Everyone tries. It waits.'}
          </p>
          <div className="ss-console__top">
            <div className="ss-cell">
              <button
                type="button"
                role="switch"
                aria-checked={state.filter === 'on'}
                aria-labelledby={switchLabelId}
                className="ss-switch"
                data-cursor="flip"
                data-testid="safesurf-switch"
                onClick={() => act('filter')}
              >
                <span className="ss-switch__track" aria-hidden="true">
                  <span className="ss-switch__led" />
                  <span className="ss-switch__knob" />
                </span>
                <span className="ss-switch__sides mono" aria-hidden="true">
                  <span data-active={state.filter === 'off'}>Off</span>
                  <span data-active={state.filter === 'on'}>On</span>
                </span>
              </button>
              <p className="ss-cap mono" id={switchLabelId}>
                SafeSurf filter
              </p>
            </div>

            <div className="ss-cell ss-lock" data-pending={busy} data-shake={shake}>
              <div className="ss-ring" aria-hidden="true">
                {busy && <span className="ss-ring__pulse" data-p={secLeft % 2} />}
                {doneVia && (
                  <span className="ss-ring__snap" data-via={doneVia} data-p={state.seq % 2} />
                )}
                <svg viewBox="0 0 64 64">
                  {Array.from({ length: ticks }, (_, i) => (
                    <line
                      key={i}
                      className="ss-ring__tick"
                      data-lit={busy && i < Math.ceil(frac * ticks)}
                      x1="32"
                      y1="3.5"
                      x2="32"
                      y2="7.5"
                      transform={`rotate(${(i * 360) / ticks} 32 32)`}
                    />
                  ))}
                  <circle cx="32" cy="32" r={ringR} className="ss-ring__track" />
                  <circle
                    cx="32"
                    cy="32"
                    r={ringR}
                    className="ss-ring__arc"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - frac)}
                    transform="rotate(-90 32 32)"
                  />
                  {doneVia === 'sponsor' && (
                    <path
                      className="ss-ring__check"
                      data-p={state.seq % 2}
                      d="M21 33.5 29 41.5 44 24"
                      pathLength={1}
                    />
                  )}
                </svg>
                <span className="ss-ring__n mono" data-testid="safesurf-countdown">
                  {busy ? Math.ceil(remaining / 1000) : ''}
                </span>
              </div>
              <p className="ss-cap mono">Delay lock</p>
            </div>
          </div>

          <div className="ss-display mono">
            <p className="ss-display__main" data-testid="safesurf-request">
              {requestLabel ?? 'No request waiting.'}
            </p>
            <p className="ss-display__sub">1 hour, compressed to {delaySeconds} s</p>
          </div>

          {busy && (
            <div className="ss-row ss-row--pop">
              <Button
                className="ss-key"
                data-cursor="press"
                data-testid="safesurf-cancel"
                onClick={() => dispatch({ type: 'cancel' })}
              >
                Cancel request
              </Button>
              <Button
                className="ss-key"
                data-cursor="press"
                data-testid="safesurf-sponsor"
                onClick={() => dispatch({ type: 'sponsorApprove' })}
              >
                Ask sponsor
              </Button>
            </div>
          )}

          <div className="ss-keys" role="group" aria-label="Allow images and video">
            <span className="ss-cap mono" aria-hidden="true">
              Allow
            </span>
            {!vis.images && (
              <>
                <Button
                  className="ss-key"
                  data-cursor="press"
                  aria-label="Allow for this site"
                  data-testid="safesurf-allow-site"
                  onClick={() => act('allowSite')}
                >
                  Site
                </Button>
                <Button
                  className="ss-key"
                  data-cursor="press"
                  aria-label="Allow for this page"
                  data-testid="safesurf-allow-page"
                  onClick={() => act('allowPage')}
                >
                  Page
                </Button>
              </>
            )}
            {hasVideo && !vis.video && (
              <Button
                className="ss-key"
                data-cursor="press"
                aria-label="Allow only the video"
                data-testid="safesurf-allow-video"
                onClick={() => act('allowVideo')}
              >
                Video
              </Button>
            )}
            {(vis.images || vis.video || state.filter === 'off') && (
              <Button
                className="ss-key ss-key--block"
                data-cursor="press"
                data-testid="safesurf-block"
                onClick={() => dispatch({ type: 'blockAgain' })}
              >
                Block again
              </Button>
            )}
          </div>

          <div className="ss-keys" role="group" aria-label="Try to get around it">
            <span className="ss-cap mono" aria-hidden="true">
              Bypass
            </span>
            {BYPASSES.map((b) => (
              <Button
                className="ss-key"
                data-cursor="press"
                key={b.id}
                aria-label={b.label}
                data-testid={`safesurf-bypass-${b.id}`}
                onClick={() => {
                  setLastBypass(b.id);
                  dispatch({ type: 'bypass', attempt: b.id });
                }}
              >
                {b.short}
              </Button>
            ))}
          </div>
          <div className="ss-display ss-display--small mono">
            <p
              className="ss-bypass"
              data-testid="safesurf-bypass-result"
              data-p={state.refusals > 0 ? state.refusals % 2 : undefined}
            >
              {bypass
                ? `${bypass.refusal} Refused ${state.refusals}, got through 0.`
                : 'Nothing tried yet.'}
            </p>
          </div>
        </div>
      </div>

      <p className="ss-caption mono">
        Simulation in your browser. The real filter runs on the device, with no VPN or proxy.
      </p>
      <div
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="safesurf-live"
      >
        {announcement}
      </div>
    </div>
  );
}

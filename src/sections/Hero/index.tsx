import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, LinkButton } from '../../components/Button/Button';
import { profile } from '../../content/profile';
import { createLogger } from '../../lib/logger';
import { useInView, usePrefersReducedMotion } from '../../lib/motion';
import { isWebGLAvailable } from '../../lib/webgl';
import { selectMode } from './logic/mode';
import { openInNewTab } from './openLink';
import type { HeroRuntime } from './scene/runtime';
import './Hero.css';

const log = createLogger('hero');

/** Seed and debug switches from the URL. Only tests and the still generator use them. */
function readParams(): { seed: number; debug: boolean; live: boolean; fast: boolean } {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('heroSeed');
  const seed = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  return {
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    debug: seed !== null || q.has('heroDebug'),
    live: seed !== null || q.has('heroDebug') || q.get('hero') === 'live',
    // Deterministic fast path: settle the physics before the first frame (tests, stills, CI).
    fast: q.get('heroFast') === '1',
  };
}

const idle = (fn: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 60);
  return () => window.clearTimeout(id);
};

/**
 * Hero: real HTML on the left (or top), and a physical studio on the right (or below): glossy
 * keycaps and hardware you can throw, and the name as solid lettering that never moves. The 3D
 * chunk loads lazily after first paint; without WebGL2, with reduced motion, or after a context
 * loss the pre-rendered still takes its place.
 */
export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const webgl2 = useMemo(() => isWebGLAvailable(), []);
  const [lost, setLost] = useState(false);
  const [failed, setFailed] = useState(false);
  const params = useMemo(() => readParams(), []);
  const { mode, reason } = selectMode({
    webgl2,
    reducedMotion: reduced,
    contextLost: lost || failed,
    // Automated browsers (CI on software GL) get the still unless ?hero=live, ?heroSeed or ?heroDebug.
    automated: typeof navigator !== 'undefined' && navigator.webdriver === true && !params.live,
  });

  const [heroRef, inView] = useInView<HTMLElement>({ rootMargin: '10% 0px' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<HeroRuntime | null>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const [message, setMessage] = useState('');
  const [hits, setHits] = useState(0);

  useEffect(() => {
    if (mode !== 'scene') return;
    log.info('mode', { mode, reason });
  }, [mode, reason]);

  // Double-click or Enter on a project piece: go to its section through the same anchor navigation as the nav
  // links. A real `<a href="#id">` click is what Lenis (smooth scroll, `anchors: true`) handles, and under
  // reduced motion it is the browser's own anchor jump. Calling `scrollIntoView` here instead made the browser's
  // smooth scroll fight Lenis, which could stop the page far short of the section.
  const goTo = useCallback((hash: string) => {
    if (!document.getElementById(hash.replace(/^#/, ''))) return;
    const a = document.createElement('a');
    a.href = hash;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  // Double-click or Enter on the GitHub or LinkedIn piece: the profile opens in a new tab, from a real anchor click.
  // Nothing identifying is logged, only which piece.
  const openProfile = useCallback((id: string, url: string) => {
    const opened = openInNewTab(url);
    if (opened) log.info('profile piece opened', { piece: id });
    else log.warn('profile piece not opened: address is not https', { piece: id });
    return opened;
  }, []);

  // Load the 3D chunk after first paint so the text is never waiting on it.
  useEffect(() => {
    if (mode !== 'scene') return;
    let cancelled = false;
    let created: HeroRuntime | null = null;
    const cancelIdle = idle(() => {
      import('./scene/runtime')
        .then(async ({ createHeroRuntime }) => {
          if (cancelled || !canvasRef.current || !textRef.current) return;
          created = await createHeroRuntime({
            canvas: canvasRef.current,
            textEl: textRef.current,
            seed: params.seed,
            debug: params.debug,
            fast: params.fast,
            chipEl: chipRef.current,
            onHits: setHits,
            onNavigate: goTo,
            onOpenProfile: openProfile,
            onContextLost: () => setLost(true),
            onContextRestored: () => setLost(false),
            onAnnounce: setMessage,
          });
          if (cancelled) {
            created.dispose();
            return;
          }
          setRuntime(created);
        })
        .catch((err: unknown) => {
          log.error('scene failed to start; showing the still', err);
          if (!cancelled) setFailed(true);
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
      created?.dispose();
      setRuntime(null);
    };
  }, [mode, params, goTo, openProfile]);

  // Run the loop only while the hero is on screen and the tab is visible.
  useEffect(() => {
    if (!runtime) return;
    const apply = () => runtime.setActive(inView && !document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      runtime.setActive(false);
    };
  }, [runtime, inView]);

  const reset = useCallback(() => runtime?.reset(), [runtime]);

  return (
    <section ref={heroRef} id="top" aria-labelledby="top-title" className="hero">
      <div className="hero__stage" data-cursor="throw">
        <canvas
          ref={canvasRef}
          className={`hero__canvas${mode === 'still' ? ' hero__canvas--off' : ''}`}
          data-testid="hero-canvas"
          data-ready="false"
          data-mode={mode}
          tabIndex={mode === 'scene' ? 0 : -1}
          // eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role -- focusable canvas is a keyboard-operated widget
          role="group"
          aria-label="Interactive studio of keycaps and hardware. Press N to pick an object, arrow keys to push it, Space to hop it, Enter to open a project piece, S to shuffle, R to drop everything again."
        />
        {mode === 'still' && (
          <picture>
            <source media="(min-width: 900px)" srcSet="/hero/still-desktop.webp" />
            <img
              className="hero__still"
              src="/hero/still-mobile.webp"
              alt=""
              width={390}
              height={844}
              decoding="async"
            />
          </picture>
        )}
      </div>

      <div className="container hero__layout">
        <div ref={textRef} className="hero__copy">
          {/* The visible name is the 3D lettering; this heading is the page's real h1. */}
          <h1 id="top-title" className="visually-hidden">
            {profile.name}
          </h1>
          <p className="hero__thesis">{profile.thesis}</p>
          <p className="hero__role">{profile.role}</p>
          <p className="hero__availability">
            <span className="hero__dot" aria-hidden="true" />
            {profile.availability}
          </p>
          <div className="hero__actions">
            <LinkButton variant="primary" href="#contact">
              Get in touch
            </LinkButton>
            <LinkButton href="#safesurf">See SafeSurf</LinkButton>
          </div>
        </div>
      </div>

      {mode === 'scene' && (
        <div className="hero__tools">
          <div className="hero__note">
            <span className="hero__hint mono">Throw everything at me. I&apos;ll handle it.</span>
            <span className="hero__hits mono" data-testid="hero-hits">
              Hits on the name: {hits}. Damage: 0.
            </span>
          </div>
          <Button className="hero__reset" onClick={reset} disabled={!runtime}>
            Drop again
          </Button>
        </div>
      )}
      <span
        ref={chipRef}
        className="hero__chip mono"
        data-testid="hero-chip"
        aria-hidden="true"
        hidden
      />
      <p className="visually-hidden" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, LinkButton } from '../../components/Button/Button';
import { profile } from '../../content/profile';
import { createLogger } from '../../lib/logger';
import { useInView, usePrefersReducedMotion } from '../../lib/motion';
import { isWebGLAvailable } from '../../lib/webgl';
import { selectMode } from './logic/mode';
import type { HeroRuntime } from './scene/runtime';
import './Hero.css';

const log = createLogger('hero');

/** Seed and debug switches from the URL. Only tests and the still generator use them. */
function readParams(): { seed: number; debug: boolean } {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('heroSeed');
  const seed = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  return {
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    debug: seed !== null || q.has('heroDebug'),
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
  const { mode, reason } = selectMode({
    webgl2,
    reducedMotion: reduced,
    contextLost: lost || failed,
  });
  const params = useMemo(readParams, []);

  const [heroRef, inView] = useInView<HTMLElement>({ rootMargin: '10% 0px' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<HeroRuntime | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (mode !== 'scene') return;
    log.info('mode', { mode, reason });
  }, [mode, reason]);

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
  }, [mode, params]);

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
          role="group"
          aria-label="Interactive studio of keycaps and hardware. Press N to pick an object, arrow keys to push it, Space to hop it, S to shuffle, R to drop everything again."
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
          <h1 id="top-title" className="hero__name">
            {profile.name}
          </h1>
          <p className="hero__thesis">{profile.thesis}</p>
          <p className="hero__role">{profile.role}</p>
          <p className="hero__availability">
            <span className="hero__dot" aria-hidden="true" />
            {profile.availability}
          </p>
          <div className="hero__actions">
            <LinkButton variant="primary" href="#safesurf">
              See SafeSurf
            </LinkButton>
            <LinkButton href="#contact">Get in touch</LinkButton>
          </div>
        </div>
      </div>

      {mode === 'scene' && (
        <div className="hero__tools">
          <span className="hero__hint mono">
            Throw things at my name. Cheaper than therapy. It holds.
          </span>
          <Button className="hero__reset" onClick={reset} disabled={!runtime}>
            Drop again
          </Button>
        </div>
      )}
      <a className="hero__cue" href="#about">
        Scroll
      </a>
      <p className="visually-hidden" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

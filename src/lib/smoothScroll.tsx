import Lenis from 'lenis';
import { useEffect, useRef, type ReactNode } from 'react';
import { createAnchorTracker, type AnchorTracker } from './anchorTracker';
import { gsap, ScrollTrigger } from './gsap';
import { createLogger } from './logger';
import { usePrefersReducedMotion } from './motion';

const log = createLogger('scroll');

/**
 * Page-level motion provider. Lenis smooth scroll driven by the GSAP ticker, with
 * ScrollTrigger kept in sync. Anchor links (`#about`) and deep links (`/#contact`) go through an anchor tracker that
 * keeps re-reading the target's real position until the page has been quiet, so a late layout shift (an image, a
 * font, a lazy section) cannot leave the visitor in the wrong place; any wheel, touch or key press cancels it.
 * Under `prefers-reduced-motion: reduce` there is no Lenis: scrolling is native and the tracker jumps instantly.
 * `html.reduce-motion` is set so reveals stay visible.
 */
const navOffset = () =>
  parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
const targetOf = (id: string) => {
  const el = document.getElementById(id);
  return el
    ? Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - navOffset()))
    : null;
};

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const deepLinked = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', reduced);
    let lenis: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;
    if (reduced) log.info('reduced motion: smooth scroll disabled');
    else {
      lenis = new Lenis({ autoRaf: false, anchors: false, lerp: 0.1 });
      const l = lenis;
      tick = (timeSec: number) => l.raf(timeSec * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      l.on('scroll', ScrollTrigger.update);
      log.info('smooth scroll started');
    }

    let tracker: AnchorTracker | null = null;
    let raf = 0;
    const stopTracking = () => {
      tracker?.cancel();
      tracker = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const track = (
      id: string,
      immediate: boolean,
      opts: { maxMs?: number; settleMs?: number; onDone?: () => void } = {},
    ) => {
      stopTracking();
      const t = createAnchorTracker({
        read: () => targetOf(id),
        current: () => lenis?.scroll ?? window.scrollY,
        scrolling: () => (lenis ? lenis.isScrolling !== false : false),
        go: (y, now) => {
          if (lenis) lenis.scrollTo(y, { immediate: now });
          else window.scrollTo({ top: y, behavior: 'instant' });
        },
        immediate,
        maxMs: opts.maxMs,
        settleMs: opts.settleMs,
      });
      tracker = t;
      t.start(performance.now());
      const loop = (now: number) => {
        raf = 0;
        if (tracker !== t) return;
        const status = t.step(now);
        if (status === 'active') raf = requestAnimationFrame(loop);
        else {
          tracker = null;
          if (status === 'done') opts.onDone?.();
        }
      };
      raf = requestAnimationFrame(loop);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const hash = a?.getAttribute('href');
      if (!hash || hash.length < 2) return;
      const id = decodeURIComponent(hash.slice(1));
      if (!document.getElementById(id)) return;
      e.preventDefault();
      history.replaceState(null, '', hash);
      track(id, reduced);
    };
    document.addEventListener('click', onClick);
    // The visitor taking the wheel, the screen, the mouse or the keyboard always wins over a tracked scroll.
    const cancel = () => {
      if (!tracker) return;
      stopTracking();
      // Lenis keeps animating a programmatic scroll on its own; freeze it where it is so the visitor takes over.
      if (lenis?.isScrolling) lenis.scrollTo(lenis.scroll, { immediate: true, force: true });
    };
    const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    inputs.forEach((n) => window.addEventListener(n, cancel, { passive: true }));

    // Deep link: land on the hash target once content has laid out (instant jump, also under reduced motion).
    if (!deepLinked.current && location.hash.length > 1) {
      // Marked done only when the tracker finishes, so a dev double-mount does not drop the jump.
      track(decodeURIComponent(location.hash.slice(1)), true, {
        maxMs: 6000,
        settleMs: 800,
        onDone: () => (deepLinked.current = true),
      });
    }

    return () => {
      stopTracking();
      document.removeEventListener('click', onClick);
      inputs.forEach((n) => window.removeEventListener(n, cancel));
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, [reduced]);

  return <>{children}</>;
}

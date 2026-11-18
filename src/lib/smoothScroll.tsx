import Lenis from 'lenis';
import { useEffect, type ReactNode } from 'react';
import { gsap, ScrollTrigger } from './gsap';
import { createLogger } from './logger';
import { usePrefersReducedMotion } from './motion';

const log = createLogger('scroll');

/**
 * Page-level motion provider. Lenis smooth scroll driven by the GSAP ticker, with
 * ScrollTrigger kept in sync, and anchor links (`#about`) scrolled through Lenis (it reads `scroll-padding-top` on `html`, so the sticky nav is cleared).
 * Under `prefers-reduced-motion: reduce` nothing is created: native scrolling, native
 * anchors (with `scroll-padding-top`), and `html.reduce-motion` is set so reveals stay visible.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', reduced);
    if (reduced) {
      log.info('reduced motion: smooth scroll disabled');
      return;
    }
    const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 });
    const tick = (timeSec: number) => lenis.raf(timeSec * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', ScrollTrigger.update);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const hash = a?.getAttribute('href');
      if (hash && hash.length > 1) history.replaceState(null, '', hash);
    };
    document.addEventListener('click', onClick);
    log.info('smooth scroll started');

    return () => {
      document.removeEventListener('click', onClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [reduced]);

  return <>{children}</>;
}

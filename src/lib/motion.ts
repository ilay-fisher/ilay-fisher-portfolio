import { useEffect, useRef, useState, type RefObject } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** Live value of `prefers-reduced-motion: reduce`. False where matchMedia is unavailable. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(REDUCED_QUERY);
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * Tracks whether the element behind the returned ref intersects the viewport.
 * Use it to pause render loops for demos that are off screen.
 */
export function useInView<T extends Element>(
  options?: IntersectionObserverInit,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { root, rootMargin, threshold } = options ?? {};
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setInView(last.isIntersecting);
      },
      { root, rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, rootMargin, threshold]);
  return [ref, inView];
}

/**
 * Runs `callback` once per animation frame with the frame delta and the rAF timestamp.
 * Stops while `active` is false or the tab is hidden, and always calls the latest callback
 * without restarting the loop.
 */
export function useRafLoop(callback: (dtMs: number, tMs: number) => void, active: boolean): void {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });

  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last: number | null = null;
    let running = false;

    const frame = (t: number) => {
      const dt = last === null ? 0 : t - last;
      last = t;
      cbRef.current(dt, t);
      id = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running) return;
      running = true;
      last = null;
      id = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(id);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [active]);
}

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap } from '../../lib/gsap';
import { usePrefersReducedMotion } from '../../lib/motion';
import { magnetOffset } from './magnet';

/**
 * Magnetic hover for a wrapper element: it leans toward a fine pointer (max 8 px) and settles
 * back on leave. Off for touch and reduced motion. Returns the ref for the wrapper.
 */
export function useMagnet<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      if (typeof window.matchMedia !== 'function') return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const x = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const o = magnetOffset(
          e.clientX - (r.left + r.width / 2),
          e.clientY - (r.top + r.height / 2),
          0.25,
          8,
        );
        x(o.x);
        y(o.y);
      };
      const leave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      };
    },
    { scope: ref, dependencies: [reduced] },
  );
  return ref;
}

import { useGSAP } from '@gsap/react';
import { useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsap';
import { usePrefersReducedMotion } from '../../lib/motion';
import { SPRING_SOFT, settleTime, springEase } from '../../lib/spring';
import './Reveal.css';

/**
 * How an element arrives. All variants rise with weight: a spring with a slight overshoot that
 * settles, never a flat fade.
 * - `up`: the element rises and fades in.
 * - `fade`: opacity only (for things that must not move, such as an image already in place).
 * - `lines`: text lines slide up out of a mask, staggered.
 * - `words`: words rise one after another (section headings).
 * - `stagger`: each direct child rises in turn (lists, rows of tiles, pills).
 */
export type RevealVariant = 'up' | 'fade' | 'lines' | 'words' | 'stagger';

/** Props for {@link Reveal}. */
export interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> {
  variant?: RevealVariant;
  /** Element to render. Default `div`. */
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

const SPRING = springEase(SPRING_SOFT);
const SETTLE = settleTime(SPRING_SOFT);

let watching = false;

/**
 * Re-measures every reveal trigger whenever the page height changes (late fonts, images, canvases, counters). ScrollTrigger
 * only measures on creation, on `load` and on window resize, so a layout shift after that left a trigger further down
 * than where its element really sits and the reveal never played (seen on CI: a lone bench-label stuck at opacity 0
 * until a resize). One shared observer, debounced, started by the first reveal.
 */
function watchLayout() {
  if (watching || typeof ResizeObserver === 'undefined') return;
  watching = true;
  let timer = 0;
  /** A refresh re-seats the scroll position, so it never runs while a scroll (smooth scroller, anchor jump) is in flight. */
  const refresh = () => {
    if (ScrollTrigger.isScrolling()) timer = window.setTimeout(refresh, 150);
    else ScrollTrigger.refresh();
  };
  new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, 150);
  }).observe(document.body);
}

/**
 * The shared scroll-in reveal. Plays once when the element reaches 85% of the viewport, with the
 * soft spring (see `src/lib/spring.ts`). Under reduced motion (or without JS) the content is simply
 * visible in its finished state. Use it for headings, one block per section and lists.
 */
export function Reveal({
  variant = 'up',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (reduced) {
        el.dataset.revealReady = 'true';
        return;
      }
      watchLayout();
      const scrollTrigger = { trigger: el, start: 'top 88%', once: true };

      /**
       * Rise on the spring. Opacity rides the same curve: the overshoot past 1 is clamped by the
       * browser, so it simply arrives a touch early while the movement settles. The end state is
       * explicit (`fromTo`): `gsap.from` would read it from the computed style, and while the CSS
       * pre-hide still applies to the element itself that is opacity 0 (a tween from 0 to 0).
       */
      const rise = (targets: gsap.TweenTarget, from: gsap.TweenVars, stagger = 0) =>
        gsap.fromTo(
          targets,
          { ...from, opacity: 0 },
          { y: 0, opacity: 1, duration: SETTLE, ease: SPRING, stagger, scrollTrigger },
        );

      if (variant === 'lines' || variant === 'words') {
        const fonts = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
        let cancelled = false;
        let split: SplitText | undefined;
        void (fonts ?? Promise.resolve()).then(() => {
          if (cancelled) return;
          split =
            variant === 'lines'
              ? SplitText.create(el, {
                  type: 'lines',
                  mask: 'lines',
                  autoSplit: true,
                  onSplit: (self) =>
                    gsap.from(self.lines, {
                      yPercent: 115,
                      duration: SETTLE,
                      stagger: 0.08,
                      ease: SPRING,
                      scrollTrigger,
                    }),
                })
              : SplitText.create(el, {
                  type: 'words',
                  autoSplit: true,
                  onSplit: (self) => rise(self.words, { y: '0.55em' }, 0.055),
                });
          el.dataset.revealReady = 'true';
        });
        return () => {
          cancelled = true;
          split?.revert();
        };
      }

      if (variant === 'stagger') {
        const kids = Array.from(el.children);
        if (kids.length) rise(kids, { y: 34 }, 0.07);
        el.dataset.revealReady = 'true';
        return;
      }

      if (variant === 'fade') {
        gsap.fromTo(
          el,
          { opacity: 0 },
          { opacity: 1, duration: 0.7, ease: 'power2.out', scrollTrigger },
        );
      } else {
        rise(el, { y: 40 });
      }
      el.dataset.revealReady = 'true';
    },
    { scope: ref, dependencies: [reduced, variant] },
  );

  return (
    <Tag ref={ref} data-reveal={variant} className={className} {...rest}>
      {children}
    </Tag>
  );
}

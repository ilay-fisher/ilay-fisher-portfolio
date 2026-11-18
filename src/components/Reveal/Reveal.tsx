import { useGSAP } from '@gsap/react';
import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap, SplitText } from '../../lib/gsap';
import { usePrefersReducedMotion } from '../../lib/motion';
import './Reveal.css';

/** How an element comes in. `lines` masks and slides each line of text. */
export type RevealVariant = 'up' | 'fade' | 'lines';

/** Props for {@link Reveal}. */
export interface RevealProps {
  variant?: RevealVariant;
  /** Element to render. Default `div`. */
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/**
 * The shared scroll-in reveal. Plays once when the element reaches 85% of the viewport.
 * Under reduced motion (or without JS) the content is simply visible. Use it sparingly:
 * headings and one key block per section, never every card (see docs/DESIGN.md).
 */
export function Reveal({ variant = 'up', as: Tag = 'div', className, children }: RevealProps) {
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
      const scrollTrigger = { trigger: el, start: 'top 85%', once: true };
      if (variant === 'lines') {
        const fonts = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
        let cancelled = false;
        let split: SplitText | undefined;
        void (fonts ?? Promise.resolve()).then(() => {
          if (cancelled) return;
          split = SplitText.create(el, {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 110,
                duration: 0.8,
                stagger: 0.08,
                ease: 'expo.out',
                scrollTrigger,
              }),
          });
          el.dataset.revealReady = 'true';
        });
        return () => {
          cancelled = true;
          split?.revert();
        };
      }
      gsap.from(el, {
        opacity: 0,
        y: variant === 'up' ? 24 : 0,
        duration: 0.7,
        ease: 'expo.out',
        scrollTrigger,
      });
      el.dataset.revealReady = 'true';
    },
    { scope: ref, dependencies: [reduced, variant] },
  );

  return (
    <Tag ref={ref} data-reveal={variant} className={className}>
      {children}
    </Tag>
  );
}

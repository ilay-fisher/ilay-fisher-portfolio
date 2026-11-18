import { useCallback, useEffect, useState, type HTMLAttributes, type RefCallback } from 'react';

/**
 * The one convention for an element with its own overflow scrolling. Mark it `data-scroll-area` (use
 * `scrollAreaProps`): the page smooth scroller (Lenis) then leaves wheel and touch input over it alone so it scrolls
 * natively, `global.css` gives it a slim scrollbar and a focus ring, and the e2e spec `inner-scroll.spec.ts` fails if
 * any `overflow: auto|scroll` element on the page forgets the attribute. When the area reaches its end the browser
 * hands the gesture to the page (do not set `overscroll-behavior: contain`, it traps the visitor).
 */
export const SCROLL_AREA_ATTR = 'data-scroll-area';

/** True when the event target is, or sits inside, a scroll area. Used as Lenis's `prevent` option. */
export function isInnerScrollTarget(node: Element | null): boolean {
  return !!node?.closest?.(`[${SCROLL_AREA_ATTR}]`);
}

/**
 * Props for a scroll area: the marker, plus what a keyboard user needs to scroll it (focusable region with an
 * accessible name). Spread onto the scrolling element; it must have a fixed height and `overflow-y: auto`.
 */
export function scrollAreaProps(
  label: string,
): Pick<HTMLAttributes<HTMLElement>, 'role' | 'aria-label' | 'tabIndex'> & {
  'data-scroll-area': '';
} {
  return { 'data-scroll-area': '', role: 'region', 'aria-label': label, tabIndex: 0 };
}

/**
 * Like `scrollAreaProps`, for text blocks that only overflow on some viewports (readouts, captions): the region is
 * focusable only while its content really overflows, so it adds no empty tab stop. Spread the result, `ref` included.
 */
export function useScrollArea(label: string): ReturnType<typeof scrollAreaProps> & {
  ref: RefCallback<HTMLElement>;
} {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useCallback((n: HTMLElement | null) => setNode(n), []);
  useEffect(() => {
    if (!node) return;
    const measure = () => setOverflowing(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    const mo = new MutationObserver(measure);
    mo.observe(node, { childList: true, subtree: true, characterData: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [node]);
  return { ...scrollAreaProps(label), tabIndex: overflowing ? 0 : -1, ref };
}

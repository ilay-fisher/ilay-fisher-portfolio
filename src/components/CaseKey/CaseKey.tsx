import type { ReactNode } from 'react';
import './CaseKey.css';

/** Props for {@link CaseKey}. */
export interface CaseKeyProps {
  href: string;
  /** Which way the arrow points: `forward` for "go deeper" and next, `back` for back and previous. */
  direction?: 'forward' | 'back';
  /** Small line above the label, for example "Next project". */
  hint?: string;
  children: ReactNode;
}

/**
 * A tactile key that leads to another page of this site: a rounded anodised pill with an arrow in an engraved well.
 * A real `<a href>`, so it opens in the same tab on a click and in a new tab on a middle or cmd click. The arrow
 * nudges toward its direction on hover; the press squashes a few percent and springs back.
 */
export function CaseKey({ href, direction = 'forward', hint, children }: CaseKeyProps) {
  const arrow = (
    <span className="case-key__ico" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === 'forward' ? (
          <path d="M5 12h14m-6-6 6 6-6 6" />
        ) : (
          <path d="M19 12H5m6-6-6 6 6 6" />
        )}
      </svg>
    </span>
  );
  return (
    <a className="case-key" data-direction={direction} data-magnetic href={href}>
      {direction === 'back' && arrow}
      <span className="case-key__text">
        {hint && <span className="case-key__hint">{hint}</span>}
        <span className="case-key__label">{children}</span>
      </span>
      {direction === 'forward' && arrow}
    </a>
  );
}

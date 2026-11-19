import type { PointerEvent, ReactNode } from 'react';
import './LinkKey.css';

export { GitHubIcon, LinkedInIcon, MailIcon, PhoneIcon, WhatsAppIcon } from './icons';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Feeds the mouse position (relative to the key) to the key's moving highlight. */
function trackPointer(e: PointerEvent<HTMLAnchorElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
  el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
}

/** Props for {@link LinkKey}. */
export interface LinkKeyProps {
  href: string;
  /** Decorative glyph (aria-hidden); the label is the accessible name. */
  icon: ReactNode;
  /** Picks the icon's own hover move. */
  kind: 'linkedin' | 'github' | 'mail' | 'phone' | 'whatsapp';
  /** Accessible name when it should say more than the visible label (it must contain it). */
  label?: string;
  /** Opens in a new tab with `rel="noopener noreferrer"` and says so to screen readers. */
  external?: boolean;
  children: ReactNode;
}

/**
 * One tactile key: a rounded anodised pill with the icon in an engraved well, a visible label,
 * a lift on hover or focus, a pointer-following highlight and a press squash. Shared by the
 * footer and the Contact section. It leans toward the pointer through `data-magnetic`
 * (the `translate` property), so it never fights its own hover `transform`.
 */
export function LinkKey({ href, icon, kind, external, label, children }: LinkKeyProps) {
  return (
    <a
      className="link-key"
      data-key={kind}
      data-magnetic
      href={href}
      aria-label={label}
      onPointerMove={trackPointer}
      {...(external ? ext : {})}
    >
      <span className="link-key__glow" aria-hidden="true" />
      <span className="link-key__ico">{icon}</span>
      <span className="link-key__label">
        {children}
        {external && <span className="visually-hidden"> (opens in a new tab)</span>}
      </span>
    </a>
  );
}

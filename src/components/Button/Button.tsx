import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import './Button.css';

type Variant = 'primary' | 'secondary';

/** Class list for a button; every button carries the pointer sheen. */
const cls = (variant: Variant) => `btn btn--${variant} sheen`;

/** Primary buttons lean toward the pointer by default; `magnetic` overrides either way. */
const magneticAttr = (variant: Variant, magnetic?: boolean) =>
  (magnetic ?? variant === 'primary') ? { 'data-magnetic': '' } : {};

/** Props for {@link Button}. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is the paint fill; use at most one per section. Defaults to `secondary`. */
  variant?: Variant;
  /** Pull toward a fine pointer. On by default for `primary`, off for `secondary`. */
  magnetic?: boolean;
}

/** A real `<button>` shaped as a bevelled pill that squashes when pressed and springs back. Defaults to `type="button"`. */
export function Button({
  variant = 'secondary',
  magnetic,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[cls(variant), className].filter(Boolean).join(' ')}
      {...magneticAttr(variant, magnetic)}
      {...rest}
    />
  );
}

/** Props for {@link LinkButton}. */
export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  /** Pull toward a fine pointer. On by default for `primary`, off for `secondary`. */
  magnetic?: boolean;
}

/**
 * An `<a>` that looks like a {@link Button}. http(s) links open in a new tab with
 * `rel="noopener noreferrer"` and say so to screen readers; `#anchor` and `mailto:` stay in place.
 */
export function LinkButton({
  variant = 'secondary',
  magnetic,
  className,
  href,
  children,
  ...rest
}: LinkButtonProps) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className={[cls(variant), className].filter(Boolean).join(' ')}
      {...magneticAttr(variant, magnetic)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
      {external && ' '}
      {external && <span className="visually-hidden">(opens in a new tab)</span>}
    </a>
  );
}

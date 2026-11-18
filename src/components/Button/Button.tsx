import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import './Button.css';

type Variant = 'primary' | 'secondary';

const cls = (variant: Variant) => `btn btn--${variant}`;

/** Props for {@link Button}. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is the paint fill; use at most one per section. Defaults to `secondary`. */
  variant?: Variant;
}

/** A real `<button>` with the shared look. Defaults to `type="button"`. */
export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={[cls(variant), className].filter(Boolean).join(' ')} {...rest} />
  );
}

/** Props for {@link LinkButton}. */
export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
}

/**
 * An `<a>` that looks like a {@link Button}. http(s) links open in a new tab with
 * `rel="noopener noreferrer"` and say so to screen readers; `#anchor` and `mailto:` stay in place.
 */
export function LinkButton({
  variant = 'secondary',
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
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
      {external && ' '}
      {external && <span className="visually-hidden">(opens in a new tab)</span>}
    </a>
  );
}

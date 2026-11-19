import type { SVGProps } from 'react';

/**
 * Link key glyphs. Inline, decorative (`aria-hidden`, not focusable, no title: the link text
 * is the accessible name) and drawn in `currentColor`, so the key decides the colour.
 *
 * The LinkedIn "in" and the GitHub mark are the Simple Icons path data (CC0-1.0,
 * https://simpleicons.org; LinkedIn from Simple Icons 12, which still carried it). The LinkedIn
 * rounded-square plate is left out: the key itself is the plate. Both are trademarks of their
 * owners, used to point at the owner's own profiles. The envelope is drawn for this site.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

const base = {
  viewBox: '0 0 24 24',
  width: 16,
  height: 16,
  'aria-hidden': true,
  focusable: 'false',
} as const;

/** The LinkedIn "in" mark without its square plate. */
export function LinkedInIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zM7.119 20.452H3.555V9h3.564v11.452z"
      />
    </svg>
  );
}

/** The GitHub mark. */
export function GitHubIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

/**
 * A filled envelope with a V flap cut into it. The flap is its own element (`.link-key__flap`)
 * as a styling hook; it is stroked in the well colour so it reads as a cut.
 */
export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="4.5" width="20" height="15" rx="3.5" fill="currentColor" />
      <path
        className="link-key__flap"
        d="M5.2 8.4 12 13.2l6.8-4.8"
        fill="none"
        stroke="var(--key-well)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A filled phone handset. */
export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path
        fill="currentColor"
        d="M6.6 2.5c.5-.5 1.3-.4 1.7.1l2 2.8c.3.5.3 1.1-.1 1.5L9 8.1c1 2.1 2.8 3.9 4.9 4.9l1.2-1.2c.4-.4 1-.4 1.5-.1l2.8 2c.5.4.6 1.2.1 1.7l-1.3 1.4c-.9.9-2.2 1.2-3.4.8C9.700 16.200 7.800 14.300 6.300 11.100c-.9-1.900-1.300-3.600-1.300-4.700 0-.8.3-1.600.9-2.200z"
      />
    </svg>
  );
}

/** A speech bubble with a handset cut into it; the glyph (not the key) carries the WhatsApp green. */
export function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path
        fill="currentColor"
        d="M12 2.2a9.800 9.800 0 0 0-8.400 14.800L2.200 21.800l5-1.300A9.800 9.800 0 1 0 12 2.200z"
      />
      <path
        fill="var(--key-well)"
        d="M8.900 7.300c.3-.4.800-.4 1 0l.8 1.600c.1.300 0 .5-.2.700l-.5.500c.6 1.200 1.500 2.100 2.700 2.700l.5-.5c.2-.2.5-.3.7-.2l1.600.8c.4.200.4.700 0 1-.9.800-1.800 1-2.800.6-2.500-1-4.100-2.700-5.100-5.200-.4-1-.1-1.900.6-2.700z"
      />
    </svg>
  );
}

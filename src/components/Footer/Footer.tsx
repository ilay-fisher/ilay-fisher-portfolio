import type { PointerEvent, ReactNode } from 'react';
import { Reveal } from '../Reveal/Reveal';
import { profile } from '../../content/profile';
import { GitHubIcon, LinkedInIcon, MailIcon } from './icons';
import './Footer.css';

/** The public source of this site, linked from the "built with" line. */
export const REPO_URL = 'https://github.com/ilay-fisher/ilay-fisher-portfolio';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** One tactile key: a rounded anodised pill with the icon in an engraved well and a visible label. */
function Key({
  href,
  icon,
  kind,
  external,
  children,
}: {
  href: string;
  icon: ReactNode;
  kind: 'linkedin' | 'github' | 'mail';
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <a
        className="footer-key"
        data-key={kind}
        data-magnetic
        href={href}
        {...(external ? ext : {})}
      >
        <span className="footer-key__glow" aria-hidden="true" />
        <span className="footer-key__ico">{icon}</span>
        <span className="footer-key__label">
          {children}
          {external && <span className="visually-hidden"> (opens in a new tab)</span>}
        </span>
      </a>
    </li>
  );
}

/** Feeds the pointer position (relative to the key) to the key's moving highlight. */
function trackPointer(e: PointerEvent<HTMLUListElement>) {
  if (e.pointerType !== 'mouse') return;
  const key = (e.target as Element).closest<HTMLElement>('.footer-key');
  if (!key) return;
  const r = key.getBoundingClientRect();
  key.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
  key.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
}

/**
 * Page footer: name, year and place, the three public links as tactile icon keys, a built-with
 * line that links to the repository, and a back-to-top link (anchors go through SmoothScroll).
 * The keys rise in a stagger when the footer scrolls into view (shared Reveal).
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__id mono">
          {profile.name}, {new Date().getFullYear()}. {profile.location}.
        </p>
        <Reveal
          as="ul"
          variant="stagger"
          className="footer__links mono"
          aria-label="Elsewhere"
          onPointerMove={trackPointer}
        >
          <Key kind="linkedin" href={profile.links.linkedin} icon={<LinkedInIcon />} external>
            LinkedIn
          </Key>
          <Key kind="github" href={profile.links.github} icon={<GitHubIcon />} external>
            GitHub
          </Key>
          <Key kind="mail" href={`mailto:${profile.email}`} icon={<MailIcon />}>
            Email
          </Key>
        </Reveal>
        <p className="footer__built mono">
          Built with React, GSAP and OGL.{' '}
          <a href={REPO_URL} {...ext}>
            Read the source<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
        <a className="footer__top mono" href="#top">
          Back to top
        </a>
        <p className="footer__wit">You reached the bottom. Nothing broke. That's the point.</p>
      </div>
    </footer>
  );
}

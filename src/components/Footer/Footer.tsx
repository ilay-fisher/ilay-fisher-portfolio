import { profile } from '../../content/profile';
import './Footer.css';

/** The public source of this site, linked from the "built with" line. */
export const REPO_URL = 'https://github.com/ilay-fisher/ilay-fisher-portfolio';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * Page footer: name, year and place, the three public links, a built-with line that links to
 * the repository, and a back-to-top link (anchors go through SmoothScroll).
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__id mono">
          {profile.name}, {new Date().getFullYear()}. {profile.location}.
        </p>
        <ul className="footer__links mono" aria-label="Elsewhere">
          <li>
            <a href={profile.links.linkedin} {...ext}>
              LinkedIn<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a href={profile.links.github} {...ext}>
              GitHub<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a href={`mailto:${profile.email}`}>Email</a>
          </li>
        </ul>
        <p className="footer__built mono">
          Built with React, GSAP and OGL.{' '}
          <a href={REPO_URL} {...ext}>
            Read the source<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
        <a className="footer__top mono" href="#top">
          Back to top
        </a>
      </div>
    </footer>
  );
}

import { Reveal } from '../Reveal/Reveal';
import { profile } from '../../content/profile';
import { GitHubIcon, LinkedInIcon, LinkKey, MailIcon } from '../LinkKey/LinkKey';
import './Footer.css';

/** The public source of this site, linked from the "built with" line. */
export const REPO_URL = 'https://github.com/ilay-fisher/ilay-fisher-portfolio';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

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
        <Reveal as="ul" variant="stagger" className="footer__links mono" aria-label="Elsewhere">
          <li>
            <LinkKey kind="linkedin" href={profile.links.linkedin} icon={<LinkedInIcon />} external>
              LinkedIn
            </LinkKey>
          </li>
          <li>
            <LinkKey kind="github" href={profile.links.github} icon={<GitHubIcon />} external>
              GitHub
            </LinkKey>
          </li>
          <li>
            <LinkKey kind="mail" href={`mailto:${profile.email}`} icon={<MailIcon />}>
              Email
            </LinkKey>
          </li>
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

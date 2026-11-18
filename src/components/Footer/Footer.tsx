import { profile } from '../../content/profile';
import './Footer.css';

/** Page footer: name, year, and the public links. Worker B refines it. */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="mono">
          {profile.name}, {new Date().getFullYear()}. {profile.location}.
        </p>
        <ul className="footer__links mono">
          <li>
            <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={profile.links.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </li>
          <li>
            <a href={`mailto:${profile.email}`}>Email</a>
          </li>
        </ul>
      </div>
    </footer>
  );
}

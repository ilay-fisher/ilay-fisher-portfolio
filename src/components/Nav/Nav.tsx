import './Nav.css';

/** Anchor targets in the nav, in page order (the hero `#top` is the brand link). */
export const NAV_ITEMS = [
  { id: 'about', label: 'About' },
  { id: 'safesurf', label: 'SafeSurf' },
  { id: 'drone', label: 'Drone' },
  { id: 'xray', label: 'X-Ray' },
  { id: 'experience', label: 'Experience' },
  { id: 'contact', label: 'Contact' },
] as const;

/** Sticky top navigation with a skip link. Anchor links only; worker B refines it. */
export function Nav() {
  return (
    <header className="nav">
      <a className="nav__skip" href="#main">
        Skip to content
      </a>
      <nav aria-label="Sections" className="container nav__inner">
        <a className="nav__brand" href="#top">
          Ilay Fisher
        </a>
        <ul className="nav__links">
          {NAV_ITEMS.map((i) => (
            <li key={i.id}>
              <a href={`#${i.id}`}>{i.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

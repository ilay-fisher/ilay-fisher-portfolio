import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LinkButton } from '../Button/Button';
import { createLogger } from '../../lib/logger';
import { pickActive, scrollProgress } from './navLogic';
import './Nav.css';

const log = createLogger('nav');

/** Anchor targets in the nav, in page order (the hero `#top` is the brand link). */
export const NAV_ITEMS = [
  { id: 'ai', label: 'AI' },
  { id: 'about', label: 'About' },
  { id: 'safesurf', label: 'SafeSurf' },
  { id: 'xray', label: 'X-Ray' },
  { id: 'drone', label: 'Drone' },
  { id: 'experience', label: 'Experience' },
] as const;

/** Contact is not in the text list: the "Get in touch" pill at the right end of the bar is its link. */
const ORDER: string[] = [...NAV_ITEMS.map((i) => i.id), 'contact'];

/**
 * Floating rounded top bar: skip link, brand, section links with an IntersectionObserver-driven
 * `aria-current` and a pill indicator that slides to the active link, a scroll-progress line
 * inside the bar, and below 900 px a Menu button (aria-expanded, focus moves in on open, Escape or
 * focus leaving closes) opening a rounded panel. A "Get in touch" primary pill ends the bar at every
 * width (next to Menu on phones, outside the panel) and carries `aria-current` while Contact is in view.
 * Anchors are handled by SmoothScroll.
 * `base` prefixes every hash link (`base="/"` gives `/#about`) so the same bar works on pages other than the home page.
 */
export function Nav({ base = '' }: { base?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Active section: observe a thin band across the middle of the viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const inBand = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        setActive(pickActive(ORDER, inBand));
      },
      { rootMargin: '-40% 0px -59% 0px' },
    );
    for (const id of ORDER) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // The indicator slides under the active link: measured here, animated by CSS (transform + width).
  useLayoutEffect(() => {
    const bar = barRef.current;
    const links = linksRef.current;
    if (!bar || !links) return;
    const place = () => {
      const a = links.querySelector<HTMLElement>('a[aria-current]');
      if (!a) return;
      bar.style.setProperty('--ind-x', `${a.offsetLeft}px`);
      bar.style.setProperty('--ind-w', `${a.offsetWidth}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active]);

  // Scroll progress line, written straight to the DOM so scrolling never re-renders.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = progressRef.current;
      if (!el) return;
      const p = scrollProgress(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      el.style.transform = `scaleX(${p})`;
      el.setAttribute('data-progress', p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Menu: focus the first link when it opens; close on outside pointer.
  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Escape closes and returns focus to the button; focus leaving the header closes without moving it.
  useEffect(() => {
    const header = headerRef.current;
    if (!header || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      log.debug('menu closed with Escape');
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!header.contains(e.relatedTarget as Node | null)) setOpen(false);
    };
    header.addEventListener('keydown', onKey);
    header.addEventListener('focusout', onFocusOut);
    return () => {
      header.removeEventListener('keydown', onKey);
      header.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  return (
    <header className="nav" ref={headerRef}>
      <a className="nav__skip" href="#main">
        Skip to content
      </a>
      <nav aria-label="Sections" className="container nav__inner">
        <div className="nav__bar" ref={barRef}>
          <a className="nav__brand" href={`${base}#top`}>
            Ilay Fisher
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="nav__toggle"
            aria-expanded={open}
            aria-controls="nav-links"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="nav__toggle-bars" aria-hidden="true" />
            Menu
          </button>
          <ul className="nav__links" id="nav-links" data-open={open} ref={linksRef}>
            <li
              className="nav__indicator"
              aria-hidden="true"
              data-for={active && active !== 'contact' ? active : ''}
            />
            {NAV_ITEMS.map((i, idx) => (
              <li key={i.id}>
                <a
                  ref={idx === 0 ? firstLinkRef : undefined}
                  href={`${base}#${i.id}`}
                  aria-current={active === i.id ? 'true' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
          <LinkButton
            variant="primary"
            href={`${base}#contact`}
            className="nav__cta"
            aria-current={active === 'contact' ? 'true' : undefined}
            onClick={() => setOpen(false)}
          >
            Get in touch
          </LinkButton>
          <div className="nav__progress" ref={progressRef} aria-hidden="true" />
        </div>
      </nav>
    </header>
  );
}

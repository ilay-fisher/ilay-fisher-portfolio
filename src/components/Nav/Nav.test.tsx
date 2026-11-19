import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Nav, NAV_ITEMS } from './Nav';

type IoCb = (entries: Partial<IntersectionObserverEntry>[]) => void;
let ioCb: IoCb | null = null;
const observed: Element[] = [];

beforeEach(() => {
  observed.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IoCb) {
        ioCb = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  for (const i of [...NAV_ITEMS, { id: 'contact' }]) {
    const s = document.createElement('section');
    s.id = i.id;
    document.body.appendChild(s);
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Nav', () => {
  it('has a skip link to the main content as the first focusable link', () => {
    render(<Nav />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('Skip to content');
    expect(links[0]).toHaveAttribute('href', '#main');
  });

  it('links to every section id after the hero, in page order', () => {
    render(<Nav />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    // the text list ends at Experience: Contact is the call-to-action pill, last in the bar
    expect(hrefs).toEqual(['#top', ...NAV_ITEMS.map((i) => `#${i.id}`), '#contact']);
    expect(NAV_ITEMS.map((i) => i.id)).not.toContain('contact');
  });

  it('puts a Get in touch call-to-action at the right end, outside the collapsible list', () => {
    render(<Nav />);
    const cta = screen.getByRole('link', { name: 'Get in touch' });
    expect(cta).toHaveAttribute('href', '#contact');
    expect(cta).toHaveClass('btn--primary');
    expect(cta).toHaveClass('nav__cta');
    expect(cta).toHaveAttribute('data-magnetic');
    expect(cta.closest('#nav-links')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contact' })).toBeNull();
    const bar = document.querySelector('.nav__bar')!;
    const kids = Array.from(bar.children);
    expect(kids.indexOf(cta)).toBeGreaterThan(kids.indexOf(document.getElementById('nav-links')!));
  });

  it('marks the call-to-action current while Contact is in view, and no list link', () => {
    render(<Nav />);
    act(() => ioCb?.([{ target: document.getElementById('contact')!, isIntersecting: true }]));
    expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(document.querySelector('.nav__indicator')).toHaveAttribute('data-for', '');
  });

  it('observes every section and marks the one in view with aria-current', () => {
    render(<Nav />);
    expect(observed.map((e) => e.id)).toEqual([...NAV_ITEMS.map((i) => i.id), 'contact']);
    expect(document.querySelector('[aria-current]')).toBeNull();
    act(() => ioCb?.([{ target: document.getElementById('drone')!, isIntersecting: true }]));
    const current = document.querySelectorAll('[aria-current]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '#drone');
    act(() =>
      ioCb?.([
        { target: document.getElementById('drone')!, isIntersecting: false },
        { target: document.getElementById('xray')!, isIntersecting: true },
      ]),
    );
    expect(document.querySelector('[aria-current]')).toHaveAttribute('href', '#xray');
  });

  it('renders a scroll-progress hairline that is hidden from assistive tech', () => {
    render(<Nav />);
    expect(document.querySelector('.nav__progress')).toHaveAttribute('aria-hidden', 'true');
  });

  describe('mobile menu', () => {
    it('has a Menu button that toggles aria-expanded and points at the link list', async () => {
      const user = userEvent.setup();
      render(<Nav />);
      const btn = screen.getByRole('button', { name: 'Menu' });
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      const list = document.getElementById(btn.getAttribute('aria-controls') ?? '');
      expect(list).not.toBeNull();
      await user.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');
      expect(list).toHaveAttribute('data-open', 'true');
    });

    it('moves focus to the first link on open and closes with Escape, returning focus', async () => {
      const user = userEvent.setup();
      render(<Nav />);
      const btn = screen.getByRole('button', { name: 'Menu' });
      await user.click(btn);
      expect(screen.getByRole('link', { name: 'About' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      expect(btn).toHaveFocus();
    });

    it('keeps the call-to-action visible next to the Menu button, not inside the panel', () => {
      render(<Nav />);
      const btn = screen.getByRole('button', { name: 'Menu' });
      const cta = screen.getByRole('link', { name: 'Get in touch' });
      expect(btn.parentElement).toBe(cta.parentElement);
    });

    it('is operable with the keyboard alone and closes after choosing a link', async () => {
      const user = userEvent.setup();
      render(<Nav />);
      const btn = screen.getByRole('button', { name: 'Menu' });
      btn.focus();
      await user.keyboard('{Enter}');
      expect(btn).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Tab}');
      expect(screen.getByRole('link', { name: 'SafeSurf' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes when focus leaves the navigation', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Nav />
          <button type="button">outside</button>
        </>,
      );
      const btn = screen.getByRole('button', { name: 'Menu' });
      await user.click(btn);
      act(() => screen.getByRole('button', { name: 'outside' }).focus());
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });
  });
});

describe('Nav (v2)', () => {
  it('is a floating rounded bar with a sliding active indicator hidden from assistive tech', () => {
    render(<Nav />);
    expect(document.querySelector('.nav__bar')).not.toBeNull();
    const ind = document.querySelector('.nav__indicator');
    expect(ind).toHaveAttribute('aria-hidden', 'true');
    expect(ind).toHaveAttribute('data-for', '');
  });

  it('points the indicator at the active section', () => {
    render(<Nav />);
    act(() => ioCb?.([{ target: document.getElementById('xray')!, isIntersecting: true }]));
    expect(document.querySelector('.nav__indicator')).toHaveAttribute('data-for', 'xray');
  });
});

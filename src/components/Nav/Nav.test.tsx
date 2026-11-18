import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Nav, NAV_ITEMS } from './Nav';

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
    expect(hrefs).toEqual(['#top', ...NAV_ITEMS.map((i) => `#${i.id}`)]);
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'about',
      'safesurf',
      'drone',
      'xray',
      'experience',
      'contact',
    ]);
  });
});

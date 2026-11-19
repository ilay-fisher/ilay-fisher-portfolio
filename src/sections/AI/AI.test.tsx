import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AI from './index';

describe('AI section', () => {
  it('is a section with id ai named by its heading', () => {
    const { container } = render(<AI />);
    const section = container.querySelector('section#ai');
    expect(section).not.toBeNull();
    const heading = screen.getByRole('heading', { level: 2, name: 'AI and agent workflows' });
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('shows four cards with the item titles as h3, in order', () => {
    render(<AI />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Release-manager agent',
      'Custom skills',
      'Manager and subagent orchestration',
      'Content plugin',
    ]);
  });

  it('puts the 637-line script and the skill names on the page', () => {
    render(<AI />);
    expect(screen.getByText(/637-line release script/)).toBeInTheDocument();
    for (const name of ['diagnose', 'verify-avd', 'add-safeguard-setting', 'job-career-scan'])
      expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText('release', { selector: 'code' })).toBeInTheDocument();
  });

  it('makes no fake links: cards hold no anchors', () => {
    render(<AI />);
    for (const card of screen.getAllByRole('article')) {
      expect(card.querySelectorAll('a')).toHaveLength(0);
    }
  });

  it('links to the X-Ray and SafeSurf sections from the closing line', () => {
    render(<AI />);
    expect(screen.getByRole('link', { name: /X-Ray Lens/ })).toHaveAttribute('href', '#xray');
    expect(screen.getByRole('link', { name: /SafeSurf/ })).toHaveAttribute('href', '#safesurf');
  });

  it('has no sharp corner hooks: cards use the rounded bevel class', () => {
    const { container } = render(<AI />);
    for (const card of container.querySelectorAll('article')) {
      expect(card).toHaveClass('bevel');
    }
  });
});

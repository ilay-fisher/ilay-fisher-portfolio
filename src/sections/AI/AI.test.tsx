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

  it('shows three cards with the item titles as h3, in order', () => {
    render(<AI />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Release-manager agent',
      'Manager and subagent orchestration',
      'Skills, plugins and scheduled tasks',
    ]);
  });

  it('puts the 637-line script and the orchestration flow on the page', () => {
    render(<AI />);
    expect(screen.getByText(/637-line release script/)).toBeInTheDocument();
    expect(screen.getByText(/squash-merges and deploys/)).toBeInTheDocument();
  });

  it('makes no fake links: cards hold no anchors', () => {
    render(<AI />);
    for (const card of screen.getAllByRole('article')) {
      expect(card.querySelectorAll('a')).toHaveLength(0);
    }
  });

  it('has no closing line and no links at all: the projects are not framed as AI work', () => {
    const { container } = render(<AI />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/projects below|More AI work/i);
  });

  it('has no sharp corner hooks: cards use the rounded bevel class', () => {
    const { container } = render(<AI />);
    for (const card of container.querySelectorAll('article')) {
      expect(card).toHaveClass('bevel');
    }
  });
});

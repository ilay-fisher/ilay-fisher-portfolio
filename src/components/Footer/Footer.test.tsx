import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { profile } from '../../content/profile';
import { Footer } from './Footer';

describe('Footer', () => {
  it('shows the name, year and the public links', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Ilay Fisher');
    expect(screen.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
      'href',
      profile.links.linkedin,
    );
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      profile.links.github,
    );
    expect(screen.getByRole('link', { name: /Email/ })).toHaveAttribute(
      'href',
      `mailto:${profile.email}`,
    );
  });
});

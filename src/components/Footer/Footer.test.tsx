import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { profile } from '../../content/profile';
import { Footer, REPO_URL } from './Footer';

describe('Footer', () => {
  it('shows the name, current year and location', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Ilay Fisher');
    expect(footer).toHaveTextContent(String(new Date().getFullYear()));
    expect(footer).toHaveTextContent(profile.location);
  });

  it('links to LinkedIn, GitHub and email', () => {
    render(<Footer />);
    const li = screen.getByRole('link', { name: /LinkedIn/ });
    expect(li).toHaveAttribute('href', profile.links.linkedin);
    expect(li).toHaveAttribute('rel', 'noopener noreferrer');
    const gh = screen.getByRole('link', { name: /^GitHub/ });
    expect(gh).toHaveAttribute('href', profile.links.github);
    expect(gh).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Email/ })).toHaveAttribute(
      'href',
      `mailto:${profile.email}`,
    );
  });

  it('has a built-with line linking to the repository', () => {
    render(<Footer />);
    expect(REPO_URL).toBe('https://github.com/ilay-fisher/ilay-fisher-portfolio');
    const repo = screen.getByRole('link', { name: /source/i });
    expect(repo).toHaveAttribute('href', REPO_URL);
    expect(repo).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/Built with/)).toBeInTheDocument();
  });

  it('has a back-to-top link to #top', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /Back to top/ })).toHaveAttribute('href', '#top');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Root } from './Root';

describe('Root', () => {
  it('renders the home page at /', async () => {
    const { container } = render(<Root pathname="/" />);
    expect(container.querySelector('main#main > section#top')).not.toBeNull();
  });

  it('renders a project page at /work/drone', async () => {
    render(<Root pathname="/work/drone" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Obstacle-Avoidance/ }),
    ).toBeInTheDocument();
    expect(document.querySelector('main#main > section#top')).toBeNull();
  });

  it('renders not found for an unknown work slug', async () => {
    render(<Root pathname="/work/nope" />);
    expect(await screen.findByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});

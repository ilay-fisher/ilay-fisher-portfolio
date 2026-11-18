import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profile } from '../../content/profile';

const webgl = vi.hoisted(() => ({ available: false }));
vi.mock('../../lib/webgl', async (orig) => ({
  ...(await orig<typeof import('../../lib/webgl')>()),
  isWebGLAvailable: () => webgl.available,
}));

import Hero from './index';

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('Hero markup', () => {
  beforeEach(() => {
    webgl.available = false;
    stubReducedMotion(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has one h1 with the name, the thesis, role and availability as real text', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1, name: profile.name })).toBeInTheDocument();
    expect(screen.getByText(profile.thesis)).toBeInTheDocument();
    expect(screen.getByText(profile.role)).toBeInTheDocument();
    expect(screen.getByText(profile.availability)).toBeInTheDocument();
  });

  it('keeps the h1 for assistive tech but does not show a second, small copy of the name', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('visually-hidden');
  });

  it('shows a factual hits counter next to the approved line, with nothing extra', () => {
    webgl.available = true;
    render(<Hero />);
    const hits = screen.getByTestId('hero-hits');
    expect(hits).toHaveTextContent(/^Hits on the name: 0\. Damage: 0\.$/);
  });

  it('has a hover chip for object names that assistive tech does not read twice', () => {
    webgl.available = true;
    render(<Hero />);
    const chip = screen.getByTestId('hero-chip');
    expect(chip).toHaveAttribute('aria-hidden', 'true');
    expect(chip).toHaveAttribute('hidden');
  });

  it('links its two actions to the SafeSurf and contact sections', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: /safesurf/i })).toHaveAttribute('href', '#safesurf');
    expect(screen.getByRole('link', { name: /touch|contact/i })).toHaveAttribute(
      'href',
      '#contact',
    );
  });

  it('is the #top section and keeps the hero-canvas test id on a canvas', () => {
    const { container } = render(<Hero />);
    expect(container.querySelector('section#top')).not.toBeNull();
    expect(screen.getByTestId('hero-canvas').tagName).toBe('CANVAS');
  });

  it('shows the approved invitation line verbatim next to the scene', () => {
    webgl.available = true;
    render(<Hero />);
    expect(
      screen.getByText('Throw things at my name. Cheaper than therapy. It holds.'),
    ).toBeInTheDocument();
  });

  it('has a scroll cue to the next section', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: /scroll/i })).toHaveAttribute('href', '#about');
  });
});

describe('Hero fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the still and starts no render loop without WebGL2', () => {
    webgl.available = false;
    stubReducedMotion(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { container } = render(<Hero />);
    expect(container.querySelector('img.hero__still')).not.toBeNull();
    expect(screen.getByTestId('hero-canvas')).toHaveAttribute('data-ready', 'false');
    expect(raf).not.toHaveBeenCalled();
  });

  it('shows the still and starts no render loop under reduced motion', () => {
    webgl.available = true;
    stubReducedMotion(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { container } = render(<Hero />);
    expect(container.querySelector('img.hero__still')).not.toBeNull();
    expect(raf).not.toHaveBeenCalled();
  });

  it('does not render the still when the live scene is allowed', () => {
    webgl.available = true;
    stubReducedMotion(false);
    const { container } = render(<Hero />);
    expect(container.querySelector('img.hero__still')).toBeNull();
  });
});

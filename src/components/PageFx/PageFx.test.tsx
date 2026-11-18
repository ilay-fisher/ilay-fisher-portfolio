import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageFx } from './PageFx';

function stubMedia(opts: { reduced: boolean; fine: boolean }) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? opts.reduced : q.includes('hover: hover') ? opts.fine : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('PageFx', () => {
  it('renders the ambient glows, grain and cursor for a fine pointer with motion allowed', () => {
    stubMedia({ reduced: false, fine: true });
    render(<PageFx />);
    expect(screen.getByTestId('ambient')).toHaveAttribute('data-drift', 'true');
    expect(screen.getByTestId('grain')).toBeInTheDocument();
    expect(screen.getByTestId('cursor')).toBeInTheDocument();
  });

  it('renders no cursor and no grain under reduced motion, and the ambient glows stay still', () => {
    stubMedia({ reduced: true, fine: true });
    render(<PageFx />);
    expect(screen.queryByTestId('cursor')).toBeNull();
    expect(screen.queryByTestId('grain')).toBeNull();
    expect(screen.getByTestId('ambient')).toHaveAttribute('data-drift', 'false');
  });

  it('renders no cursor and no grain on touch devices', () => {
    stubMedia({ reduced: false, fine: false });
    render(<PageFx />);
    expect(screen.queryByTestId('cursor')).toBeNull();
    expect(screen.queryByTestId('grain')).toBeNull();
  });

  it('hides every effect from assistive tech and never intercepts the pointer', () => {
    stubMedia({ reduced: false, fine: true });
    render(<PageFx />);
    for (const id of ['ambient', 'grain', 'cursor']) {
      expect(screen.getByTestId(id)).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

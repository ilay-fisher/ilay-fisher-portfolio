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
  it('renders light pools, grain and the cursor for a fine pointer with motion allowed', () => {
    stubMedia({ reduced: false, fine: true });
    render(<PageFx />);
    expect(screen.getByTestId('ambient')).toHaveAttribute('data-drift', 'true');
    expect(screen.getByTestId('grain')).toHaveAttribute('data-moving', 'true');
    expect(screen.getByTestId('cursor')).toBeInTheDocument();
  });

  it('under reduced motion: no cursor, still grain, still light pools', () => {
    stubMedia({ reduced: true, fine: true });
    render(<PageFx />);
    expect(screen.queryByTestId('cursor')).toBeNull();
    expect(screen.getByTestId('grain')).toHaveAttribute('data-moving', 'false');
    expect(screen.getByTestId('ambient')).toHaveAttribute('data-drift', 'false');
  });

  it('on touch devices there is no cursor and the grain does not move', () => {
    stubMedia({ reduced: false, fine: false });
    render(<PageFx />);
    expect(screen.queryByTestId('cursor')).toBeNull();
    expect(screen.getByTestId('grain')).toHaveAttribute('data-moving', 'false');
  });

  it('hides every effect from assistive tech', () => {
    stubMedia({ reduced: false, fine: true });
    render(<PageFx />);
    for (const id of ['ambient', 'grain', 'cursor']) {
      expect(screen.getByTestId(id)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('does not hide the native cursor until the first mouse move', () => {
    stubMedia({ reduced: false, fine: true });
    render(<PageFx />);
    expect(document.documentElement.classList.contains('has-cursor')).toBe(false);
  });
});

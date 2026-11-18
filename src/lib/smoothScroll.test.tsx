import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lenisInstances: {
  destroy: ReturnType<typeof vi.fn>;
  raf: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock('lenis', () => ({
  default: class {
    destroy = vi.fn();
    raf = vi.fn();
    on = vi.fn();
    constructor() {
      lenisInstances.push(this);
    }
  },
}));

import { SmoothScroll } from './smoothScroll';
import { gsap } from './gsap';

function stubReduced(reduced: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('SmoothScroll', () => {
  beforeEach(() => {
    lenisInstances.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders children', () => {
    stubReduced(false);
    render(
      <SmoothScroll>
        <p>content</p>
      </SmoothScroll>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('creates Lenis, drives it from the gsap ticker and destroys it on unmount', () => {
    stubReduced(false);
    const add = vi.spyOn(gsap.ticker, 'add');
    const remove = vi.spyOn(gsap.ticker, 'remove');
    const { unmount } = render(<SmoothScroll>x</SmoothScroll>);
    expect(lenisInstances).toHaveLength(1);
    expect(add).toHaveBeenCalledTimes(1);
    unmount();
    const tick = add.mock.calls[0]![0];
    expect(remove).toHaveBeenCalledWith(tick);
    expect(lenisInstances[0]!.destroy).toHaveBeenCalled();
  });

  it('does nothing under prefers-reduced-motion', () => {
    stubReduced(true);
    render(<SmoothScroll>x</SmoothScroll>);
    expect(lenisInstances).toHaveLength(0);
    expect(document.documentElement).toHaveClass('reduce-motion');
  });
});

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from './Reveal';

function stubReduced(reduced: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('Reveal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders its children with the requested tag and variant attribute', () => {
    stubReduced(true);
    render(
      <Reveal as="p" variant="fade">
        hello
      </Reveal>,
    );
    const el = screen.getByText('hello');
    expect(el.tagName).toBe('P');
    expect(el).toHaveAttribute('data-reveal', 'fade');
  });

  it('under reduced motion marks itself ready and applies no inline styles', () => {
    stubReduced(true);
    render(<Reveal>x</Reveal>);
    const el = screen.getByText('x');
    expect(el).toHaveAttribute('data-reveal-ready', 'true');
    expect(el.getAttribute('style')).toBeNull();
  });

  it('with motion allowed it starts hidden through gsap and becomes ready', () => {
    stubReduced(false);
    render(<Reveal variant="up">y</Reveal>);
    const el = screen.getByText('y');
    expect(el).toHaveAttribute('data-reveal-ready', 'true');
    expect(el.style.opacity).toBe('0');
  });
});

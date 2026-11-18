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

  it('words variant splits the text into words and keeps it readable', () => {
    stubReduced(false);
    render(
      <Reveal as="h2" variant="words">
        Built alone today
      </Reveal>,
    );
    const el = screen.getByRole('heading');
    expect(el).toHaveAttribute('data-reveal', 'words');
    expect(el).toHaveTextContent('Built alone today');
  });

  it('stagger variant hides its direct children through gsap and marks itself ready', () => {
    stubReduced(false);
    render(
      <Reveal variant="stagger">
        <p>one</p>
        <p>two</p>
      </Reveal>,
    );
    expect(screen.getByText('one').style.opacity).toBe('0');
    expect(screen.getByText('two').style.opacity).toBe('0');
    expect(screen.getByText('one').parentElement).toHaveAttribute('data-reveal-ready', 'true');
  });

  it('stagger variant leaves children untouched under reduced motion', () => {
    stubReduced(true);
    render(
      <Reveal variant="stagger">
        <p>one</p>
      </Reveal>,
    );
    expect(screen.getByText('one').getAttribute('style')).toBeNull();
  });
});

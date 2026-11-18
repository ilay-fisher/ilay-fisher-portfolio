import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

const ORDER = ['top', 'about', 'safesurf', 'drone', 'xray', 'experience', 'contact'];

describe('App', () => {
  it('composes the seven sections in contract order inside main', () => {
    const { container } = render(<App />);
    const main = container.querySelector('main#main');
    expect(main).not.toBeNull();
    const ids = Array.from(main!.querySelectorAll(':scope > section')).map((s) => s.id);
    expect(ids).toEqual(ORDER);
  });

  it('has exactly one h1', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('exposes the demo test ids from CONTRACTS.md', () => {
    const { getByTestId } = render(<App />);
    for (const id of ['hero-canvas', 'safesurf-demo', 'drone-demo', 'xray-demo']) {
      expect(getByTestId(id)).toBeInTheDocument();
    }
  });
});

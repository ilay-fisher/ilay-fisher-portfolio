import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const webgl = vi.hoisted(() => ({ available: false }));
vi.mock('../../../lib/webgl', () => ({
  isWebGLAvailable: () => webgl.available,
  cappedDpr: () => 1,
}));

import { SafeSurfDemo } from './SafeSurfDemo';

const figures = () => Array.from(document.querySelectorAll<HTMLElement>('[data-ss-media]'));
const states = () => figures().map((f) => f.dataset.state);
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  webgl.available = false;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SafeSurfDemo', () => {
  it('blocks every image and video by default while the article text stays', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    expect(screen.getByTestId('safesurf-demo')).toBeInTheDocument();
    expect(figures()).toHaveLength(5);
    expect(states().every((s) => s === 'blocked')).toBe(true);
    expect(screen.getByRole('heading', { level: 3 })).toBeVisible();
    expect(screen.getByTestId('safesurf-status')).toHaveTextContent(
      'Filter on. 4 images blocked, 1 video blocked.',
    );
  });

  it('switching the filter off queues a request: countdown starts, images stay blocked', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    const sw = screen.getByRole('switch', { name: /safesurf filter/i });
    expect(sw).toBeChecked();
    fireEvent.click(sw);
    expect(sw).toBeChecked();
    expect(screen.getByTestId('safesurf-countdown')).toHaveTextContent('8');
    expect(states().every((s) => s === 'blocked')).toBe(true);
    advance(3000);
    expect(screen.getByTestId('safesurf-countdown')).toHaveTextContent('5');
    expect(screen.getByTestId('safesurf-status')).toHaveTextContent('Unlock request: 5 s left.');
  });

  it('applies the change when the delay ends', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    fireEvent.click(screen.getByRole('switch', { name: /safesurf filter/i }));
    advance(8200);
    expect(screen.getByRole('switch', { name: /safesurf filter/i })).not.toBeChecked();
    expect(states().every((s) => s === 'allowed')).toBe(true);
    expect(screen.getByTestId('safesurf-status')).toHaveTextContent('Filter off. Nothing blocked.');
  });

  it('allow for this site waits, can be cancelled, and blocking again is instant', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    click(/allow for this site/i);
    expect(states().every((s) => s === 'blocked')).toBe(true);
    click(/cancel request/i);
    expect(screen.getByTestId('safesurf-countdown')).not.toHaveTextContent(/\d/);
    advance(10000);
    expect(states().every((s) => s === 'blocked')).toBe(true);

    click(/allow for this site/i);
    advance(8000);
    expect(states().every((s) => s === 'allowed')).toBe(true);
    click(/block again/i);
    expect(states().every((s) => s === 'blocked')).toBe(true);
  });

  it('ask sponsor applies a pending request at once', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    click(/allow for this site/i);
    click(/ask sponsor/i);
    expect(states().every((s) => s === 'allowed')).toBe(true);
  });

  it('allow only the video shows the video and keeps the images blocked', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    click(/allow only the video/i);
    click(/ask sponsor/i);
    const video = document.querySelector<HTMLElement>('[data-ss-media="video"]');
    expect(video?.dataset.state).toBe('allowed');
    expect(states().filter((s) => s === 'blocked')).toHaveLength(4);
  });

  it('page scope does not carry to the next page, site scope does', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    click(/allow for this page/i);
    click(/ask sponsor/i);
    fireEvent.click(screen.getByRole('link', { name: /wind at the bar/i }));
    expect(figures()).toHaveLength(2);
    expect(states().every((s) => s === 'blocked')).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: /back to the harbour/i }));
    expect(states().every((s) => s === 'allowed')).toBe(true);
  });

  it('refuses each bypass attempt with a specific SafeGuard line', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    click(/change private dns/i);
    expect(screen.getByTestId('safesurf-bypass-result')).toHaveTextContent(/private DNS/i);
    click(/open another browser/i);
    expect(screen.getByTestId('safesurf-bypass-result')).toHaveTextContent(/other browsers/i);
    expect(states().every((s) => s === 'blocked')).toBe(true);
  });

  it('announces changes through one polite live region', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    const live = screen.getByTestId('safesurf-live');
    expect(live).toHaveAttribute('aria-live', 'polite');
    click(/allow for this site/i);
    expect(within(live).getByText(/allow images for this site/i)).toBeInTheDocument();
    advance(2000);
    expect(live.textContent).not.toMatch(/\d+ s left/);
  });

  it('uses the CSS fallback when WebGL2 is not available', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    expect(screen.getByTestId('safesurf-demo')).toHaveAttribute('data-render', 'css');
  });

  it('swaps instantly under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    webgl.available = true;
    render(<SafeSurfDemo delayMs={8000} />);
    const root = screen.getByTestId('safesurf-demo');
    expect(root).toHaveAttribute('data-motion', 'reduced');
    expect(root).toHaveAttribute('data-render', 'css');
    click(/allow for this site/i);
    click(/ask sponsor/i);
    expect(states().every((s) => s === 'allowed')).toBe(true);
  });
});

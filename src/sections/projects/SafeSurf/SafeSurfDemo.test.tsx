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

  it('the lock shakes when a second request is refused, and the ring marks each way it opens', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    const lock = document.querySelector<HTMLElement>('.ss-lock')!;
    expect(lock.dataset.shake).toBeUndefined();
    click(/allow for this site/i);
    expect(lock.dataset.shake).toBeUndefined();
    click(/allow for this page/i);
    expect(['0', '1']).toContain(lock.dataset.shake);
    // The ring ticks once a second: five of eight seconds left is five eighths of the arc.
    advance(3000);
    const arc = document.querySelector<SVGElement>('.ss-ring__arc')!;
    const circ = 2 * Math.PI * 22;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(circ * (1 - 5 / 8), 1);
    expect(document.querySelector('.ss-ring__pulse')).not.toBeNull();
    click(/ask sponsor/i);
    expect(document.querySelector('.ss-ring__snap')?.getAttribute('data-via')).toBe('sponsor');
    expect(document.querySelector('.ss-ring__check')).not.toBeNull();
  });

  it('a delay that runs out snaps the ring without the sponsor check', () => {
    render(<SafeSurfDemo delayMs={2000} />);
    click(/allow for this site/i);
    advance(2300);
    expect(document.querySelector('.ss-ring__snap')?.getAttribute('data-via')).toBe('delay');
    expect(document.querySelector('.ss-ring__check')).toBeNull();
  });

  it('every blocked tile is a labelled, numbered object, not an empty box', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    const tiles = document.querySelectorAll('.ss-media__tile');
    expect(tiles).toHaveLength(5);
    expect(tiles[0]).toHaveTextContent('Image 1');
    expect(tiles[0]).toHaveTextContent('Image blocked');
    const video = document.querySelector('[data-ss-media="video"] .ss-media__tile')!;
    expect(video).toHaveTextContent(/Video \d/);
    expect(video).toHaveTextContent('Withheld by SafeSurf');
  });

  it('keeps the bypass result animation to refusals only', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    const out = screen.getByTestId('safesurf-bypass-result');
    expect(out.dataset.p).toBeUndefined();
    click(/open another browser/i);
    expect(out.dataset.p).toBe('1');
    click(/change private dns/i);
    expect(out.dataset.p).toBe('0');
  });
});

describe('SafeSurfDemo composition', () => {
  it('hides controls that do nothing: no cancel or sponsor while idle, no block while all is blocked', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    expect(screen.queryByTestId('safesurf-cancel')).toBeNull();
    expect(screen.queryByTestId('safesurf-sponsor')).toBeNull();
    expect(screen.queryByTestId('safesurf-block')).toBeNull();
    click(/allow for this site/i);
    expect(screen.getByTestId('safesurf-cancel')).toBeInTheDocument();
    advance(8000);
    expect(screen.queryByTestId('safesurf-allow-site')).toBeNull();
    expect(screen.getByTestId('safesurf-block')).toBeInTheDocument();
  });

  it('shows one witty line at a time: the invitation, then the waiting line', () => {
    render(<SafeSurfDemo delayMs={8000} />);
    const invite = 'Go ahead, turn it off. Everyone tries. It waits.';
    const waiting = 'Want it now? So did I. Come back in an hour.';
    expect(screen.getByText(invite)).toBeInTheDocument();
    expect(screen.queryByText(waiting)).toBeNull();
    click(/allow for this site/i);
    expect(screen.getByText(waiting)).toBeInTheDocument();
    expect(screen.queryByText(invite)).toBeNull();
  });
});

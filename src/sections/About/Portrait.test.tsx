import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import manifest from './avatar/frames.json';

const engine = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('./avatar/avatarEngine', () => ({
  startAvatar: (opts: unknown) => {
    engine.start(opts);
    return { stop: engine.stop };
  },
}));

import { Portrait } from './Portrait';

type Loader = (only?: number[]) => Promise<Array<HTMLImageElement | undefined>>;
const fakeFrames = () => Array.from({ length: manifest.count }, () => new Image());

function mockReduced(reduced: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

let intersect: ((v: boolean) => void) | null = null;
beforeEach(() => {
  engine.start.mockClear();
  engine.stop.mockClear();
  intersect = null;
  mockReduced(false);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (e: Array<{ isIntersecting: boolean }>) => void) {
        intersect = (v) => cb([{ isIntersecting: v }]);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const stage = () => document.querySelector('.avatar__stage') as HTMLElement;

describe('Portrait avatar', () => {
  it('shows the illustrated still first, free on the stage, with honest alt text', () => {
    render(<Portrait loader={vi.fn<Loader>(() => new Promise(() => {}))} />);
    const img = screen.getByRole('img', { name: 'Illustrated avatar of Ilay Fisher' });
    expect(img).toHaveAttribute('src', `${manifest.dir}${manifest.still}`);
    expect(img.closest('.avatar')).not.toBeNull();
    expect(img.closest('.lens')).toBeNull();
    expect(stage()).toHaveAttribute('data-avatar', 'still');
  });

  it('does not fetch frames until About is near the viewport', async () => {
    const loader = vi.fn<Loader>(async () => fakeFrames());
    render(<Portrait loader={loader} />);
    expect(loader).not.toHaveBeenCalled();
    act(() => intersect?.(true));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    expect(loader.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('starts the engine once frames arrive and switches to frame mode when it reports ready', async () => {
    render(<Portrait loader={async () => fakeFrames()} />);
    act(() => intersect?.(true));
    await waitFor(() => expect(engine.start).toHaveBeenCalledTimes(1));
    const opts = engine.start.mock.calls[0]![0] as {
      reduced: boolean;
      frames: unknown[];
      onReady: () => void;
    };
    expect(opts.reduced).toBe(false);
    expect(opts.frames).toHaveLength(manifest.count);
    act(() => opts.onReady());
    expect(stage()).toHaveAttribute('data-avatar', 'frames');
  });

  it('keeps the still when the frames fail to load', async () => {
    const loader = vi.fn<Loader>(async () => {
      throw new Error('404');
    });
    render(<Portrait loader={loader} />);
    act(() => intersect?.(true));
    await waitFor(() => expect(loader).toHaveBeenCalled());
    await Promise.resolve();
    expect(engine.start).not.toHaveBeenCalled();
    expect(stage()).toHaveAttribute('data-avatar', 'still');
    expect(screen.getByRole('img', { name: /Illustrated avatar/ })).toBeInTheDocument();
  });

  it('falls back to the IF monogram when the still fails too', () => {
    render(<Portrait loader={vi.fn<Loader>(() => new Promise(() => {}))} />);
    fireEvent.error(screen.getByRole('img', { name: /Illustrated avatar/ }));
    expect(document.querySelector('.avatar img')).toBeNull();
    expect(document.querySelector('.avatar .avatar__monogram')).toHaveTextContent('IF');
    expect(stage()).toHaveAttribute('data-avatar', 'monogram');
  });

  it('under reduced motion loads only the neutral frame and renders it static', async () => {
    mockReduced(true);
    const loader = vi.fn<Loader>(async () => {
      const arr: Array<HTMLImageElement | undefined> = new Array(manifest.count).fill(undefined);
      arr[manifest.neutral] = new Image();
      return arr;
    });
    render(<Portrait loader={loader} />);
    act(() => intersect?.(true));
    await waitFor(() => expect(engine.start).toHaveBeenCalledTimes(1));
    expect(loader.mock.calls[0]?.[0]).toEqual([manifest.neutral]);
    const opts = engine.start.mock.calls[0]![0] as { reduced: boolean; onReady: () => void };
    expect(opts.reduced).toBe(true);
    act(() => opts.onReady());
    expect(stage()).toHaveAttribute('data-avatar', 'static');
  });

  it('stops the engine on unmount', async () => {
    const { unmount } = render(<Portrait loader={async () => fakeFrames()} />);
    act(() => intersect?.(true));
    await waitFor(() => expect(engine.start).toHaveBeenCalled());
    unmount();
    expect(engine.stop).toHaveBeenCalled();
  });
});

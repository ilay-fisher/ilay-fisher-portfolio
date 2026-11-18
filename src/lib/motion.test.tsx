import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInView, usePrefersReducedMotion, useRafLoop } from './motion';

describe('usePrefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubMatchMedia(matches: boolean) {
    const listeners = new Set<() => void>();
    const mql = {
      matches,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    };
    vi.stubGlobal('matchMedia', () => mql);
    return {
      set(value: boolean) {
        mql.matches = value;
        listeners.forEach((l) => l());
      },
    };
  }

  it('reflects the media query', () => {
    stubMatchMedia(true);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });

  it('updates when the preference changes', () => {
    const ctl = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => ctl.set(true));
    expect(result.current).toBe(true);
  });

  it('is false when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });
});

describe('useInView', () => {
  type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let callback: Callback;
  const disconnect = vi.fn();
  beforeEach(() => {
    class FakeIO {
      constructor(cb: Callback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
    vi.stubGlobal('IntersectionObserver', FakeIO);
  });
  afterEach(() => vi.unstubAllGlobals());

  function Probe() {
    const [ref, inView] = useInView<HTMLDivElement>();
    return <div ref={ref} data-testid="p" data-in={String(inView)} />;
  }

  it('reports intersection changes and disconnects on unmount', () => {
    const { getByTestId, unmount } = render(<Probe />);
    expect(getByTestId('p').dataset.in).toBe('false');
    act(() => callback([{ isIntersecting: true }]));
    expect(getByTestId('p').dataset.in).toBe('true');
    act(() => callback([{ isIntersecting: false }]));
    expect(getByTestId('p').dataset.in).toBe('false');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('useRafLoop', () => {
  let frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    frames = [];
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const tick = (t: number) => {
    const cb = frames.shift();
    act(() => cb?.(t));
  };

  it('calls back with delta and absolute time while active', () => {
    const cb = vi.fn();
    renderHook(() => useRafLoop(cb, true));
    tick(100);
    tick(116);
    expect(cb).toHaveBeenNthCalledWith(2, 16, 116);
  });

  it('does not schedule frames when inactive', () => {
    renderHook(() => useRafLoop(vi.fn(), false));
    expect(frames.length).toBe(0);
  });

  it('stops when the tab is hidden and resumes when visible', () => {
    const cb = vi.fn();
    renderHook(() => useRafLoop(cb, true));
    tick(10);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick(30);
    expect(cb).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(frames.length).toBeGreaterThan(0);
  });

  it('uses the latest callback without restarting', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useRafLoop(cb, true), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    tick(5);
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });
});

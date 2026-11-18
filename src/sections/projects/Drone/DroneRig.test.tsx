import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DroneRig } from './DroneRig';

/** A 2D context stand-in: every method is a no-op, every property is writable. */
function stubContext(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, k: string) => {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') {
        return () => ({ addColorStop: () => undefined });
      }
      return () => undefined;
    },
    set: (t, k: string, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as MediaQueryList) as typeof window.matchMedia;
}

class InViewObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never);
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => stubContext() as never,
  );
  mockMatchMedia(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const text = (id: string) => screen.getByTestId(id).textContent;

describe('DroneRig', () => {
  it('shows the approved invitation line and marks the stage as a draw surface', () => {
    render(<DroneRig seed={1} autoRun={false} clock="manual" />);
    expect(screen.getByTestId('drone-invite')).toHaveTextContent(
      "Get in its way. It won't take it personally. It re-plans.",
    );
    expect(screen.getByTestId('drone-demo')).toHaveAttribute('data-clock', 'manual');
    expect(screen.getByTestId('drone-canvas').closest('[data-cursor="draw"]')).not.toBeNull();
  });

  it('renders the rig, the canvas, the tools and the readout', () => {
    render(<DroneRig seed={1} autoRun={false} />);
    expect(screen.getByTestId('drone-demo')).toBeInTheDocument();
    expect(screen.getByTestId('drone-canvas')).toBeInstanceOf(HTMLCanvasElement);
    for (const id of [
      'drone-tool-obstacle',
      'drone-tool-wind',
      'drone-tool-goal',
      'drone-erase',
      'drone-draw-mode',
      'drone-btn-drop',
      'drone-btn-wind',
      'drone-btn-goal',
      'drone-btn-reset',
      'drone-algo-astar',
      'drone-algo-dstar',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(text('drone-readout-algorithm')).toBe('A*');
    expect(text('drone-readout-replans')).toBe('0');
    expect(Number(text('drone-readout-expanded')?.replace(/,/g, ''))).toBeGreaterThan(0);
    expect(text('drone-readout-time')).toMatch(/ms$/);
    expect(text('drone-readout-cost')).toMatch(/^\d+\.\d$/);
  });

  it('says the rig runs TypeScript in the browser while the real project is C++17 on WebAssembly', () => {
    render(<DroneRig seed={1} autoRun={false} />);
    const caption = screen.getByTestId('drone-caption');
    expect(caption).toHaveTextContent(/TypeScript/);
    expect(caption).toHaveTextContent(/C\+\+17/);
    expect(caption).toHaveTextContent(/WebAssembly/);
  });

  it('the Drop obstacle button re-plans and the live region announces it', async () => {
    const user = userEvent.setup();
    render(<DroneRig seed={1} autoRun={false} />);
    await user.click(screen.getByTestId('drone-btn-drop'));
    expect(text('drone-readout-replans')).toBe('1');
    const live = screen.getByTestId('drone-live');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('role', 'status');
    expect(live.textContent).toMatch(/^Route blocked\. Re-planned in .* ms, \d+ nodes?\.$/);
  });

  it('the Add wind zone, New goal and Reset buttons drive the model', async () => {
    const user = userEvent.setup();
    render(<DroneRig seed={2} autoRun={false} />);
    await user.click(screen.getByTestId('drone-btn-wind'));
    expect(text('drone-readout-replans')).toBe('1');
    expect(screen.getByTestId('drone-live').textContent).toMatch(/^Wind zone on the route\./);
    await user.click(screen.getByTestId('drone-btn-goal'));
    expect(text('drone-readout-replans')).toBe('2');
    expect(screen.getByTestId('drone-live').textContent).toMatch(/^New goal\./);
    await user.click(screen.getByTestId('drone-btn-reset'));
    expect(text('drone-readout-replans')).toBe('0');
    expect(screen.getByTestId('drone-live').textContent).toMatch(/^Reset/);
  });

  it('switching to D* Lite updates the readout and shows the node comparison', async () => {
    const user = userEvent.setup();
    render(<DroneRig seed={3} autoRun={false} />);
    await user.click(screen.getByTestId('drone-algo-dstar'));
    expect(text('drone-readout-algorithm')).toBe('D* Lite');
    expect(screen.getByTestId('drone-algo-dstar')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('drone-algo-astar')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByTestId('drone-btn-drop'));
    expect(Number(text('drone-compare-astar')?.replace(/,/g, ''))).toBeGreaterThan(0);
    expect(Number(text('drone-compare-dstar')?.replace(/,/g, ''))).toBeGreaterThan(0);
  });

  it('tool buttons are a pressed-state group', async () => {
    const user = userEvent.setup();
    render(<DroneRig seed={1} autoRun={false} />);
    const tools = screen.getByRole('group', { name: /tool/i });
    expect(within(tools).getByTestId('drone-tool-obstacle')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByTestId('drone-tool-wind'));
    expect(screen.getByTestId('drone-tool-wind')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('drone-tool-obstacle')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByTestId('drone-erase'));
    expect(screen.getByTestId('drone-erase')).toHaveAttribute('aria-pressed', 'true');
  });

  it('runs itself until the visitor interacts', async () => {
    const user = userEvent.setup();
    render(<DroneRig seed={1} autoRun />);
    expect(screen.getByTestId('drone-demo')).toHaveAttribute('data-mode', 'demo');
    await user.click(screen.getByTestId('drone-tool-wind'));
    expect(screen.getByTestId('drone-demo')).toHaveAttribute('data-mode', 'manual');
  });

  it('starts a frame loop when visible and motion is allowed', () => {
    vi.stubGlobal('IntersectionObserver', InViewObserver);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    render(<DroneRig seed={1} autoRun={false} />);
    expect(raf).toHaveBeenCalled();
    expect(screen.getByTestId('drone-demo')).toHaveAttribute('data-motion', 'live');
  });

  it('does not start a continuous loop under reduced motion, and still shows a route', async () => {
    mockMatchMedia(true);
    vi.stubGlobal('IntersectionObserver', InViewObserver);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const user = userEvent.setup();
    render(<DroneRig seed={1} autoRun />);
    await act(async () => {});
    expect(raf).not.toHaveBeenCalled();
    expect(screen.getByTestId('drone-demo')).toHaveAttribute('data-motion', 'static');
    expect(Number(text('drone-readout-expanded')?.replace(/,/g, ''))).toBeGreaterThan(0);
    // Buttons still work and re-draw once, with no loop.
    await user.click(screen.getByTestId('drone-btn-drop'));
    expect(text('drone-readout-replans')).toBe('1');
    expect(raf).not.toHaveBeenCalled();
  });

  it('exposes a test probe only when asked', () => {
    const { unmount } = render(<DroneRig seed={1} autoRun={false} />);
    expect((window as unknown as { __drone?: unknown }).__drone).toBeUndefined();
    unmount();
    render(<DroneRig seed={1} autoRun={false} expose />);
    const probe = (window as unknown as { __drone?: { state(): { replans: number } } }).__drone;
    expect(probe?.state().replans).toBe(0);
  });
});

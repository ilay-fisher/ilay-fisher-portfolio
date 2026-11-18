import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XRayDemo } from './XRayDemo';
import type { Analysis, AnalyzeFn } from './analysis';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../../../lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }),
}));

const REGIONS: Record<string, Analysis['regions']> = {
  pcb: [
    { x: 600, y: 160, w: 80, h: 40 },
    { x: 360, y: 236, w: 40, h: 28 },
  ],
  aerial: [{ x: 530, y: 160, w: 200, h: 160 }],
  ui: [{ x: 655, y: 290, w: 110, h: 55 }],
};
const fakeAnalysis = (id: string): Analysis => ({
  source: 'computed',
  heat: { width: 4, height: 4, rgba: new Uint8ClampedArray(64).fill(255) },
  regions: REGIONS[id] ?? [],
  ms: 7.3,
});
const analyze: AnalyzeFn = vi.fn(async (preset) => fakeAnalysis(preset.id));

function setReducedMotion(reduced: boolean) {
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

beforeEach(() => {
  warn.mockClear();
  vi.mocked(analyze).mockClear();
  setReducedMotion(true);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

async function ready() {
  render(<XRayDemo analyze={analyze} />);
  await screen.findByRole('button', { name: 'Region 1 of 2' });
}

describe('XRayDemo slider', () => {
  it('is a labelled range input exposing value text, resting at 50', async () => {
    await ready();
    const s = screen.getByTestId('xray-slider') as HTMLInputElement;
    expect(s).toHaveAttribute('type', 'range');
    expect(s).toHaveAccessibleName(/heatmap/i);
    expect(s.value).toBe('50');
    expect(s).toHaveAttribute('aria-valuetext', expect.stringContaining('50 percent'));
  });
  it('changing the value moves the clip and the value text', async () => {
    await ready();
    const s = screen.getByTestId('xray-slider') as HTMLInputElement;
    fireEvent.change(s, { target: { value: '80' } });
    expect(s).toHaveAttribute('aria-valuetext', expect.stringContaining('80 percent'));
    expect(screen.getByTestId('xray-heatmap').style.clipPath).toBe('inset(0px 20% 0px 0px)');
  });
});

describe('XRayDemo regions and diagnosis', () => {
  it('shows one real button per region with a positional name', async () => {
    await ready();
    expect(screen.getByRole('button', { name: 'Region 1 of 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Region 2 of 2' })).toBeInTheDocument();
    expect(screen.getByTestId('xray-region-1')).toBeInTheDocument();
    expect(screen.getByTestId('xray-region-2')).toBeInTheDocument();
  });
  it('selecting a region shows the crop pair, the recorded diagnosis and the replay note', async () => {
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Region 2 of 2' }));
    const panel = screen.getByTestId('xray-diagnosis');
    expect(within(panel).getByText('solder_bridge')).toBeInTheDocument();
    expect(within(panel).getByText('High')).toBeInTheDocument();
    expect(within(panel).getByText('82%')).toBeInTheDocument();
    expect(within(panel).getByTestId('xray-crop-pair')).toBeInTheDocument();
    expect(within(panel).getByTestId('xray-replay-note')).toHaveTextContent(
      /recorded result.*replayed.*not a live model call/i,
    );
    expect(screen.getByRole('button', { name: 'Region 2 of 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('announces the finished diagnosis politely, once', async () => {
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Region 1 of 2' }));
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/Region 1 of 2.*missing component/i);
  });
  it('types the description out over time when motion is allowed', async () => {
    setReducedMotion(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'Region 2 of 2' }));
      const text = screen.getByTestId('xray-description');
      expect(text.textContent!.length).toBeLessThan(10);
      expect(screen.getByRole('status')).toHaveTextContent('');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(text.textContent).toMatch(/bridging/);
      expect(screen.getByRole('status')).toHaveTextContent(/solder bridge/i);
    } finally {
      vi.useRealTimers();
    }
  });
  it('reduced motion shows the whole description at once', async () => {
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Region 2 of 2' }));
    expect(screen.getByTestId('xray-description').textContent).toMatch(/bridging/);
  });
});

describe('XRayDemo presets', () => {
  it('lists pcb, aerial and ui, pcb selected first', async () => {
    await ready();
    const group = screen.getByTestId('xray-preset');
    const btns = within(group).getAllByRole('button');
    expect(btns).toHaveLength(3);
    expect(btns[0]).toHaveAttribute('aria-pressed', 'true');
  });
  it('switching preset resets slider and selection and loads the new regions', async () => {
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Region 2 of 2' }));
    fireEvent.change(screen.getByTestId('xray-slider'), { target: { value: '90' } });
    await userEvent.click(screen.getByTestId('xray-preset-aerial'));
    await screen.findByRole('button', { name: 'Region 1 of 1' });
    expect(screen.queryByRole('button', { name: 'Region 2 of 2' })).toBeNull();
    expect((screen.getByTestId('xray-slider') as HTMLInputElement).value).toBe('50');
    expect(screen.getByTestId('xray-diagnosis')).toHaveTextContent(/select a region/i);
    await userEvent.click(screen.getByRole('button', { name: 'Region 1 of 1' }));
    expect(screen.getByTestId('xray-diagnosis')).toHaveTextContent('irrigation_stress');
  });
});

describe('XRayDemo readout', () => {
  it('shows the benchmark and the diff time measured here', async () => {
    await ready();
    const r = screen.getByTestId('xray-readout');
    expect(r).toHaveTextContent('2,460');
    expect(r).toHaveTextContent('117');
    expect(r).toHaveTextContent('43.7%');
    expect(within(r).getByTestId('xray-measured')).toHaveTextContent(/7\.3 ms.*measured here/i);
  });
});

describe('XRayDemo guess first', () => {
  it('hides the heatmap and regions until revealed', async () => {
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /guess first/i }));
    expect(screen.queryByRole('button', { name: 'Region 1 of 2' })).toBeNull();
    expect(screen.getByTestId('xray-heatmap').style.clipPath).toBe('inset(0px 100% 0px 0px)');
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByRole('button', { name: 'Region 1 of 2' })).toBeInTheDocument();
  });
});

describe('XRayDemo fallback', () => {
  it('uses the precomputed heatmap and regions, and warns, when pixel access fails', async () => {
    const failing: AnalyzeFn = vi.fn(async () => {
      throw new Error('SecurityError: canvas tainted');
    });
    render(<XRayDemo analyze={failing} />);
    await screen.findByRole('button', { name: 'Region 1 of 2' });
    const layer = screen.getByTestId('xray-heatmap');
    await waitFor(() => expect(layer).toHaveAttribute('data-source', 'fallback'));
    expect(layer.querySelector('img')).not.toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(screen.getByTestId('xray-measured')).toHaveTextContent(/not measured/i);
  });
});

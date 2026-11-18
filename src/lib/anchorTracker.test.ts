import { describe, expect, it } from 'vitest';
import { createAnchorTracker } from './anchorTracker';

/** A fake page: the target sits at `target`, the scroller eases `pos` toward the last requested y. */
function fakePage(initialTarget: number) {
  const p = {
    target: initialTarget as number | null,
    pos: 0,
    goal: 0,
    scrolling: false,
    gos: [] as Array<{ y: number; immediate: boolean }>,
    go(y: number, immediate: boolean) {
      p.gos.push({ y, immediate });
      p.goal = y;
      if (immediate) {
        p.pos = y;
        p.scrolling = false;
      } else p.scrolling = true;
    },
    advance() {
      if (!p.scrolling) return;
      p.pos += (p.goal - p.pos) * 0.4;
      if (Math.abs(p.goal - p.pos) < 1) {
        p.pos = p.goal;
        p.scrolling = false;
      }
    },
  };
  return p;
}

function run(
  page: ReturnType<typeof fakePage>,
  tracker: ReturnType<typeof createAnchorTracker>,
  ms: number,
  onTick?: (t: number) => void,
) {
  let status: string = 'active';
  for (let t = 0; t <= ms; t += 16) {
    onTick?.(t);
    page.advance();
    status = tracker.step(t);
    if (status !== 'active') break;
  }
  return status;
}

const mk = (page: ReturnType<typeof fakePage>, o: object = {}) =>
  createAnchorTracker({
    read: () => page.target,
    current: () => page.pos,
    scrolling: () => page.scrolling,
    go: page.go,
    ...o,
  });

describe('createAnchorTracker', () => {
  it('finishes quietly when nothing moves', () => {
    const page = fakePage(1000);
    const tr = mk(page);
    tr.start(0);
    expect(run(page, tr, 3000)).toBe('done');
    expect(page.pos).toBe(1000);
    expect(page.gos).toHaveLength(1);
  });

  it('retargets when the element moves during the animation', () => {
    const page = fakePage(1000);
    const tr = mk(page);
    tr.start(0);
    const status = run(page, tr, 4000, (t) => {
      if (t >= 160 && t < 176) page.target = 1400;
    });
    expect(status).toBe('done');
    expect(page.pos).toBe(1400);
  });

  it('retargets when the element moves after the animation settled', () => {
    const page = fakePage(800);
    const tr = mk(page, { settleMs: 600 });
    tr.start(0);
    const status = run(page, tr, 4000, (t) => {
      if (t >= 400 && t < 416) page.target = 950;
    });
    expect(status).toBe('done');
    expect(page.pos).toBe(950);
  });

  it('gives up after the bounded number of retries (no fighting an endless shift)', () => {
    const page = fakePage(500);
    const tr = mk(page, { maxRetries: 3 });
    tr.start(0);
    const status = run(page, tr, 6000, (t) => {
      if (t % 64 === 0) page.target = (page.target ?? 0) + 50;
    });
    expect(status).toBe('done');
    expect(page.gos.length).toBeLessThanOrEqual(1 + 3);
  });

  it('cancel stops all further scroll commands', () => {
    const page = fakePage(1000);
    const tr = mk(page);
    tr.start(0);
    page.advance();
    tr.cancel();
    page.target = 2000;
    expect(tr.step(500)).toBe('cancelled');
    expect(page.gos).toHaveLength(1);
  });

  it('keeps waiting while the target does not exist yet, then lands on it', () => {
    const page = fakePage(0);
    page.target = null;
    const tr = mk(page);
    tr.start(0);
    const status = run(page, tr, 4000, (t) => {
      if (t >= 288 && t < 304) page.target = 1200;
    });
    expect(status).toBe('done');
    expect(page.pos).toBe(1200);
  });

  it('jumps immediately when asked (deep link, reduced motion)', () => {
    const page = fakePage(700);
    const tr = mk(page, { immediate: true });
    tr.start(0);
    const status = run(page, tr, 4000, (t) => {
      if (t >= 192 && t < 208) page.target = 900;
    });
    expect(status).toBe('done');
    expect(page.pos).toBe(900);
    expect(page.gos.every((g) => g.immediate)).toBe(true);
  });

  it('stops after maxMs even if the target never appears', () => {
    const page = fakePage(0);
    page.target = null;
    const tr = mk(page, { maxMs: 1000 });
    tr.start(0);
    expect(run(page, tr, 5000)).toBe('done');
    expect(page.gos).toHaveLength(0);
  });

  it('does not spend its hard stop on a frozen tab: a long stall counts as one slow frame', () => {
    const page = fakePage(1000);
    const tr = mk(page, { maxMs: 1000 });
    tr.start(0);
    page.advance();
    expect(tr.step(16)).toBe('active');
    page.target = 1600; // layout moved while the page was frozen for 6 s
    expect(tr.step(6000)).toBe('active');
    expect(page.gos.at(-1)?.y).toBe(1600);
  });
});

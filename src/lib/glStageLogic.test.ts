import { describe, expect, it } from 'vitest';
import { canvasPixelSize, nextStatus, shouldRun, type RunState } from './glStageLogic';

const base: RunState = { status: 'ok', inView: true, tabVisible: true, started: true };

describe('shouldRun', () => {
  it('runs only when started, ok, in view and the tab is visible', () => {
    expect(shouldRun(base)).toBe(true);
    expect(shouldRun({ ...base, started: false })).toBe(false);
    expect(shouldRun({ ...base, inView: false })).toBe(false);
    expect(shouldRun({ ...base, tabVisible: false })).toBe(false);
    expect(shouldRun({ ...base, status: 'lost' })).toBe(false);
    expect(shouldRun({ ...base, status: 'disposed' })).toBe(false);
  });
});

describe('nextStatus', () => {
  it('moves ok -> lost -> ok on context events', () => {
    expect(nextStatus('ok', 'lost')).toBe('lost');
    expect(nextStatus('lost', 'restored')).toBe('ok');
  });
  it('ignores a restore when not lost', () => {
    expect(nextStatus('ok', 'restored')).toBe('ok');
  });
  it('disposed is terminal', () => {
    expect(nextStatus('disposed', 'restored')).toBe('disposed');
    expect(nextStatus('disposed', 'lost')).toBe('disposed');
    expect(nextStatus('ok', 'dispose')).toBe('disposed');
    expect(nextStatus('lost', 'dispose')).toBe('disposed');
  });
});

describe('canvasPixelSize', () => {
  it('multiplies css size by dpr and rounds', () => {
    expect(canvasPixelSize(300.4, 150.6, 2)).toEqual({ width: 601, height: 301 });
  });
  it('never returns zero', () => {
    expect(canvasPixelSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});

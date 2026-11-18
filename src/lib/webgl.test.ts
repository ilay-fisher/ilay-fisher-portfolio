import { afterEach, describe, expect, it, vi } from 'vitest';
import { cappedDpr, isWebGLAvailable } from './webgl';

describe('isWebGLAvailable', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is true when a webgl context can be created', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as WebGLRenderingContext,
    );
    expect(isWebGLAvailable()).toBe(true);
  });

  it('is false when no context is returned', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(isWebGLAvailable()).toBe(false);
  });

  it('is false when context creation throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('nope');
    });
    expect(isWebGLAvailable()).toBe(false);
  });
});

describe('cappedDpr', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('caps at 2 by default', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    expect(cappedDpr()).toBe(2);
  });
  it('returns the real ratio below the cap', () => {
    vi.stubGlobal('devicePixelRatio', 1.5);
    expect(cappedDpr()).toBe(1.5);
  });
  it('honours a custom cap', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    expect(cappedDpr(1.25)).toBe(1.25);
  });
  it('never goes below 1', () => {
    vi.stubGlobal('devicePixelRatio', 0);
    expect(cappedDpr()).toBe(1);
  });
});

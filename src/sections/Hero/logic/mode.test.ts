import { describe, expect, it } from 'vitest';
import { selectMode } from './mode';

describe('fallback mode selection', () => {
  const ok = { webgl2: true, reducedMotion: false, contextLost: false };
  it('uses the scene when everything is available', () => {
    expect(selectMode(ok)).toEqual({ mode: 'scene', reason: 'ok' });
  });
  it('uses the still without WebGL2', () => {
    expect(selectMode({ ...ok, webgl2: false })).toEqual({ mode: 'still', reason: 'no-webgl2' });
  });
  it('uses the still under reduced motion and after context loss', () => {
    expect(selectMode({ ...ok, reducedMotion: true }).reason).toBe('reduced-motion');
    expect(selectMode({ ...ok, contextLost: true }).reason).toBe('context-lost');
  });
  it('prefers the most informative reason when several apply', () => {
    expect(selectMode({ webgl2: false, reducedMotion: true, contextLost: false }).reason).toBe(
      'reduced-motion',
    );
  });
  it('uses the still for automated browsers unless the live scene is opted into', () => {
    expect(selectMode({ ...ok, automated: true })).toEqual({ mode: 'still', reason: 'automated' });
    expect(selectMode({ ...ok, automated: false }).mode).toBe('scene');
    expect(selectMode({ ...ok, automated: true, reducedMotion: true }).reason).toBe(
      'reduced-motion',
    );
  });
});

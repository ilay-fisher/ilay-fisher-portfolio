import { describe, expect, it } from 'vitest';
import { breakpointFor, computeRegion } from './region';

describe('play region', () => {
  it('uses the right-hand area beside the text column on wide screens', () => {
    const r = computeRegion({ width: 1440, height: 844 }, { right: 470, bottom: 700 });
    expect(breakpointFor(1440)).toBe('desktop');
    expect(r.x0).toBeCloseTo(-1 + (2 * 470) / 1440, 3);
    expect(r.x1).toBeGreaterThan(0.9);
    expect(r.y0).toBeLessThan(-0.8);
  });
  it('uses the area under the text on phones', () => {
    expect(breakpointFor(390)).toBe('mobile');
    const r = computeRegion({ width: 390, height: 788 }, { right: 380, bottom: 330 }, true);
    expect(r.x0).toBeLessThan(-0.9);
    expect(r.y1).toBeCloseTo(1 - (2 * 330) / 788, 3);
  });

  it('keeps the bottom strip of a phone free for the hint, counter and reset button', () => {
    const r = computeRegion({ width: 390, height: 788 }, { right: 380, bottom: 330 }, true);
    // 170 px reserved at the bottom of the canvas.
    expect(r.y0).toBeCloseTo(-1 + (2 * 170) / 788, 3);
  });
});

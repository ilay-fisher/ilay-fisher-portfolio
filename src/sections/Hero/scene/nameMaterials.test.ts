import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import type { Palette } from './css';
import { nameMaterials } from './materials';

const palette: Palette = {
  stage: new Color('#0c1014'),
  paper: new Color('#ece8df'),
  accent: new Color('#1ed0f2'),
  accentHi: new Color('#8cf1ff'),
  accentDeep: new Color('#0a6a87'),
};

describe('name materials', () => {
  it('letters are glossy ceramic, not metal, and stay lighter than the plinth', () => {
    const { letters, slab } = nameMaterials(palette);
    expect(letters.metalness).toBe(0);
    expect(letters.clearcoat).toBeGreaterThan(0.5);
    expect(letters.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(
      slab.color.getHSL({ h: 0, s: 0, l: 0 }).l + 0.3,
    );
  });

  it('the plinth is dark anodised and the inlay line carries the accent, unaffected by tone mapping', () => {
    const { slab, inlay } = nameMaterials(palette);
    expect(slab.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.15);
    expect(inlay.color.getHexString()).toBe('1ed0f2');
    expect(inlay.toneMapped).toBe(false);
  });
});

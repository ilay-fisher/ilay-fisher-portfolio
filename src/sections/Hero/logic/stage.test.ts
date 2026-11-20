import { describe, expect, it } from 'vitest';
import { buildCatalogue } from './catalogue';
import { footprintRadius } from './spawn';
import { projectToNdc } from './camera';
import { MOBILE_SCENE_PX } from './region';
import { computeStage, nameScreenRect } from './stage';

/** Typical sizes of the hero text block (px, relative to the canvas) at each viewport width. */
const VIEWPORTS: Array<{ w: number; h: number; text: { right: number; bottom: number } }> = [
  { w: 390, h: 844, text: { right: 360, bottom: 300 } },
  { w: 600, h: 900, text: { right: 560, bottom: 330 } },
  { w: 768, h: 1024, text: { right: 730, bottom: 340 } },
  { w: 899, h: 1000, text: { right: 860, bottom: 340 } },
  { w: 900, h: 800, text: { right: 520, bottom: 520 } },
  { w: 1440, h: 900, text: { right: 540, bottom: 540 } },
  { w: 1920, h: 1000, text: { right: 640, bottom: 540 } },
];

describe('stage per viewport', () => {
  for (const v of VIEWPORTS) {
    const st = computeStage({
      canvas: { width: v.w, height: v.h },
      text: v.text,
      windowWidth: v.w,
    });

    it(`gives ${v.w}x${v.h} a wide, deep floor in front of the name`, () => {
      expect(st.bp).toBe(v.w >= 900 ? 'desktop' : 'mobile');
      const floorW = st.bounds.maxX - st.bounds.minX;
      expect(floorW).toBeGreaterThan(st.bp === 'desktop' ? 12 : 7.4);
      // Room in front of the name: at least 4.2 units deep so thirty pieces lie loose, not heaped.
      expect(st.bounds.maxZ - st.layout.keepOut.maxZ).toBeGreaterThanOrEqual(4.2);
    });

    it(`keeps the name inside the canvas and clear of the copy at ${v.w}px`, () => {
      const r = nameScreenRect(st);
      expect(r.x0).toBeGreaterThanOrEqual(-1.001);
      expect(r.x1).toBeLessThanOrEqual(1.001);
      expect(r.y1).toBeLessThanOrEqual(1);
      expect(r.y0).toBeGreaterThanOrEqual(-1);
      if (st.bp === 'mobile') {
        // Stacked: the name sits below the copy block.
        const copyBottomNdc = 1 - (2 * v.text.bottom) / v.h;
        expect(r.y1).toBeLessThanOrEqual(copyBottomNdc + 0.02);
      } else {
        const copyRightNdc = -1 + (2 * v.text.right) / v.w;
        expect(r.x0).toBeGreaterThanOrEqual(copyRightNdc - 0.02);
      }
    });

    it(`keeps pieces in proportion to the name at ${v.w}px`, () => {
      // The biggest token is well under half the cap height of the name, the smallest over 15 percent.
      const specs = buildCatalogue(st.bp).filter((s) => s.kind === 'token');
      const dims = specs.map((s) => Math.max(s.size.w, s.size.d));
      expect(Math.max(...dims) / st.cap).toBeLessThan(0.7);
      expect(Math.min(...dims) / st.cap).toBeGreaterThan(0.25);
    });

    it(`fits every piece loosely on the floor at ${v.w}px (no more than 55 percent covered)`, () => {
      const list = buildCatalogue(st.bp);
      const free = {
        x: st.bounds.maxX - st.bounds.minX,
        z: st.bounds.maxZ - st.layout.keepOut.maxZ,
      };
      const used = list.reduce((a, s) => a + Math.PI * footprintRadius(s) ** 2, 0);
      expect(used / (free.x * free.z)).toBeLessThan(0.55);
    });
  }

  it('projects the floor in front of the name below the name on screen', () => {
    const st = computeStage({
      canvas: { width: 768, height: 1024 },
      text: { right: 730, bottom: 340 },
      windowWidth: 768,
    });
    const front = projectToNdc(st.rig, { x: 0, y: 0, z: st.layout.keepOut.maxZ + 0.5 });
    expect(front.y).toBeLessThan(nameScreenRect(st).y0 + 0.05);
  });
});

describe('phone: the 3D name never reaches the text', () => {
  // iOS Safari wraps the copy onto more lines than Chrome, so the text can end anywhere in this range.
  // The hero grows with it (CSS keeps MOBILE_SCENE_PX of stage under the text), and the name must stay clear.
  it.each([360, 400, 440, 480, 520, 560, 620])('text ending at %ipx leaves at least 24px', (bottom) => {
    const width = 390;
    const height = Math.max(784, bottom + MOBILE_SCENE_PX);
    const st = computeStage({ canvas: { width, height }, text: { right: width, bottom }, windowWidth: width });
    const nameTop = ((1 - nameScreenRect(st).y1) / 2) * height;
    expect(nameTop - bottom).toBeGreaterThanOrEqual(24);
  });
});

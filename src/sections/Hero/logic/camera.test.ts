import { describe, expect, it } from 'vitest';
import {
  computeBounds,
  fitRig,
  intersectPlaneY,
  projectToNdc,
  rayFromNdc,
  type Region,
} from './camera';

const desktopRegion: Region = { x0: -0.37, x1: 0.98, y0: -0.95, y1: 0.72 };
const mobileRegion: Region = { x0: -0.97, x1: 0.97, y0: -0.97, y1: 0.05 };

describe('camera ray maths', () => {
  const rig = fitRig({
    aspect: 16 / 9,
    region: desktopRegion,
    worldWidth: 13.5,
    elevationDeg: 30,
    fovDeg: 28,
    targetZ: -1,
  });

  it('shoots the centre ray at the target (accounting for the region shift)', () => {
    const ray = rayFromNdc(rig, rig.shiftNdcX, 0);
    const hit = intersectPlaneY(ray, rig.target.y)!;
    expect(hit.x).toBeCloseTo(rig.target.x, 3);
    expect(hit.z).toBeCloseTo(rig.target.z, 3);
  });

  it('round-trips ndc to the floor and back', () => {
    for (const [x, y] of [
      [0.2, -0.5],
      [-0.3, 0.1],
      [0.8, -0.8],
    ] as const) {
      const hit = intersectPlaneY(rayFromNdc(rig, x, y), 0)!;
      const p = projectToNdc(rig, hit);
      expect(p.x).toBeCloseTo(x, 4);
      expect(p.y).toBeCloseTo(y, 4);
    }
  });

  it('returns null when the ray never reaches the plane', () => {
    expect(intersectPlaneY(rayFromNdc(rig, 0, 0.999), 50)).toBeNull();
  });
});

describe('world bounds per aspect ratio', () => {
  const cases: [string, number, Region, number][] = [
    ['16:9 desktop', 16 / 9, desktopRegion, 13.5],
    ['21:9 ultrawide', 21 / 9, desktopRegion, 13.5],
    ['4:3 tablet', 4 / 3, desktopRegion, 13.5],
    ['390x844 phone', 390 / 844, mobileRegion, 8.4],
  ];
  for (const [name, aspect, region, width] of cases) {
    it(`gives a usable floor rectangle for ${name}`, () => {
      const rig = fitRig({
        aspect,
        region,
        worldWidth: width,
        elevationDeg: aspect < 1 ? 36 : 30,
        fovDeg: 28,
        targetZ: -1,
      });
      const b = computeBounds(rig, region, -1.8);
      expect(b.maxX).toBeGreaterThan(b.minX);
      expect(b.maxX - b.minX).toBeGreaterThan(width * 0.8);
      expect(b.maxX - b.minX).toBeLessThan(width * 1.15);
      expect(b.maxZ - b.minZ).toBeGreaterThan(2.5);
      expect(b.minZ).toBe(-1.8);
      expect(b.height).toBeGreaterThan(3);
    });
  }
});

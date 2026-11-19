import { describe, expect, it } from 'vitest';
import {
  GOLD_STOPS,
  ICON_SHIELD,
  ICON_TILES,
  ICON_TILE_RADIUS,
  ICON_VIEW,
  TILE_STOPS,
  goldAt,
  iconToFace,
  tileAt,
} from './safeguardIcon';

describe('SafeGuard launcher icon geometry (Guarded Grid, light)', () => {
  it('keeps the shipping proportions: three 22 unit tiles of radius 6.5 and a shield in the fourth cell', () => {
    expect(ICON_TILES).toEqual([
      { x: 29, y: 29 },
      { x: 57, y: 29 },
      { x: 29, y: 57 },
    ]);
    expect(ICON_TILE_RADIUS).toBe(6.5);
    expect(ICON_SHIELD.x0).toBe(57);
    expect(ICON_SHIELD.x1).toBe(79);
    expect(ICON_SHIELD.y0).toBe(57);
    expect(ICON_SHIELD.y1).toBe(81);
  });

  it('uses the exact brand colours', () => {
    expect(TILE_STOPS).toEqual(['#2E2A9E', '#3D7BF0']);
    expect(GOLD_STOPS).toEqual(['#FFD27A', '#FFC14A']);
  });

  it('runs the blue gradient along the diagonal from (29,29) to (79,79)', () => {
    expect(tileAt(29, 29)).toBe(0);
    expect(tileAt(79, 79)).toBe(1);
    expect(tileAt(54, 54)).toBeCloseTo(0.5, 9);
    expect(tileAt(0, 0)).toBe(0);
    expect(tileAt(108, 108)).toBe(1);
    // Along the other diagonal the gradient does not move.
    expect(tileAt(40, 60)).toBeCloseTo(tileAt(60, 40), 9);
  });

  it('runs the gold gradient top to bottom over the shield box', () => {
    expect(goldAt(57)).toBe(0);
    expect(goldAt(81)).toBe(1);
    expect(goldAt(69)).toBeCloseTo(0.5, 9);
  });

  it('maps the artwork onto a 72 unit face: scaled 0.74 about the centre, centred, y down', () => {
    // The visible launcher area is 72 of the 108 canvas; the tile face is that area, so the art is 37/72 wide.
    expect(ICON_VIEW).toBe(72);
    expect(iconToFace(54, 54)).toEqual({ x: 0, z: 0 });
    const a = iconToFace(29, 29);
    const b = iconToFace(79, 79);
    expect(a.x).toBeCloseTo(-18.5, 9);
    expect(a.z).toBeCloseTo(-18.5, 9);
    expect(b.x).toBeCloseTo(18.5, 9);
    expect(b.z).toBeCloseTo(18.5, 9);
  });
});

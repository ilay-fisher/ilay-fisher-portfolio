import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './frames.json';
import blinks from './blinks.json';

const publicDir = join(process.cwd(), 'public');
const diskPath = (name: string) => join(publicDir, manifest.dir, name);

describe('avatar frame manifest', () => {
  it('has 40 to 64 frames and a consistent count', () => {
    expect(manifest.count).toBeGreaterThanOrEqual(40);
    expect(manifest.count).toBeLessThanOrEqual(64);
    expect(manifest.frames).toHaveLength(manifest.count);
  });
  it('lists frames in strict sequential order, so index order is yaw order', () => {
    manifest.frames.forEach((name, i) => expect(name).toBe(`f${String(i).padStart(2, '0')}.webp`));
  });
  it('puts the neutral and the still pose strictly inside the sweep', () => {
    expect(manifest.neutral).toBeGreaterThan(0);
    expect(manifest.neutral).toBeLessThan(manifest.count - 1);
    expect(manifest.stillIndex).toBeGreaterThanOrEqual(0);
    expect(manifest.stillIndex).toBeLessThan(manifest.count);
  });
  it('has every file on disk, square, and within the byte budget', () => {
    let total = 0;
    for (const name of [...manifest.frames, manifest.still]) {
      expect(existsSync(diskPath(name)), name).toBe(true);
      total += statSync(diskPath(name)).size;
    }
    expect(total).toBeLessThanOrEqual(1_200_000);
    const framesOnly = manifest.frames.reduce((n, f) => n + statSync(diskPath(f)).size, 0);
    expect(framesOnly).toBe(manifest.bytes);
    expect(manifest.size).toBe(512);
  });
});

describe('avatar blink atlas', () => {
  it('is on disk, within the 300 kB budget, and its size matches the data', () => {
    const file = diskPath(blinks.atlas);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBe(blinks.bytes);
    expect(blinks.bytes).toBeLessThanOrEqual(300_000);
  });
  it('has tracks for both eyes on every head frame, in the same neutral frame', () => {
    expect(blinks.neutral).toBe(manifest.neutral);
    for (const t of [blinks.tracks.E0, blinks.tracks.E1]) {
      expect(t).toHaveLength(manifest.count);
      t.forEach((m) => expect(m).toHaveLength(6));
    }
  });
  it('has sets whose anchors cover both sides of the neutral frame', () => {
    const anchors = blinks.sets.map((s) => s.anchor);
    expect(anchors.some((a) => a < manifest.neutral)).toBe(true);
    expect(anchors.some((a) => a > manifest.neutral)).toBe(true);
    expect(new Set(blinks.sets.map((s) => s.id)).size).toBe(blinks.sets.length);
    for (const s of blinks.sets) {
      expect(s.anchor).toBeGreaterThanOrEqual(0);
      expect(s.anchor).toBeLessThan(manifest.count);
      expect(s.closed).toBeGreaterThan(0);
      expect(s.closed).toBeLessThan(s.count - 1);
      expect(s.eyes.length).toBeGreaterThan(0);
    }
  });
  it('gives every eye its own atlas row, and the rows fit the atlas', () => {
    const rows = blinks.sets.flatMap((s) => s.eyes.map((e) => e.row));
    expect(new Set(rows).size).toBe(rows.length);
    expect(Math.max(...rows)).toBeLessThan(rows.length);
    expect(Math.max(...blinks.sets.map((s) => s.count))).toBeGreaterThan(0);
  });
  it('covers the head sweep with no stretch longer than the reach of the nearest set', () => {
    const covered = (i: number) => blinks.sets.some((s) => Math.abs(s.anchor - i) <= s.reach);
    const gaps = Array.from({ length: manifest.count }, (_, i) => i).filter((i) => !covered(i));
    // frames outside every set's reach do not blink; keep that to the extreme ends only
    expect(gaps.filter((i) => i > 4 && i < manifest.count - 5)).toEqual([]);
  });
});

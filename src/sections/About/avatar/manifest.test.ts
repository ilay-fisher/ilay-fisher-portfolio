import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './frames.json';

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
    expect(manifest.stillIndex).toBeLessThan(manifest.neutral);
  });
  it('has every file on disk, square, and within the byte budget', () => {
    let total = 0;
    for (const name of [...manifest.frames, manifest.still]) {
      expect(existsSync(diskPath(name)), name).toBe(true);
      total += statSync(diskPath(name)).size;
    }
    expect(total).toBeLessThanOrEqual(1_000_000);
    const framesOnly = manifest.frames.reduce((n, f) => n + statSync(diskPath(f)).size, 0);
    expect(framesOnly).toBe(manifest.bytes);
    expect(manifest.size).toBe(512);
  });
});

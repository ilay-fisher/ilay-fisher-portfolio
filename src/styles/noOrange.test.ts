import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

/** Files that may keep a warm colour: third-party brand marks and a brand icon, not our accent. */
const BRAND = new Set([
  'src/sections/Hero/scene/marks.ts',
  'src/sections/Hero/logic/safeguardIcon.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

/** Hue (deg), saturation and value of an 8-bit rgb triple. */
function hsv([r, g, b]: number[]): { h: number; s: number; v: number } {
  const [R, G, B] = [r! / 255, g! / 255, b! / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  if (d === 0) return { h: 0, s: 0, v: max };
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / max, v: max };
}

/** Every colour literal (hex, rgb(), rgba()) in a source text that reads orange, amber, red or pink. */
function warmColours(text: string): string[] {
  const found: string[] = [];
  const consider = (lit: string, rgb: number[]) => {
    const { h, s, v } = hsv(rgb);
    const warm = h <= 55 || h >= 330;
    if (warm && s >= 0.18 && v >= 0.45) found.push(lit);
  };
  for (const m of text.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const x = m[1]!;
    consider(
      m[0],
      [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)),
    );
  }
  for (const m of text.matchAll(/#([0-9a-fA-F]{3})\b/g)) {
    consider(
      m[0],
      [...m[1]!].map((c) => parseInt(c + c, 16)),
    );
  }
  for (const m of text.matchAll(/rgba?\(\s*(\d+)[ ,]+\s*(\d+)[ ,]+\s*(\d+)/g)) {
    consider(m[0], [Number(m[1]), Number(m[2]), Number(m[3])]);
  }
  return found;
}

describe('no orange, amber or pink left in the source', () => {
  const files = [
    ...walk(join(root, 'src')),
    join(root, 'index.html'),
    join(root, 'public/favicon.svg'),
  ];

  it('scans a real set of files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no warm hard-coded colour outside the brand-mark files', () => {
    const hits: string[] = [];
    for (const f of files) {
      const rel = relative(root, f);
      if (BRAND.has(rel)) continue;
      const w = warmColours(readFileSync(f, 'utf8'));
      if (w.length) hits.push(`${rel}: ${[...new Set(w)].join(' ')}`);
    }
    expect(hits).toEqual([]);
  });

  it('the old accent hex values are gone everywhere, brand files included', () => {
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), relative(root, f)).not.toMatch(
        /ff5a1f|ffb347|a8300f|ff3d6e/i,
      );
    }
  });

  it('the page-fx moods are named for the cool family', () => {
    const fx = readFileSync(join(root, 'src/lib/pageFx.ts'), 'utf8');
    expect(fx).not.toMatch(/'amber'|'ember'/);
  });
});

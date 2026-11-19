import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
interface Hosting {
  cleanUrls?: boolean;
  headers: HeaderRule[];
  rewrites: { source: string; destination: string }[];
}
const hosting: Hosting = JSON.parse(readFileSync('firebase.json', 'utf8')).hosting;

/** Firebase's glob, reduced to what this file uses: `**` (anything, slashes included) and `*` (one segment). */
const matches = (glob: string, path: string): boolean => {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__GLOBSTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__GLOBSTAR__/g, '.*');
  return new RegExp(`^${re}$`).test(path);
};

/**
 * The Cache-Control a request path ends up with. Header patterns match the request path before rewrites, and matching
 * rules apply in the order they are written, so a later rule overrides an earlier one for the same key.
 */
const cacheControl = (path: string): string | undefined => {
  let value: string | undefined;
  for (const rule of hosting.headers)
    if (matches(rule.source, path))
      for (const h of rule.headers) if (h.key === 'Cache-Control') value = h.value;
  return value;
};

describe('firebase.json hosting', () => {
  it('keeps clean URLs and the single-page rewrite', () => {
    expect(hosting.cleanUrls).toBe(true);
    expect(hosting.rewrites).toContainEqual({ source: '**', destination: '/index.html' });
  });

  it('serves HTML with no-cache for every path that is not an asset', () => {
    for (const p of [
      '/',
      '/index.html',
      '/work/drone',
      '/work/safesurf',
      '/work/nope',
      '/anything',
    ]) {
      expect(cacheControl(p), p).toBe('no-cache');
    }
  });

  it('keeps hashed build assets immutable for a year', () => {
    for (const p of ['/assets/index-abc123.js', '/assets/fonts/x-9f.woff2']) {
      expect(cacheControl(p), p).toBe('public, max-age=31536000, immutable');
    }
  });

  it('keeps images on a one-day cache', () => {
    expect(cacheControl('/images/projects/drone-sandbox.webp')).toBe('public, max-age=86400');
  });

  it('puts the catch-all no-cache rule before the asset and image rules', () => {
    const at = (s: string) => hosting.headers.findIndex((r) => r.source === s);
    expect(at('**')).toBeGreaterThanOrEqual(0);
    expect(at('**')).toBeLessThan(at('/assets/**'));
    expect(at('**')).toBeLessThan(at('/images/**'));
  });
});

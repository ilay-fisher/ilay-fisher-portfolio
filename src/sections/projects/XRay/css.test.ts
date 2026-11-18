import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/sections/projects/XRay/XRay.css', 'utf8');

describe('XRay.css follows the v2 tokens', () => {
  it('has no hex colours, no v1 pink/mint, no local radius aliases or literal fallbacks', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toContain('var(--pass)');
    expect(css).not.toMatch(/--xr-r-|--radius-(lg|md|sm)\b/);
    expect(css).not.toMatch(/var\(--[a-z-]+,\s*\d+px\)/);
  });
  it('takes shape and depth from the tokens', () => {
    for (const t of [
      '--radius-card',
      '--radius-control',
      '--radius-pill',
      '--well-inset',
      '--bevel-inset',
      '--spring-snappy',
      '--shadow-contact-sm',
    ])
      expect(css).toContain(t);
  });
});

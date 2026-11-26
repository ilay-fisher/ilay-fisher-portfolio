import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/** Reads one tag's text or content attribute out of index.html. */
function pick(re: RegExp): string {
  const m = re.exec(html);
  if (!m) throw new Error(`not found: ${re}`);
  return m[1]!.replace(/\s+/g, ' ').trim();
}
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const title = pick(/<title>([^<]*)<\/title>/);
const description = pick(/<meta\s+name="description"\s+content="([^"]*)"/);
const ogTitle = pick(/<meta\s+property="og:title"\s+content="([^"]*)"/);
const ogDescription = pick(/<meta\s+property="og:description"\s+content="([^"]*)"/);

describe('index.html meta (owner brief 2026-11-19; owner brief 2026-11-26: no student)', () => {
  it('title mentions AI agents once and keeps Backend and Android', () => {
    expect(count(title, /AI agents/gi)).toBe(1);
    expect(title).toMatch(/Backend/);
    expect(title).toMatch(/Android/);
    expect(ogTitle).toBe(title);
    expect(title).not.toMatch(/student/i);
  });

  for (const [name, value] of [
    ['description', description],
    ['og:description', ogDescription],
  ] as const) {
    it(`${name} mentions AI agents and LLM once each, and keeps Backend, Android and Systems`, () => {
      expect(count(value, /AI agents/g)).toBe(1);
      expect(count(value, /\bLLM\b/g)).toBe(1);
      for (const w of ['Backend', 'Android', 'Systems']) expect(value).toContain(w);
      expect(value).toMatch(/\bjunior\b/);
      expect(value).not.toMatch(/student/i);
    });
  }

  it('stays readable: both descriptions under 172 characters', () => {
    expect(description.length).toBeLessThanOrEqual(172);
    expect(ogDescription.length).toBeLessThanOrEqual(172);
  });

  it('carries no phone number, no prices and no ruled-out words', () => {
    const all = [title, description, ogTitle, ogDescription].join(' ');
    expect(all).not.toMatch(/058|972|\$|₪|alone|solo|microservice|google cloud/i);
  });
});

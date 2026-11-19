import { describe, expect, it } from 'vitest';
import { caseStudies } from './caseStudies';
import { projects } from './projects';

describe('case studies', () => {
  it('has one case study per project, in the same order', () => {
    expect(caseStudies.map((c) => c.id)).toEqual(projects.map((p) => p.id));
  });

  it('has the sections every page renders', () => {
    for (const c of caseStudies) {
      expect(c.metaDescription.length, c.id).toBeGreaterThan(40);
      expect(c.metaDescription.length, c.id).toBeLessThanOrEqual(160);
      expect(c.problem.length, c.id).toBeGreaterThan(0);
      expect(c.built.length, c.id).toBeGreaterThan(0);
      expect(c.how.length, c.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps to the site voice: no exclamation marks, no prices, no phone', () => {
    const text = JSON.stringify(caseStudies);
    expect(text).not.toContain('!');
    expect(text).not.toMatch(/[$€£₪]\s?\d|\d\s?(USD|EUR|NIS|ILS)\b/);
    expect(text).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
  });

  it('only uses numbers that exist in CONTENT.md', () => {
    const find = (id: string) => caseStudies.find((c) => c.id === id)!;
    expect(find('safesurf').numbers?.map((n) => n.value)).toEqual(['50+', '14.2%', '22+', '60+']);
    expect(find('xray').numbers?.map((n) => n.value)).toEqual(['~95%', '43.7%', '4/4']);
  });

  it('does not say the SafeSurf case was built alone', () => {
    expect(JSON.stringify(caseStudies.find((c) => c.id === 'safesurf'))).not.toMatch(/\balone\b/);
  });

  it('every image is a webp under public/', () => {
    for (const c of caseStudies)
      for (const m of c.media ?? []) {
        expect(m.src, c.id).toMatch(/^\/images\/projects\/.+\.webp$/);
        expect(m.alt.length, c.id).toBeGreaterThan(10);
      }
  });
});

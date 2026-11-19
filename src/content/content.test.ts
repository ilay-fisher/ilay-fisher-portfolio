import { describe, expect, it } from 'vitest';
import { profile } from './profile';
import { projects } from './projects';

const isHttps = (u: string) => u.startsWith('https://') && URL.canParse(u);

describe('profile', () => {
  it('has the identity fields from CONTENT.md', () => {
    expect(profile.name).toBe('Ilay Fisher');
    expect(profile.thesis).toBe('I run a live Android app and its backend. 50+ active users.');
    expect(profile.thesis.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(profile.email).toBe('ilay3002@gmail.com');
    expect(profile.location).toBe('Sde Yaakov, Israel');
    expect(profile.photo).toBe('/images/ilay.jpg');
  });

  it('has https links and no phone number', () => {
    expect(isHttps(profile.links.linkedin)).toBe(true);
    expect(isHttps(profile.links.github)).toBe(true);
    expect(isHttps(profile.links.safesurf)).toBe(true);
    expect(JSON.stringify(profile)).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
  });

  it('aims the role and availability at student and junior roles, from the CVs', () => {
    expect(profile.role).toContain('Student backend developer');
    expect(profile.role).toContain('July 2027');
    expect(profile.availability).toContain('student role (3 days a week)');
    expect(profile.availability).toContain('full-time junior role');
    expect(profile.availability).toContain('Backend, Android or Systems');
  });

  it('has the CV numbers in the experience and skills', () => {
    const text = JSON.stringify(profile);
    for (const n of ['50+', '60+', '77.7k', '7.6 ms', '22+', '36.6%', '14.2%', 'since May 2026'])
      expect(text, n).toContain(n);
    expect(profile.about.stack).toEqual(expect.arrayContaining(['Linux', 'SQL', 'GitHub Actions']));
  });

  it('does not claim to have built it alone: another contributor worked on SafeGuard', () => {
    expect(JSON.stringify(profile)).not.toMatch(/\balone\b|Solo-built/);
    expect(JSON.stringify(profile)).toContain('another contributor');
  });

  it('lists experience and education with required fields', () => {
    expect(profile.experience.map((e) => e.id)).toEqual([
      'safesurf',
      'magshimim',
      'aharaytech',
      'rafael',
      'service',
    ]);
    for (const e of profile.experience) {
      expect(e.role && e.org && e.period && e.summary.length > 0).toBeTruthy();
      expect(e.highlights.length).toBeGreaterThan(0);
    }
    expect(profile.education.school).toBe('Ruppin Academic Center');
    expect(profile.education.average).toBe(88);
    expect(profile.education.period).toBe('2024 to July 2027 (expected)');
    expect(profile.education.courses).toEqual(
      expect.arrayContaining(['Operating Systems (Linux)', 'Computer Networks']),
    );
  });

  it('lists the six writing topics', () => {
    expect(profile.writing.topics).toHaveLength(6);
    expect(isHttps(profile.writing.url)).toBe(true);
  });
});

describe('projects', () => {
  it('has exactly the three projects in order', () => {
    expect(projects.map((p) => p.id)).toEqual(['safesurf', 'drone', 'xray']);
  });

  it('has required fields and https links on every project', () => {
    for (const p of projects) {
      expect(p.title).toBeTruthy();
      expect(p.caseNo).toMatch(/^[A-Z]+-\d+$/);
      expect(p.status).toBeTruthy();
      expect(p.challenge).toBeTruthy();
      expect(p.summary.length).toBeGreaterThan(20);
      expect(p.stack.length).toBeGreaterThan(3);
      expect(p.links.length).toBeGreaterThan(0);
      expect(p.points.length).toBeGreaterThan(1);
      for (const l of p.links) {
        expect(l.label).toBeTruthy();
        expect(isHttps(l.href)).toBe(true);
      }
    }
  });

  it('never shows prices for SafeSurf', () => {
    expect(JSON.stringify(projects)).not.toMatch(/[$₪€]\s?\d/);
  });

  it('keeps the benchmark numbers from CONTENT.md', () => {
    const xray = projects.find((p) => p.id === 'xray');
    const text = JSON.stringify(xray);
    expect(text).toContain('2,460');
    expect(text).toContain('43.7%');
  });
});

import { describe, expect, it } from 'vitest';
import { aiWorkflows } from './aiWorkflows';

const text = JSON.stringify(aiWorkflows);

describe('aiWorkflows content (owner brief 2026-11-19)', () => {
  it('has the section title and exactly four items in order', () => {
    expect(aiWorkflows.title).toBe('AI and agent workflows');
    expect(aiWorkflows.items.map((i) => i.id)).toEqual([
      'release-agent',
      'skills',
      'orchestration',
      'content-plugin',
    ]);
    expect(aiWorkflows.items.map((i) => i.title)).toEqual([
      'Release-manager agent',
      'Custom skills',
      'Manager and subagent orchestration',
      'Content plugin',
    ]);
  });

  it('describes the release-manager agent with the 637-line script', () => {
    const item = aiWorkflows.items[0]!;
    for (const part of [
      'SafeSurf',
      'SafeGuard',
      'version bump',
      'signs',
      'checksums',
      'Firebase Storage',
      'Remote Config',
      '637-line release script',
    ])
      expect(item.body).toContain(part);
  });

  it('lists the five skills, two with a one-line note', () => {
    const skills = aiWorkflows.items[1]!;
    expect(skills.skills?.map((s) => s.name)).toEqual(['diagnose', 'verify-avd']);
    expect(skills.skills?.[0]?.note).toMatch(/root cause from live evidence before any code edit/);
    expect(skills.skills?.[1]?.note).toMatch(/emulator with Maestro, screenshots and logcat/);
    expect(skills.also).toEqual(['add-safeguard-setting', 'release', 'job-career-scan']);
  });

  it('describes the orchestration and the content plugin', () => {
    const o = aiWorkflows.items[2]!.body;
    expect(o).toMatch(/manager agent dispatches Sonnet subagents, one per task/);
    expect(o).toMatch(/own git worktree/);
    expect(o).toMatch(/no outward actions/);
    expect(o).toMatch(/on-device verification/);
    const c = aiWorkflows.items[3]!.body;
    expect(c).toMatch(/writer agent and three reviewer agents \(hook, body, call to action\)/);
    expect(c).toMatch(/until they agree/);
  });

  it('invents no numbers: 637 is the only digit run', () => {
    expect(text.match(/\d+/g)).toEqual(['637']);
  });

  it('avoids words the owner ruled out', () => {
    expect(text).not.toMatch(
      /microservice|google cloud|\balone\b|\bsolo\b|rafael|paid|price|\$|₪/i,
    );
    expect(text).not.toMatch(/!|saved|faster|hours/i);
  });

  it('has no links: the agent tooling has no public repo', () => {
    expect(text).not.toMatch(/https?:/);
    for (const i of aiWorkflows.items) expect('href' in i).toBe(false);
  });

  it('points to the other AI work with in-page links only', () => {
    expect(aiWorkflows.more.links.map((l) => l.href)).toEqual(['#xray', '#safesurf']);
  });
});

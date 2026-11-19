import { describe, expect, it } from 'vitest';
import { aiWorkflows } from './aiWorkflows';

const text = JSON.stringify(aiWorkflows);

describe('aiWorkflows content (owner brief 2026-11-19, three cards)', () => {
  it('has the section title and exactly three items in order', () => {
    expect(aiWorkflows.title).toBe('AI and agent workflows');
    expect(aiWorkflows.items.map((i) => i.id)).toEqual([
      'release-agent',
      'orchestration',
      'skills-plugins',
    ]);
    expect(aiWorkflows.items.map((i) => i.title)).toEqual([
      'Release-manager agent',
      'Manager and subagent orchestration',
      'Skills, plugins and scheduled tasks',
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

  it('describes the orchestration flow', () => {
    const o = aiWorkflows.items[1]!.body;
    expect(o).toMatch(/splits the work into tasks and hands each one to its own subagent/);
    expect(o).toMatch(/own git worktree and branch, runs its own tests and opens a pull request/);
    expect(o).toMatch(/squash-merges and deploys\. This site is built this way\./);
  });

  it('folds skills, plugins and scheduled tasks into one card', () => {
    const c = aiWorkflows.items[2]!.body;
    expect(c).toMatch(/skills, plugins and scheduled tasks for repeated work/);
    expect(c).toMatch(/root cause from live evidence before any code edit/);
    expect(c).toMatch(/reviewer agents that argue until they agree/);
  });

  it('invents no numbers: 637 is the only digit run', () => {
    expect(text.match(/\d+/g)).toEqual(['637']);
  });

  it('has no links and no closing line that frames the projects as AI work', () => {
    expect(text).not.toMatch(/https?:/);
    expect('more' in aiWorkflows).toBe(false);
    expect(text).not.toMatch(/projects below|More AI work/i);
  });
});

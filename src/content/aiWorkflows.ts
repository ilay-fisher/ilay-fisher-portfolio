/**
 * Copy for the "AI and agent workflows" section. Every fact was confirmed by the owner on 2026-11-19 (see
 * docs/CONTENT.md, "AI section"). The 637-line release script is the only number: no time-saved claims, no user
 * counts and no links, because the agent tooling has no public repo.
 */

/** One card in the section. */
export interface AiWorkflow {
  id: 'release-agent' | 'orchestration' | 'skills-plugins';
  /** Short mono label on the pill at the top of the card. */
  label: string;
  title: string;
  body: string;
}

/** The whole section. */
export interface AiWorkflows {
  title: string;
  /** The phrase in `title` that takes the accent colour. */
  accent: string;
  items: AiWorkflow[];
}

/** The section copy. */
export const aiWorkflows: AiWorkflows = {
  title: 'AI and agent workflows',
  accent: 'agent workflows',
  items: [
    {
      id: 'release-agent',
      label: 'Release',
      title: 'Release-manager agent',
      body: 'Cuts a SafeSurf and SafeGuard release end to end: version bump, builds and signs both Android APKs, checksums, upload to Firebase Storage and a Remote Config update. It runs on top of a 637-line release script.',
    },
    {
      id: 'orchestration',
      label: 'Orchestration',
      title: 'Manager and subagent orchestration',
      body: 'A manager agent splits the work into tasks and hands each one to its own subagent. Every subagent works in its own git worktree and branch, runs its own tests and opens a pull request. CI runs checks and end-to-end tests on every PR. The manager reviews the diff, screenshots and CI results, checks a production build, then squash-merges and deploys. This site is built this way.',
    },
    {
      id: 'skills-plugins',
      label: 'Skills',
      title: 'Skills, plugins and scheduled tasks',
      body: "I write my own skills, plugins and scheduled tasks for repeated work. Examples: finding a bug's root cause from live evidence before any code edit, verifying Android changes on an emulator, cutting app releases, scanning job listings, and drafting posts with a writer agent and reviewer agents that argue until they agree.",
    },
  ],
};

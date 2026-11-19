/**
 * Copy for the "AI and agent workflows" section. Every fact was confirmed by the owner on 2026-11-19 (see
 * docs/CONTENT.md, "AI section, owner brief 2026-11-19"). The 637-line release script is the only number: no
 * time-saved claims, no user counts and no links, because the agent tooling has no public repo.
 */

/** A skill shown by name, with the one line that says what it does. */
export interface AiSkill {
  name: string;
  note: string;
}

/** One card in the section. */
export interface AiWorkflow {
  id: 'release-agent' | 'skills' | 'orchestration' | 'content-plugin';
  /** Short mono label on the pill at the top of the card. */
  label: string;
  title: string;
  body: string;
  /** Skills described in a line each (the Custom skills card). */
  skills?: AiSkill[];
  /** Skills listed by name only (the Custom skills card). */
  also?: string[];
}

/** A link to another section of this page. */
export interface AiMoreLink {
  label: string;
  href: string;
}

/** The whole section. */
export interface AiWorkflows {
  title: string;
  /** The phrase in `title` that takes the accent colour. */
  accent: string;
  summary: string;
  items: AiWorkflow[];
  /** A closing line that points to the AI work shown in the project sections. */
  more: { lead: string; links: AiMoreLink[] };
}

/** The section copy. */
export const aiWorkflows: AiWorkflows = {
  title: 'AI and agent workflows',
  accent: 'agent workflows',
  summary: 'Four agent setups I built, from releases to content.',
  items: [
    {
      id: 'release-agent',
      label: 'Release',
      title: 'Release-manager agent',
      body: 'Cuts a SafeSurf and SafeGuard release end to end: version bump, builds and signs both Android APKs, checksums, upload to Firebase Storage and a Remote Config update. It runs on top of a 637-line release script.',
    },
    {
      id: 'skills',
      label: 'Skills',
      title: 'Custom skills',
      body: 'Skills I wrote for work I repeat.',
      skills: [
        {
          name: 'diagnose',
          note: 'Find the root cause from live evidence before any code edit.',
        },
        {
          name: 'verify-avd',
          note: 'Prove an Android change works on an emulator with Maestro, screenshots and logcat.',
        },
      ],
      also: ['add-safeguard-setting', 'release', 'job-career-scan'],
    },
    {
      id: 'orchestration',
      label: 'Orchestration',
      title: 'Manager and subagent orchestration',
      body: 'A manager agent dispatches Sonnet subagents, one per task, each in its own git worktree. Subagents take no outward actions, and every fix needs on-device verification.',
    },
    {
      id: 'content-plugin',
      label: 'Content',
      title: 'Content plugin',
      body: 'A writer agent and three reviewer agents (hook, body, call to action) debate a draft until they agree.',
    },
  ],
  more: {
    lead: 'More AI work in the projects below:',
    links: [
      { label: 'X-Ray Lens', href: '#xray' },
      { label: 'the on-device image model in SafeSurf', href: '#safesurf' },
    ],
  },
};

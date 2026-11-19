# AI section demoted (2026-11-19)

Owner feedback: "the ai is too on top. it not need much focus." and "don't say the projects done with ai". Later scope change: the section is more general, three cards.

## What changed

- Page order: Hero, About, SafeSurf, X-Ray, Drone, Experience, **AI**, Contact. Nav: About, SafeSurf, X-Ray, Drone, Experience, AI. Order tests (unit and e2e), CONTRACTS.md updated.
- Quieter look: compact h2 (step-2), tighter section padding, smaller cards (24 px padding, smaller type, small pill and lamp, no glow, 2 px hover nudge). Still rounded bevel cards, no orange, no icons. Desktop: two cards side by side, third full width; one column on phones.
- Bench pill "focus AI agents" removed.

## Copy removed or changed (CONTENT.md and `src/content/aiWorkflows.ts`)

- Removed closing line "More AI work in the projects below: X-Ray Lens and the on-device image model in SafeSurf." and its links.
- Removed summary line "Four agent setups I built, from releases to content." (no longer true with three cards; no replacement copy invented).
- Owner scope change: cards are now (1) Release-manager agent, unchanged; (2) Manager and subagent orchestration, new owner-approved text; (3) Skills, plugins and scheduled tasks, new owner-approved text. The separate Custom skills and Content plugin cards are gone.
- Code comment "AI-heavy ones first" and CONTENT.md note "AI projects first" reworded neutrally.

## Not changed (for the owner to decide)

- `index.html` title/meta ("...and AI Agents Developer", "Builds AI agents and runs SafeSurf...") and the About skill tags from #25 describe Ilay, not the projects, so they stay. Say if you want them reverted.
- Project order SafeSurf, X-Ray, Drone stays (the SafeSurf on-device-model numbers are the project's own facts).

## Checks

Unit 750 passed, lint, typecheck, production build clean. E2E (workers=1): ai-section, about, design, smoke, project-pages: 68 passed.

Screenshots: `docs/reports/ai-demote/ai-section-1440.png`, `ai-section-390.png`.

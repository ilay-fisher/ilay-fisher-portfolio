# AI and agent workflows section, AI projects first (2026-11-19)

Branch `feat/ai-section`, started from `copy/job-search` (PR #24). All facts come from the owner brief of 2026-11-19 (Ilay confirmed he built every item). Copy: `docs/CONTENT.md`, "AI and agent workflows". Code: `src/content/aiWorkflows.ts`, `src/sections/AI/`.

## BEFORE to AFTER

| Where                    | Before                                                                                     | After                                                                                                                                                                                                                                                               | Source                       |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Page order               | Hero, About, SafeSurf, Drone, X-Ray, Experience, Contact                                   | Hero, **AI**, About, SafeSurf, **X-Ray, Drone**, Experience, Contact                                                                                                                                                                                                | Brief 1, 2                   |
| AI section               | none                                                                                       | `#ai`, four cards: release-manager agent (637-line script), custom skills (`diagnose`, `verify-avd`, also `add-safeguard-setting`, `release`, `job-career-scan`), manager and subagent orchestration, content plugin. Closing line links to `#xray` and `#safesurf` | Brief 1                      |
| Nav                      | About, SafeSurf, Drone, X-Ray, Experience                                                  | AI, About, SafeSurf, X-Ray, Drone, Experience                                                                                                                                                                                                                       | Brief 1, 2                   |
| Case numbers             | SafeSurf 01, Drone 02, X-Ray 03                                                            | SafeSurf 01, X-Ray 02, Drone 03                                                                                                                                                                                                                                     | Brief 2                      |
| Case page prev/next      | derived from project order                                                                 | same code, new order: SafeSurf (prev Drone, next X-Ray), X-Ray (prev SafeSurf, next Drone), Drone (prev X-Ray, next SafeSurf)                                                                                                                                       | Brief 2                      |
| X-Ray numbers            | already shown (home and case page): 2,460 to 117-121 tokens, 17,838 to 10,034 ms (43.7%)   | unchanged, covered by tests                                                                                                                                                                                                                                         | CONTENT.md, README benchmark |
| SafeSurf on-device model | case page: "false blocks 14.2%, down from 36.6%" with 7.6 ms                               | label now says "from the on-device image model"; home section gets 14.2% and 7.6 ms (median, arm64, TFLite) next to the demo                                                                                                                                        | Brief 2, CV                  |
| Title / og:title         | Ilay Fisher — Student Backend and Android Developer                                        | Ilay Fisher — Student Backend, Android and AI Agents Developer                                                                                                                                                                                                      | Brief 3                      |
| Meta / og description    | ...Backend, Android or Systems role. Runs SafeSurf, a live Android product with 50+ users. | ...Backend, Android, Systems or LLM engineer role. Builds AI agents and runs SafeSurf, a live Android app with 50+ users. (170 / 158 chars; "AI agents" and "LLM" once each)                                                                                        | Brief 3                      |
| Skills (About)           | 22 tags                                                                                    | +ONNX, Claude API, AI agents, Multi-agent orchestration, Prompt engineering (TFLite and PyTorch already existed, not duplicated)                                                                                                                                    | Brief 4                      |
| Section source files     | `projects[0..2]` by index                                                                  | by id (index lookup would have broken with the new order)                                                                                                                                                                                                           | refactor                     |

## Design

Four rounded `bevel` cards (radius 24), engraved label pill with a cyan pilot lamp, skill names as mono chips. Desktop grid: release and orchestration stack beside the tall skills card, the content plugin closes full width; one column under 720 px. Entrance: the shared `Reveal` stagger (soft spring rise). Hover (fine pointer, no reduced motion): the card lifts 5 px on the snappy spring and its top edge catches the accent light. No links in the cards. No `src/lib/**`, hero, Contact or availability changes (the light-pool mood for `#ai` falls back to the hero mood).

## Checks

See the PR or hand-off message for the run results. Unit tests: content, section, meta tags (`src/meta.test.ts`), order tests. E2E `e2e/ai-section.spec.ts`: presence and place, project and nav order, case-page links, numbers, meta tags, no sideways scroll at 360, 390, 665, 1024, 1440.

## Screenshots (`docs/reports/img/`)

- `ai-section-1440.png`, `-1024`, `-665`, `-390`, `-360`: the section (fixed nav hidden for the capture)
- `ai-section-nav-1440.png`, `ai-section-nav-active-1440.png`: nav at the top, and with AI active
- `ai-section-project-order-1440.png`: the three project headers in the new order
- `ai-section-motion-entrance-frames.png`: screencast frames of the spring entrance (cards rise staggered, then settle)
- `ai-section-motion-hover-before-after.png`: orchestration card at rest and hovered

## For the owner

- Closing line "More AI work in the projects below" is an addition beyond the four cards; it uses in-page links only. Easy to remove.
- Summary line, bench pill ("focus AI agents") and card pill labels are new UI strings, not from the brief.
- "ONNX" was added as its own tag because TFLite already existed.

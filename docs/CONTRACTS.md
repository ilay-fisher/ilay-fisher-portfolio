# Contracts — file ownership and shared interfaces

Parallel workers stay out of each other's way by owning paths. The foundation workstream
creates every shared file and a stub for every section, so `App.tsx` never changes later.

## Workstreams

| ID | Branch | Owns | Port |
|---|---|---|---|
| R | `docs/animation-research` | `docs/research/**` | — |
| F | `feat/foundation` | everything at first: tooling, `src/lib/**`, `src/styles/**`, `src/content/**`, `src/components/**`, `src/App.tsx`, stubs for all sections, CI, Firebase config, `docs/DESIGN.md` | 5180 |
| A | `feat/hero` | `src/sections/Hero/**`, `e2e/hero.spec.ts` | 5181 |
| B | `feat/about-experience-contact` | `src/sections/About/**`, `src/sections/Experience/**`, `src/sections/Contact/**`, `src/components/Nav/**`, `src/components/Footer/**`, `e2e/about.spec.ts` | 5182 |
| C | `feat/safesurf-demo` | `src/sections/projects/SafeSurf/**`, `e2e/safesurf.spec.ts` | 5183 |
| D | `feat/drone-demo` | `src/sections/projects/Drone/**`, `e2e/drone.spec.ts` | 5184 |
| E | `feat/xray-demo` | `src/sections/projects/XRay/**`, `e2e/xray.spec.ts` | 5185 |
| Q | `fix/integration-qa` | cross-cutting polish after A to E are merged | 5186 |

Every workstream also owns `docs/reports/<workstream>.md` and `docs/reports/img/<workstream>-*`.

## Directory layout (created by F)

```
src/
  main.tsx
  App.tsx                      composes the sections in page order, nothing else
  styles/tokens.css            design tokens as CSS custom properties
  styles/global.css
  lib/logger.ts                createLogger(scope)
  lib/motion.ts                usePrefersReducedMotion(), useInView(), useRafLoop()
  lib/webgl.ts                 isWebGLAvailable(), capped DPR helper
  content/profile.ts           typed profile, experience, education, links
  content/projects.ts          typed project data
  components/                  shared UI: Section, ProjectFrame, Button, Tag, Nav, Footer
  sections/
    Hero/index.tsx
    About/index.tsx
    projects/SafeSurf/index.tsx
    projects/Drone/index.tsx
    projects/XRay/index.tsx
    Experience/index.tsx
    Contact/index.tsx
e2e/                           Playwright specs, one per workstream
public/images/                 static images
```

## Section contract

Each `src/sections/**/index.tsx` default-exports a React component with no required props.
It renders one `<section>` through the shared `Section` component with these ids:

| Section | `id` |
|---|---|
| Hero | `top` |
| About | `about` |
| SafeSurf | `safesurf` |
| Drone | `drone` |
| XRay | `xray` |
| Experience | `experience` |
| Contact | `contact` |

Page order in `App.tsx`: Hero, About, SafeSurf, Drone, XRay, Experience, Contact.

Project sections use the shared `ProjectFrame` (title, one-line summary, stack tags, links,
and a slot for the interactive demo) so the three project sections look like one family.

## Shared interfaces (F implements, everyone uses)

```ts
// src/lib/logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}
export function createLogger(scope: string): Logger;   // prefix: [portfolio:<scope>]
export function setLogLevel(level: LogLevel): void;     // default: 'debug' in dev, 'warn' in prod; ?log=debug overrides

// src/lib/motion.ts
export function usePrefersReducedMotion(): boolean;
export function useInView<T extends Element>(options?: IntersectionObserverInit): [React.RefObject<T>, boolean];
export function useRafLoop(callback: (dtMs: number, tMs: number) => void, active: boolean): void; // pauses when !active or tab hidden

// src/lib/webgl.ts
export function isWebGLAvailable(): boolean;
export function cappedDpr(max?: number): number;        // default max 2
```

Exact content types live in `src/content/*.ts`; copy comes from `docs/CONTENT.md`.

## Shared files after foundation

`package.json`, `package-lock.json`, `src/App.tsx`, `src/styles/**`, `src/lib/**`,
`src/components/**` (except Nav and Footer, owned by B) are frozen for A to E. If a worker
must touch one, keep the change minimal and list it in the PR. The manager resolves
lockfile conflicts at merge time.

## Test ids

Interactive demos expose stable hooks for Playwright:
`data-testid="hero-canvas"`, `"safesurf-demo"`, `"drone-demo"`, `"xray-demo"`, plus
workstream-specific ids documented in each report.

# Contracts — file ownership and shared interfaces

Parallel workers stay out of each other's way by owning paths. The foundation workstream
creates every shared file and a stub for every section, so `App.tsx` never changes later.

## Workstreams

| ID  | Branch                          | Owns                                                                                                                                                                             | Port |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| R   | `docs/animation-research`       | `docs/research/**`                                                                                                                                                               | —    |
| F   | `feat/foundation`               | everything at first: tooling, `src/lib/**`, `src/styles/**`, `src/content/**`, `src/components/**`, `src/App.tsx`, stubs for all sections, CI, Firebase config, `docs/DESIGN.md` | 5180 |
| A   | `feat/hero`                     | `src/sections/Hero/**`, `e2e/hero.spec.ts`                                                                                                                                       | 5181 |
| B   | `feat/about-experience-contact` | `src/sections/About/**`, `src/sections/Experience/**`, `src/sections/Contact/**`, `src/components/Nav/**`, `src/components/Footer/**`, `e2e/about.spec.ts`                       | 5182 |
| C   | `feat/safesurf-demo`            | `src/sections/projects/SafeSurf/**`, `e2e/safesurf.spec.ts`                                                                                                                      | 5183 |
| D   | `feat/drone-demo`               | `src/sections/projects/Drone/**`, `e2e/drone.spec.ts`                                                                                                                            | 5184 |
| E   | `feat/xray-demo`                | `src/sections/projects/XRay/**`, `e2e/xray.spec.ts`                                                                                                                              | 5185 |
| Q   | `fix/integration-qa`            | cross-cutting polish after A to E are merged                                                                                                                                     | 5186 |

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

| Section    | `id`         |
| ---------- | ------------ |
| Hero       | `top`        |
| About      | `about`      |
| SafeSurf   | `safesurf`   |
| Drone      | `drone`      |
| XRay       | `xray`       |
| Experience | `experience` |
| Contact    | `contact`    |

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
export function createLogger(scope: string): Logger; // prefix: [portfolio:<scope>]
export function setLogLevel(level: LogLevel): void; // default: 'debug' in dev, 'warn' in prod; ?log=debug overrides

// src/lib/motion.ts
export function usePrefersReducedMotion(): boolean;
export function useInView<T extends Element>(
  options?: IntersectionObserverInit,
): [React.RefObject<T>, boolean];
export function useRafLoop(callback: (dtMs: number, tMs: number) => void, active: boolean): void; // pauses when !active or tab hidden

// src/lib/webgl.ts
export function isWebGLAvailable(): boolean; // WebGL2 only: no WebGL1 path anywhere
export function cappedDpr(max?: number): number; // default max 2
```

```ts
// src/lib/gsap.ts: the only place GSAP is imported from (plugins registered once)
export { gsap, ScrollTrigger, SplitText };

// src/lib/smoothScroll.tsx: mounted once in main.tsx; nothing else to do
export function SmoothScroll(props: { children: React.ReactNode }): JSX.Element;
// Lenis driven by gsap.ticker, anchor links through Lenis, off under prefers-reduced-motion
// (then <html> gets class "reduce-motion").

// src/components/Reveal/Reveal.tsx: the shared scroll-in reveal
export function Reveal(props: {
  variant?: 'up' | 'fade' | 'lines'; // default 'up'
  as?: React.ElementType; // default 'div'
  className?: string;
  children?: React.ReactNode;
}): JSX.Element;

// src/lib/glStage.ts: thin OGL wrapper, WebGL2 only. Import lazily via src/lib/lazyGl.ts
export class GlStage {
  static create(opts: GlStageOptions): GlStage | null; // null => show your fallback
  readonly canvas: HTMLCanvasElement;
  renderer: Renderer; // replaced after a context restore
  get gl(): WebGL2RenderingContext;
  get status(): 'ok' | 'lost' | 'disposed';
  get currentSize(): { width: number; height: number; dpr: number };
  start(): void;
  stop(): void;
  resize(): void;
  dispose(): void;
}
export interface GlStageOptions {
  container: HTMLElement;
  name: string;
  maxDpr?: number;
  alpha?: boolean;
  premultipliedAlpha?: boolean;
  powerPreference?: WebGLPowerPreference;
  onFrame?(dtMs: number, tMs: number): void;
  onResize?(s: StageSize): void;
  onContextLost?(): void;
  onContextRestored?(): void;
}

// src/lib/lazyGl.ts
export function loadGlStage(): Promise<typeof import('./glStage')>; // memoised dynamic import
```

Notes: `useInView` returns `RefObject<T | null>` (React 19 typing). `Section` takes
`id, title, headingAs?, hideTitle?, bench?, summary?`; `ProjectFrame` takes
`project, children, demoLabel?`. Details in `docs/reports/foundation.md`.

Exact content types live in `src/content/*.ts`; copy comes from `docs/CONTENT.md`.

## Cursor, magnetic and springs (design v2)

Opt-in custom cursor, mounted by `PageFx`. Absent on touch, coarse pointer and reduced motion;
the native cursor is hidden (`html.has-cursor`) only after the first real mouse move.
It never blocks clicks (`pointer-events: none`) and leaves text selection alone.

```html
<div data-cursor="drag" data-cursor-label="toss">...</div>
<!-- verb mode, label shown -->
<div data-cursor="hug">...</div>
<!-- reserved: hug | none | text | default -->
<button data-magnetic>...</button>
<!-- magnetic pull, primary Buttons have it by default -->
```

Links, buttons, `role=button` and checkboxes hug automatically; the nearest `data-cursor` wins.
Springs: `SPRING_SOFT`, `SPRING_SNAPPY`, `springEase` in `src/lib/spring.ts` (CSS tokens
`--spring-soft`, `--spring-snappy`). Token and recipe list: `docs/DESIGN.md` section 0.

## Shared files after foundation

`package.json`, `package-lock.json`, `src/App.tsx`, `src/styles/**`, `src/lib/**`,
`src/components/**` (except Nav and Footer, owned by B) are frozen for A to E. If a worker
must touch one, keep the change minimal and list it in the PR. The manager resolves
lockfile conflicts at merge time.

## Inner scroll areas

Every inner scroller is marked `data-scroll-area` via `scrollAreaProps` / `useScrollArea` (`src/lib/scrollArea.ts`);
`smoothScroll.tsx` passes `isInnerScrollTarget` as Lenis `prevent`. A new `overflow: auto|scroll` element without
it fails `e2e/inner-scroll.spec.ts`. Details: `docs/DESIGN.md`, "Inner scroll areas".

## Test ids

Interactive demos expose stable hooks for Playwright:
`data-testid="hero-canvas"`, `"safesurf-demo"`, `"drone-demo"`, `"xray-demo"`, plus
workstream-specific ids documented in each report.

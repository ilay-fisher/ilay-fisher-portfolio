# Report: workstream F (foundation)

Branch `feat/foundation`. Everything feature workers need is here; `package.json`,
`src/App.tsx`, `src/styles/**`, `src/lib/**` and `src/components/**` are frozen for A to E.

## What exists

- Tooling: Vite 8, React 19, TypeScript strict (`noUncheckedIndexedAccess`), ESLint 9 flat config
  (typescript-eslint, react-hooks, jsx-a11y, `no-console` with an override for `src/lib/logger.ts`),
  Prettier, Vitest + Testing Library + jsdom, Playwright (Chromium). ESLint is pinned to 9
  because `eslint-plugin-jsx-a11y` does not yet support 10.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `e2e`, `format`.
  `npm run dev -- --port 5180` works. Playwright reads `PORT` (default 5173), starts its own server.
- `src/lib`: `logger`, `motion`, `webgl`, `glStage` (+ `glStageLogic`, `lazyGl`), `gsap`, `smoothScroll`.
- `src/content`: `profile.ts`, `projects.ts` (typed, transcribed from CONTENT.md, invariants tested).
- `src/styles`: `tokens.css`, `global.css`. Design rules: `docs/DESIGN.md`.
- `src/components`: `Section`, `ProjectFrame`, `Button`/`LinkButton`, `Tag`/`TagList`, `Reveal`,
  `DemoPlaceholder`, `Nav`, `Footer`.
- `src/sections/**`: a stub per section with real copy and the contract `data-testid`s.
- Delivery: `firebase.json`, `.firebaserc` (not deployed), `.github/workflows/ci.yml`, `LICENSE`.

## How to use the shared pieces

**Section** (`id`, `title`, `headingAs?` `'h1'|'h2'`, `hideTitle?`, `bench?: {label, value}[]`,
`summary?`, `className?`, `children`). Never write a bare `<section>`. The heading line-reveals via `Reveal`.

**ProjectFrame** (`project` from `content/projects`, `children` = the demo, `demoLabel?`). The
three project sections render it and put the demo as children. Give the demo root its `data-testid`.
The challenge line ("Try to switch the filter off.") is the h2; case, project and status are bench labels.
Replace the `DemoPlaceholder` in your stub, keep the test id.

**Button / LinkButton** (`variant` `'primary'|'secondary'`). `LinkButton` opens http(s) links in a
new tab with `rel="noopener noreferrer"` and appends a visually hidden "(opens in a new tab)".
One `primary` per section.

**Tag / TagList** (`label`, `items`). **Reveal** (`variant` `up|fade|lines`, `as`, `className`): plays once at 85%
viewport; visible without JS and under reduced motion. Use sparingly (DESIGN.md).

**Logger**: `createLogger('scope')`; `?log=debug` overrides; `console` is lint-banned elsewhere.

**motion.ts**: `usePrefersReducedMotion()`, `useInView(options)` (returns `RefObject<T | null>`,
React 19 typing), `useRafLoop(cb, active)` (pauses on hidden tab).

**webgl.ts**: `isWebGLAvailable()` is WebGL2 only (changed from "WebGL" to match the research: GLSL ES 3.00,
no WebGL1 path). `cappedDpr(max = 2)`.

### GlStage (OGL wrapper, hero and SafeSurf)

```ts
const { GlStage } = await loadGlStage(); // src/lib/lazyGl.ts, keeps OGL out of first paint
const stage = GlStage.create({
  container,
  name: 'hero',
  powerPreference: 'high-performance',
  onFrame: (dt, t) => {
    /* draw with stage.renderer / stage.gl */
  },
  onResize: ({ width, height, dpr }) => {
    /* rebuild size-dependent targets */
  },
  onContextLost: () => showFallback(),
  onContextRestored: () => rebuildGlObjects(),
});
if (!stage) showFallback();
else stage.start(); // null = no WebGL2
// cleanup: stage.dispose()
```

- Gates on `isWebGLAvailable()` then verifies `renderer.isWebgl2`; never a WebGL1 path.
- Appends its canvas to `container` and sizes it from the container (ResizeObserver). DPR capped (`maxDpr`, default 2).
- Loop runs only when started, context ok, canvas in view and tab visible. `stop()` for idle-and-settled hero.
- Context lost: stops, `data-webgl="lost"`, calls `onContextLost`. Restored: creates a new OGL `Renderer` on the
  same canvas (so read `stage.renderer` and `stage.gl` fresh, never cache them), calls `onContextRestored`; you
  rebuild programs, textures and targets from CPU state.
- Probes on the canvas: `data-webgl="ok|lost"`, `data-frame`, `data-ready="true"` after the second frame.
- Logs lifecycle (`info`/`warn`), never per frame. Pure logic is in `glStageLogic.ts` (unit tested); the real
  GL path is covered by `e2e/glstage.spec.ts` (render, `loseContext`, `restoreContext`).
- Lazy pattern: documented in `src/lib/lazyGl.ts`: render the DOM/CSS fallback first, `useInView` with
  `rootMargin: '100% 0px'`, then `loadGlStage()`.

### Page motion

`SmoothScroll` (mounted in `main.tsx`) creates Lenis (autoRaf off, `anchors: true`, lerp 0.1) ticked by `gsap.ticker`,
updates ScrollTrigger on scroll, mirrors anchor clicks into `location.hash`. Lenis reads `scroll-padding-top` on `html`
to clear the sticky nav, so sections must not set their own `scroll-margin-top` (it would double the offset).
Under reduced motion nothing is created and `<html>` gets `reduce-motion`. `index.html` has an inline script that
sets `html.js` (enables hidden-until-revealed CSS) and removes it after 4 s if the app has not booted.

## Decisions

- Palette and fonts: see DESIGN.md. Display Bricolage Grotesque, body Instrument Sans, labels Martian Mono, hero
  paint face Fredoka (heavy, round terminals, from the research shortlist).
- ESLint 9, not 10 (jsx-a11y peer range).
- Playwright flags: kept `--use-angle=swiftshader --enable-unsafe-swiftshader` for Linux CI (research said unverified
  there); dropped `--use-gl=angle` and `--ignore-gpu-blocklist`. WebGL2 works locally with or without them.
- Reveal applied only to section headings (lines). Other effects are up to the sections.
- Stubs do not render the portrait or the writing strip; worker B owns them (photo needs the "IF" monogram fallback).
- Project images copied: `public/images/projects/drone-sandbox.png` (1440x900, 103 KB) and
  `xray-benchmark.png` (1277x700, 721 KB, not recompressed: it is text-heavy and lossy compression would blur it).
  No SafeSurf image was supplied; `Project.image` is optional.

## Tests

Unit: 71 (logger, motion, webgl, glStageLogic, lazyGl, gsap, smoothScroll, content invariants, every component, App).
E2E: 16 (smoke: no console errors, section order, nav scroll for six links and hash, skip link, no horizontal
overflow at 390, 1440 and 360 widths, reduced motion, no third-party requests and fonts loaded, WebGL2 present;
glstage: real context lost and restore).

## Known limits

- Commit order: tests precede implementation except the e2e specs, which were written together with the nav
  scroll fix because they depend on the whole page.
- `Nav` has no active-section highlight and a plain horizontally scrolling list on phones; B refines.
- The OGL chunk is not in the build yet because nothing imports `lazyGl`; check chunk size when A lands.
- Contrast numbers in DESIGN.md are computed, not measured with a tool on rendered pixels.
- GSAP uses a non-SPDX "no charge" licence (research section 2).

## Screenshots

`docs/reports/img/foundation-desktop-full.png`, `foundation-desktop-fold.png`, `foundation-mobile-full.png`,
`foundation-mobile-fold.png`.

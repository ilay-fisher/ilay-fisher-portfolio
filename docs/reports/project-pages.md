# Project detail pages

Owner feedback: "the projects should have different tab that will explain on them more."

## What was built
- One page per project: `/work/safesurf`, `/work/drone`, `/work/xray`.
- Each home ProjectFrame has a "Read the case study" key. It is a real `<a href>`: same tab on click, new tab on middle or cmd click.
- Page: back key to `/#<id>`, title, bench pills, links, stage (SafeSurf rig or real screenshot), problem, what I built, how it works, numbers, stack, previous/next project, contact CTA.
- Rounded 404 for unknown `/work/*`. Each page sets title, meta description and scrolls to top. Spring entrance (`case-rise`), none under reduced motion.

## Routing
Boot-time path switch (`parseRoute(location.pathname)` in `src/Root.tsx`) with `React.lazy` pages. No router library, no pushState. Every link is a full document load, so back, forward, refresh, new tab and scroll restoration are native. Home, Lenis and anchors are untouched. Lenis already deep-links `/#id`. Firebase `**` rewrite and Vite dev/preview fallback serve `index.html` for `/work/*`. Detail chunk about 10.8 KB, separate from home.

## Firebase
`**` -> `no-cache` first, then `/assets/**` -> `public, max-age=31536000, immutable`, `/images/**` -> `public, max-age=86400`. Later rules override earlier ones, so order matters. The old `/index.html` rule is removed. `src/firebase.test.ts` parses `firebase.json` and asserts this. Real Firebase precedence is not testable locally; docs state rules apply in written order.

## Tests
- Unit: 82 files, 705 tests pass (route, caseStudies, ProjectPage, Root, firebase, Nav base, ProjectFrame key).
- E2E `e2e/project-pages.spec.ts`: 14 pass. `e2e/smoke.spec.ts`: 16 pass. Run with `--workers=1` against the production preview. Full suite not run.
- Lint, typecheck, build clean. Red `test:` commit precedes the feat commit.

## New UI strings (owner approval needed)
"Read the case study", "Back to overview", "Previous project", "Next project", "The problem", "What I built", "How it works", "Numbers", "Stack", "LinkedIn", "GitHub", "Page not found.", "There is nothing at this address.", "Back to home". Reused: "Get in touch.", "Email Ilay". Titles: `<project> — Ilay Fisher`, `Page not found — Ilay Fisher`. Plus all case study body copy in `src/content/caseStudies.ts`.

## Fact sources
| Fact | Source |
|---|---|
| SafeSurf problem, built list, key ideas | CONTENT.md "About", "Projects 1" |
| 36.6% -> 14.2%, 22+ releases, 3-month beta | CONTENT.md "Experience 1" |
| Drone: A* vs D* Lite, 8-connected grid, wind 4x, 60 FPS, browser-only demo | CONTENT.md "Projects 2"; proj1 README |
| X-Ray pipeline, composite baseline/gap/target, upscale under 75 px up to 4x, ~95%, 43.7%, 4/4 vs 3/4 local | CONTENT.md "Projects 3"; proj2 README |
| Screenshots | proj1 docs/screenshot.png; proj2 docs/images/xray-lens-ui.png, haiku-u2.png (WebP) |

## Shared files touched
- `src/components/Nav/Nav.tsx`: optional `base` prop prefixing hash hrefs (`/#about` off home). Default `''`, so home unchanged.
- `src/components/ProjectFrame/ProjectFrame.tsx`: adds the CaseKey link.
- `src/main.tsx`: renders `Root` instead of `App`.
- `firebase.json`: headers as above.
- Not touched: `App.tsx`, `content/projects.ts`, Hero.

## Screenshots
`docs/reports/img/project-pages-*.png`: each page desktop/mobile top and scrolled, home key desktop/mobile, entrance frame sheet. Taken from production build (`npm run build && vite preview`).

## Doubts
- Port 5189 was held by another worker's dev server (feat/hero-v3), so I used 5199 for preview and e2e. Did not kill it.
- SafeSurf has no real screenshot, so the page shows the live rig.
- X-Ray screenshot is demo mode; caption says so.
- Drone report's measured findings (docs/reports/drone.md) left off: CONTENT.md is the only fact source.
- Firebase header order verified by unit test only.

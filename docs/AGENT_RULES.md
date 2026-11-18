# Rules for worker agents

The manager agent assigns one workstream per worker. Read this file, `docs/CONTRACTS.md`,
`docs/CONTENT.md`, `docs/DESIGN.md` and `docs/research/ANIMATIONS.md` before any code.

## 1. Isolation: your own worktree and branch

Never work in the main checkout (`/Users/ilayfisher/Documents/ilay-fisher-portfolio`).
Other workers run at the same time.

```bash
cd /Users/ilayfisher/Documents/ilay-fisher-portfolio
git fetch origin
git worktree add ../portfolio-worktrees/<branch-name> -b <branch-name> origin/main
cd ../portfolio-worktrees/<branch-name>
npm ci
```

Branch names: `feat/<workstream>`, `docs/<topic>`, `fix/<topic>`.
Dev server and Playwright port: use the port the manager gave you, never 5173.

## 2. Tests first (TDD)

1. Write failing tests that describe the behavior (Vitest + Testing Library for logic and
   components, Playwright for one user flow per interactive piece).
2. Commit the failing tests on their own: `test: ...`.
3. Write the code until the tests pass: `feat: ...`.
4. Pure logic (pathfinding, state machines, math, formatters) lives in plain `.ts` modules
   with no DOM, so it is unit-testable. Shaders and canvas drawing stay thin.

WebGL and Canvas cannot be asserted pixel by pixel in jsdom. Test the logic and state
around them, and verify the pixels with a Playwright screenshot.

## 3. Code quality

- TypeScript strict. No `any`, no `@ts-ignore`, no disabled lint rules without a comment that says why.
- Doc comment on every exported function, component, hook and type: what it does and why, not how.
- Stay inside your owned paths (`docs/CONTRACTS.md`). If you need a change in a shared
  file, make the smallest change, and list it under "Shared files touched" in the PR.
- New dependencies: avoid. If you truly need one, say why in the PR.
- No secrets, no API keys, no analytics, no network calls to third parties at runtime.
- No copied text, images or code from the reference designer. Build the technique, not a clone.

## 4. Logging

Use `createLogger('<scope>')` from `src/lib/logger.ts`. Never call `console.*` directly.

- `info`: lifecycle events (WebGL context created, demo started, fallback chosen)
- `warn`: degraded paths (WebGL unavailable, reduced motion, context lost)
- `error`: caught failures, with the error object
- `debug`: per-interaction detail. Never log inside a per-frame loop.

## 5. Accessibility and performance (required, tested)

- `prefers-reduced-motion: reduce` gives a static or gently faded version of every animation.
- Every interactive piece works with keyboard, has visible focus and an accessible name.
- WebGL failure or context loss falls back to a static render. Never a blank box.
- Pause render loops when the piece is off screen (IntersectionObserver) or the tab is hidden.
- Cap device pixel ratio at 2. Target 60 FPS on a mid-range laptop.
- Works from 360 px wide to 1920 px. No horizontal scroll.

## 6. Before you open the PR

All of these pass, from your worktree:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run e2e
```

Then verify visually: run the dev server on your port, capture screenshots with Playwright
at 1440x900 and 390x844 (plus one mid-interaction), look at them yourself, fix what looks
wrong, and save the final ones to `docs/reports/img/<workstream>-*.png`.

Write `docs/reports/<workstream>.md`: what you built, how the animation works, test list,
known limits, shared files touched, screenshots.

## 7. Pull request

On this machine `gh` is an x86_64 binary and fails when it shells out to `/usr/bin/git`.
Always run `gh` with the Command Line Tools git first on the PATH:

```bash
export PATH=/Library/Developer/CommandLineTools/usr/bin:$PATH
git push -u origin <branch-name>
gh pr create --repo ilay-fisher/ilay-fisher-portfolio --head <branch-name> --base main --title "<type>: <summary>" --body "<what, why, how tested, screenshots, shared files touched>"
```

Do not merge. Do not push to `main`. Report back to the manager with: PR URL, branch,
test counts, the screenshot paths, and anything you are unsure about. Report failures
honestly; a red test you could not fix is information the manager needs.

# Ilay Fisher — Portfolio

> I build software that has to hold up when someone is actively trying to break it.

An interactive, single-page portfolio. Instead of describing the projects, the page lets
the visitor play with a small, working piece of each one:

| Section | What the visitor can do | Source project |
|---|---|---|
| Hero | Paint and distort the headline in real time (WebGL) | — |
| SafeSurf | Flip the filter on a mock page and watch images and video dissolve; try to turn it off and hit the delay lock | [safesurfsite.com](https://safesurfsite.com) |
| Drone sandbox | Drop obstacles on a city grid and watch the drone re-plan its route live (A* / D* Lite) | [drone-obstacle-sandbox](https://github.com/ilay-fisher/drone-obstacle-sandbox) |
| X-Ray Lens | Drag a split slider across an inspected image to reveal the CV diff heatmap and the flagged regions | [multimodal-visual-qa-xray-lens](https://github.com/ilay-fisher/multimodal-visual-qa-xray-lens) |
| About / Experience / Contact | Who I am, what I have shipped and taught, how to reach me | LinkedIn |

## Tech stack

| Layer | Technology |
|---|---|
| App | Vite, React, TypeScript (strict) |
| Motion | WebGL shaders, Canvas 2D, GSAP, smooth scroll (final choices in `docs/research/ANIMATIONS.md`) |
| Quality | Vitest + Testing Library (unit, TDD), Playwright (e2e + screenshots), ESLint, Prettier |
| Delivery | Firebase Hosting, GitHub Actions CI, Cloudflare domain (later) |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run e2e        # Playwright
npm run build && npm run preview
```

## How this repo was built

A manager agent planned the work, wrote the contracts and reviewed every pull request.
Worker agents each owned one workstream, wrote tests first, and opened one PR per feature.

- `docs/WORKFLOW.html` — delivery board and workflow diagram
- `docs/CONTRACTS.md` — file ownership and shared interfaces
- `docs/AGENT_RULES.md` — rules every worker follows (TDD, logging, PR checklist)
- `docs/CONTENT.md` — source of truth for all copy on the site
- `docs/research/ANIMATIONS.md` — how each animation is built
- `docs/reports/` — one report per workstream

## License

MIT

# Ilay Fisher — Portfolio

> Hi, I'm Ilay. I study computer science and build Android apps, backends and AI agents.

An interactive, single-page portfolio. Instead of describing the projects, the page lets
the visitor play with a small, working piece of each one:

| Section                      | What the visitor can do                                                                                       | Source project                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Hero                         | Paint and distort the headline in real time (WebGL)                                                           | —                                                                                               |
| SafeSurf                     | Flip the filter on a mock page and watch images and video dissolve; try to turn it off and hit the delay lock | [safesurfsite.com](https://safesurfsite.com)                                                    |
| Drone sandbox                | Drop obstacles on a city grid and watch the drone re-plan its route live (A* / D* Lite)                       | [drone-obstacle-sandbox](https://github.com/ilay-fisher/drone-obstacle-sandbox)                 |
| X-Ray Lens                   | Drag a split slider across an inspected image to reveal the CV diff heatmap and the flagged regions           | [multimodal-visual-qa-xray-lens](https://github.com/ilay-fisher/multimodal-visual-qa-xray-lens) |
| About / Experience / Contact | Who I am, what I have shipped and taught, how to reach me                                                     | LinkedIn                                                                                        |

**Live:** https://ilay-fisher-portfolio.web.app

## Tech stack

| Layer    | Technology                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------- |
| App      | Vite, React, TypeScript (strict)                                                               |
| Motion   | WebGL shaders, Canvas 2D, GSAP, smooth scroll (final choices in `docs/research/ANIMATIONS.md`) |
| Quality  | Vitest + Testing Library (unit, TDD), Playwright (e2e + screenshots), ESLint, Prettier         |
| Delivery | Firebase Hosting, GitHub Actions CI, Cloudflare domain (later)                                 |

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

## Trademarks and attributions

Logos are trademarks of their respective owners, used to indicate the technologies I work with.
They are self-hosted (path data from [simple-icons](https://simpleicons.org), CC0-1.0; the Java mark from the
[devicon](https://github.com/devicons/devicon) repository, MIT, where the Java name and coffee cup mark remain
trademarks of Oracle; the C hexagon from the simple-icons ISO C++ geometry without the plus signs). In the hero
each mark is extruded unaltered into a die-cut token in the brand's own colour (or printed flat on a
keycap); the full source and licence list is in `docs/reports/hero.md`. The footer's LinkedIn "in" and GitHub marks are simple-icons path data (CC0-1.0); LinkedIn and GitHub are trademarks of their owners.

- The Android robot is reproduced or modified from work created and shared by Google and used
  according to terms described in the Creative Commons 3.0 Attribution License.
- The Git logo by [Jason Long](https://twitter.com/jasonlong) is licensed under the Creative Commons
  Attribution 3.0 Unported License.
- The GitHub mark is a trademark of GitHub, Inc.; the GitHub piece in the hero links to my own profile.
- The LinkedIn "in" mark is a trademark of LinkedIn Corporation. Its path data is the CC0-1.0 simple-icons 12.0.0
  file (the last release that carried it); the piece links to my own profile.
- The TypeScript mark is a trademark of Microsoft Corporation (path data from simple-icons, CC0-1.0).

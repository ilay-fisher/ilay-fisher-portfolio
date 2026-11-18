# Drone demo report

Branch `feat/drone-demo`. Replaces the placeholder inside `ProjectFrame` with a live drone rig.

## What it is

A drone flies a 40x24 city grid (28x20 and 20x22 on narrower stages). The visitor drags obstacles, wind or a new goal. The drone re-plans in real time. A bench readout shows what the planner measured. It self-runs until the visitor interacts. Under reduced motion it shows one static planned route and no loop.

## Planner

- A* (octile, 8-connected, no corner cutting, wind 4x). Always on, covered by tests against Dijkstra.
- D* Lite (backward, incremental) ships. Evidence: 3000 randomised plans with obstacle edits, start moves and goal moves, cost equal to A* and Dijkstra every time (`planner/planner.test.ts`).
- Both run on every re-plan and share one grid; the readout compares their real expanded-node counts. Nothing is faked.

### Honest finding on D* Lite

It does not always expand fewer nodes per plan. The first plan is a full backward search, so it expands more than A* (seen 103 vs 41 and 300 vs 131). Over many edits its total is lower on cluttered grids (20% clutter: 71 vs 153 mean per plan) and similar on open ones (40 vs 48). The UI reports whichever is true, including when A* wins a plan.

## Measured (1440x900, headless Chromium, dev server, `?drone=test-live`)

- Frame cost (CPU time of update plus draw submission, via `window.__drone.timing()`): mean 0.54 ms, p95 2.6 ms, max 5.3 ms over 465 frames. Before the redesign pass: mean 7.6 ms, p95 8.2 ms, max 9.7 ms. This is CPU only; GPU raster is not measured.
- What changed: settled flood glow cached per planner, static layers (ground, buildings, wind) cached, sprites pre-rendered (drone, glow stamps, shadows), the settled route is one stroke, no per-frame gradients or shadow blur.
- Re-plan: A* 0 to 0.1 ms, D* Lite 0.1 to 0.3 ms.

## Tests are deterministic

No e2e test depends on wall-clock frame rate. `?drone=test` uses a manual clock: the probe `step(n, dtMs)` advances n simulation ticks and the test then asserts state, plus a non-blank canvas sample. `?drone=test-live` keeps the real rAF loop for one test that only checks the loop is active (polled). Flake diagnosis: the old frame-loop test assumed a frame rate; headless Chromium with tracing under parallel workers renders far fewer frames, so progress checks and the route comparison raced the loop. The manual clock removes the race. The `toHaveAttribute` failure was the same cause (state asserted before the loop had advanced it).

## Ported from proj1 (MIT, credited in header comments) and what changed

Ported: the A* and D* Lite algorithms, the binary heap, the octile cost model, the seeded RNG idea, the wind cost model.
Changed: rewritten as strict TS with no DOM; planners record expansion order; D* Lite gets start/goal moves; a shared `Grid` with change events; a model layer (scene, self-run, unreachable handling, re-plan events, animation facts); a Canvas renderer; the Wasm build is not included.

## Visual and motion

Wavefront flood in expansion order, then the route draws itself with a bright head and fading tail while the old route dissolves. Each planner's visited region is a soft filled glow spreading in expansion order with a brighter leading edge that fades; A* is cool, D* Lite warm, and the area difference stays readable. No outline. Drone with banking, lean, shadow, scan pulse and recoil. Buildings are dark anodised bodies with a soft top highlight, a tight specular edge, a contact shadow and slightly varied heights (light top-left). Tool buttons are keycaps with press travel. The invitation line above the canvas is the owner-approved: "Get in its way. It won't take it personally. It re-plans." The canvas wrapper carries `data-cursor="draw"`. Pointer tile and trail. Palette is read from the `--paint*`, `--surface*`, `--text*` tokens at runtime; no colour is hard-coded except neutrals.
Evidence: `docs/reports/img/drone-1440-*.png`, `drone-390-*.png` (idle, replan, after), `drone-frames-replan.png` (8 frames, 100 ms apart through a goal move re-plan), `docs/reports/video/drone.webm` (9 s of play).

## Test ids

`drone-demo`, `drone-canvas`, `drone-status`, `drone-live`, `drone-tool-obstacle|wind|goal`, `drone-erase`, `drone-draw-mode`, `drone-btn-drop|wind|goal|reset`, `drone-algo-astar|dstar`, `drone-readout-algorithm|expanded|time|cost|replans`, `drone-compare-astar|dstar`, `drone-compare-total-astar|dstar`, `drone-caption`. `drone-invite`. Test probe `window.__drone` (state, timing, plans, `step`, `loopActive`) only with `?drone=test`, `test-auto`, `test-live` or `test-live-auto`.

## Shared files touched

None. Rebased on design system v2. The `.project__rig:has(> .drone-host)` override and the local radius fallbacks are gone: the shared `.stage` wrapper supplies the stage, and the rig uses `--radius-card/control`, `--well-inset`, `--bevel-inset-sm`, `--shadow-contact-sm` and `--spring-snappy`. Native cursor rules on the canvas are removed; the canvas wrapper uses `data-cursor="draw"` with label "draw", buttons hug by default.

## Weak or unverified points

- Verified in the v2 orange-red (`--paint #ff5a1f`): path, drone and flood read the tokens at runtime. A* glow is cool grey, D* Lite is the accent.
- The machine was at load average above 100 (other workers) during the last stress attempt, so timing-based e2e in every spec, including other workers', timed out. The 8-run result is in the PR description.
- Art-direction gates (no-rectangle, frame, mass tests) were checked by eye only. Buildings and the stage are rounded.
- Wavefront cell flare is slightly noisy at 1x speed; the contact sheet is one re-plan, not several.
- Springs are hand-tuned easing, not a physics solver.
- 390 px: tier 20x22 checked in screenshots and e2e; no real touch device tried.
- Frame cost is CPU only; a real GPU or a weak phone may differ.
- The wind zone looks like a faint grey patch with chevrons; it is readable but quiet.
- The old route dissolve (900 ms) is subtle in stills; it is visible in the video.

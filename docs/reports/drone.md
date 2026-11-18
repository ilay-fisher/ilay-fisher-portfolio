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

## Measured (1440x900, headless Chromium, dev server)
- Frame cost (update + draw): mean 7.6 ms, p95 8.2 ms, max 9.7 ms over 469 frames.
- Re-plan: A* 0 to 0.1 ms, D* Lite 0.1 to 0.3 ms, nodes 25 to 103 in the sample run.
- Headless Playwright with tracing on renders only about 16 fps; the frame loop e2e polls instead of assuming 60 fps.

## Ported from proj1 (MIT, credited in header comments) and what changed
Ported: the A* and D* Lite algorithms, the binary heap, the octile cost model, the seeded RNG idea, the wind cost model.
Changed: rewritten as strict TS with no DOM; planners record expansion order; D* Lite gets start/goal moves; a shared `Grid` with change events; a model layer (scene, self-run, unreachable handling, re-plan events, animation facts); a Canvas renderer; the Wasm build is not included.

## Visual and motion
Wavefront flood in expansion order, then the route draws itself with a bright head and fading tail while the old route dissolves. The other planner's region shows as a rim. Drone with banking, lean, shadow, scan pulse and recoil. Buildings drop, settle and lift. Pointer tile and trail. Palette is read from the `--paint*`, `--surface*`, `--text*` tokens at runtime; no colour is hard-coded except neutrals.
Evidence: `docs/reports/img/drone-1440-*.png`, `drone-390-*.png` (idle, replan, after), `drone-frames-replan.png` (8 frames, 100 ms apart through a goal move re-plan), `docs/reports/video/drone.webm` (9 s of play).

## Test ids
`drone-demo`, `drone-canvas`, `drone-status`, `drone-live`, `drone-tool-obstacle|wind|goal`, `drone-erase`, `drone-draw-mode`, `drone-btn-drop|wind|goal|reset`, `drone-algo-astar|dstar`, `drone-readout-algorithm|expanded|time|cost|replans`, `drone-compare-astar|dstar`, `drone-compare-total-astar|dstar`, `drone-caption`. Test probe `window.__drone` (state, timing, plans) only with `?drone=test` or `?drone=test-auto`.

## Shared files touched
None. One look override: `DroneRig.css` uses `.project__rig:has(> .drone-host)` to make the shared rig wrapper transparent and hide its tick marks, so the stage reads as one rounded unit. Radius tokens fall back to 36/24/16 px because main has no radius tokens beyond `--radius-pill`.

## Weak or unverified points
- Accent is still pink on main (`--paint` is `#ff3d6e`); the orange-red art direction is not on main yet. The rig follows the tokens, so it should switch without edits, but I have not seen it in orange-red.
- Art-direction gates (no-rectangle, frame, mass tests) were checked by eye only. Buildings and the stage are rounded; the flood rim still has some small stair-steps.
- Wavefront cell flare is slightly noisy at 1x speed; the contact sheet is one re-plan, not several.
- Springs are hand-tuned easing, not a physics solver.
- 390 px: tier 20x22 checked in screenshots and e2e; no real touch device tried.
- Frame cost mean 7.6 ms is higher than I want (a lot of it is the flood layers); fine for 60 fps but not free on weak phones.
- The e2e frame-loop test was flaky under parallel load (headless, tracing on); it passed in 3 of 4 full runs after hardening.

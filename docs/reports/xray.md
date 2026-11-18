# Report: workstream E (X-Ray lens demo)

Branch `feat/xray-demo`. The placeholder inside `ProjectFrame` ("Find what changed.") is replaced by a
rig that runs the diff in the visitor's browser and replays a recorded diagnosis.

## What was built

- **Split slider.** Two stacked layers over the target image. The heatmap layer is clipped with
  `inset(0 (100-v)% 0 0)`, so the heatmap is on the left and the plain target on the right. A native
  `input[type=range]` sits over the stage at opacity 0 and drives it, so keyboard, touch and screen
  readers work; the handle is drawn. The value text reads "Heatmap on the left 60 percent, target on
  the right".
- **Client-side heatmap.** Pure TypeScript in `diff.ts`: downscale to 480 px wide, blur both frames,
  take the diff as the max of luma and channel differences, normalise by the 0.999 percentile
  (floored at 30), map through a 256-entry inferno-like LUT with smoothstep alpha. If pixel access
  fails (canvas taint, no 2d context), the component falls back to a precomputed heat PNG and logs a
  warning through `createLogger('xray')`.
- **Regions.** Mask = floor (40 down to 6 by sensitivity, default 0.5) AND (local-mean threshold OR
  twice the floor), closed; then connected components, padding, overlap merge, minimum-area filter,
  largest first. Drawn as SVG boxes that dash-draw in. Each is a real `button` named
  "Region N of M".
- **Diagnosis stream.** Selecting a region shows the baseline and target crop pair (CSS background
  positioning, `pairLayout` from proj2) and types out category, severity, confidence and description
  at 90 characters per second with seeded chunks and punctuation pauses. The text is a recorded
  result and is labelled as such in the panel ("Recorded result, replayed from a real run. Not a
  live model call.") plus a provenance line. Fields the README does not record show "not recorded".
  A polite live region announces the full diagnosis once, when the stream finishes.
- **Why it matters.** README numbers only: 2,460 image tokens full frame versus 117 to 121 for crops
  (about 95% fewer), cloud latency 43.7% lower (17,838 ms versus 10,034 ms totals). Plus the real
  `performance.now()` time of the diff on this device.
- **Presets.** PCB board, Aerial crop, UI layout, and a "Guess first" toggle that hides the heatmap
  and boxes until Reveal.
- **Motion.** One intro sweep (2.6 s) the first time the stage is in view with a result; cancelled by
  any input; nothing loops. Under reduced motion: no sweep, no typing (full text at once), the slider
  rests at 50, and the box draw-in animation is disabled.

## Reused from proj2

Ideas and constants ported in spirit, re-implemented in TypeScript (nothing copied as code):

- `cv_pipeline.py`: blur then diff (max of luma and channel), floor/sensitivity mapping, local-mean
  threshold combined with a floor multiple, morphological close, connected components, pad, merge,
  minimum area, sort by area.
- crop pair layout: minimum side 75, maximum scale 4, 8 px gap (`crop.ts`).
- The demo images (PCB, aerial, UI base/target pairs) and the recorded Haiku U2 diagnosis text from
  `docs/images/haiku-u2.png`; the R5 wording comes from the repo demo rule engine.
- Benchmark numbers from the proj2 README.

## Results per preset

| Preset | Regions detected | Measured diff (dev build, this machine) |
| ------ | ---------------- | --------------------------------------- |
| PCB    | 2 (R5 at 1, U2 at 2) | about 34 ms (range seen 33 to 40) |
| Aerial | 1                | about 32 ms |
| UI     | 1                | about 29 ms |

OpenCV does this in about 10 ms server side; the browser version is slower but needs no server.
The PCB U2 crop composite computes as 236 x 84 px here; the recorded real run was 242 x 75. Shown as
computed, not as recorded.

## Tests

- Unit (Vitest, 59 in `src/sections/projects/XRay`): `diff` (grayscale, absdiff, blur, threshold,
  components, merge, LUT, percentile, end to end regions), `clip`, `stream`, `readout`, `crop`,
  `data` (README numbers and fallback boxes), `XRayDemo` (slider clip, regions as buttons, streaming,
  reduced motion, fallback on rejected `analyze`, guess first, preset switch).
- E2E (Playwright, 6 in `e2e/xray.spec.ts`): images load and heatmap canvas is non-blank with no
  console errors; keyboard and drag move the slider; PCB regions found and a selected region streams
  to completion; preset switch; keyboard-only run; no horizontal scroll at 390 px.
- Commits: `test:` commits precede the `feat:` commit.

## Test ids (stable)

`xray-demo`, `xray-preset`, `xray-preset-pcb`, `xray-preset-aerial`, `xray-preset-ui`, `xray-stage`,
`xray-target-image`, `xray-baseline-image`, `xray-heatmap` (`data-source` = pending | computed |
fallback), `xray-slider`, `xray-region-N`, `xray-diagnosis`, `xray-crop-pair`, `xray-description`,
`xray-replay-note`, `xray-readout`, `xray-measured`.

## Files

Owned: `src/sections/projects/XRay/**`, `public/images/xray/**` (webp q96 baseline and target per
preset, plus `*-heat.png` fallbacks), `e2e/xray.spec.ts`, this report and `docs/reports/img/xray-*`.
Shared files touched: none. No new dependencies.

## Screenshots

`docs/reports/img/xray-desktop-slider.png`, `xray-desktop-region.png` (1440x900 viewport, rig only),
`xray-mobile-slider.png`, `xray-mobile-region.png` (390x844). Captured with reduced motion.

## Known limits

- Detection thresholds were tuned against the three bundled image pairs only. A webp quality of 88
  produced a false third PCB region, so images ship at q96; other inputs are untested.
- Diagnoses are recorded text. Aerial and UI diagnoses have no recorded severity or confidence in the
  README, shown as "not recorded".
- Fallback boxes are stored coordinates; the fallback path was exercised by unit tests and not by a
  real canvas failure in a browser.
- Timings were measured in the dev server, not the production build, and on one machine.
- Tested in Chromium only.

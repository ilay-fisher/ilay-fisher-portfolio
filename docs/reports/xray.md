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

## Design v2 pass: hardware, not widget

Everything below uses the shared tokens and utility classes; `src/sections/projects/XRay/css.test.ts`
fails the build if `XRay.css` gains a hex colour, the v1 mint (`--pass`), a local radius alias or a
literal fallback.

- **Material and light.** One light source, top left. The rig sits on the shared `.stage`; the lens
  is seated in a `.bevel` bezel with a `--radius-card` window; the diagnosis panel is a `.tile`;
  fields, description and the "why it matters" readout are `.well` recesses. Shadows are
  `--shadow-contact*`, bevels `--bevel-inset*` and `--well-inset`, rim light `--rim-gradient`.
- **Divider as hardware.** A round bevelled knob (`--body-gradient`, rim gradient, knurled edge,
  accent lamp) rides a visible rail: an engraved groove (`.well`) with tick marks, lit in the accent
  gradient up to the knob. The knob follows the same critically damped spring as before and presses
  in on the snappy spring token. The line across the image is a lit accent edge, no colour fringe.
  Dragging works anywhere on the stage or the rail (the native range covers both).
- **Presets as keycaps.** Body gradient, bevel and contact shadow in a recessed tray; the selected
  key is pushed in (well inset, accent legend and lamp). Press and release use `--spring-snappy`.
- **Heat side.** The same frame, desaturated and darkened under the heat layer, with the colormap
  glowing over it (plus a blurred screen-blended copy for bloom) and the lens shading toward its
  rim. The colormap is derived at runtime from `--paint-deep-rgb`, `--paint-rgb` and
  `--paint-hi-rgb` (`palette.ts`: ink, ember, signal, amber, hot core); nothing in the canvas path
  is a literal colour. Where the tokens are not defined (jsdom) it falls back to a neutral grey ramp.
  The precomputed fallback PNGs were regenerated from the same pipeline with the same tokens.
- **Layout at 1440.** The stage column and the diagnosis panel now stretch to one height; the
  caption lives inside the bezel; the readout is a full-width instrument strip under both, with the
  bars and numbers on the left and the summary and notes on the right. No dead column. The idle
  panel is a standby display with a faint reticle instead of a blank card.
- **Regions.** The corner brackets are gone (forbidden). A region is a rounded target ring
  (`--radius-control`) that locks on with `--spring-soft`, then a flash and two pulses.
- **Cursor contract.** `data-cursor="drag"` (label "scrub") on the slider area, `data-cursor="scan"`
  (label "inspect") on every region button. Copy stays factual.
- **No layout shift.** Caption and measured line reserve their final line count (`lh` units), so the
  page below no longer jumps by 22 to 40 px when the diff result lands (see CI below).

## Motion (unchanged from the motion pass)

- **Inertia.** The drawn divider follows the input through a critically damped spring (`springStep`,
  no overshoot); keyboard steps glide. The input itself is the native range and reports instantly.
- **Sweep.** `sweepPath`: eases from 50 to the left edge, across to the right and back to 50,
  dwelling over each detected region. Runs once, when the stage is first at least half in view. Any
  input cancels it.
- **Lock-on and selection.** Each region locks on, flashes and pulses; the selected target crop
  flies into the diagnosis panel (480 ms, Web Animations API), fields appear one by one, the category
  types in and the description streams with a caret. One scan line crosses the heat side once.
- **Readout.** ROI bars start at the full-frame length and settle to their real share.
- **Reduced motion.** No sweep, scan, lock-on, pulse, flight, typing or transitions; everything is
  present statically, slider at 50.

## CI: run 44305273251

The failing job was the push run of `npm run e2e`: 32 passed, 1 failed, and the one failure was not
an X-Ray test: `e2e/about.spec.ts` "mobile nav reaches every section at 390x844", polling that the
clicked section reaches the top within 5 s. The PR run of the same commit passed. Cause, reproduced
locally: on mobile the X-Ray rig grew by 22 to 40 px when the diff result landed (caption and
measurement line wrapped to more lines), shifting every section below it while the smooth scroll
toward Experience or Contact was in flight, so the target ended up past the 120 px threshold. It
depends on when the diff finishes relative to the scroll, hence passes on one run and fails on
the next. This is a real (small) layout shift in this section, not a Playwright quirk. Fix:
reserve the final line count; new e2e test "the rig does not change height when a diff result
lands" at 390 and 1440. Full suite 5 times in a row: see the PR description for the counts.

## Layout shift fix (manager review, CI about.spec:53)

The mobile nav test failed because the section changed height after a nav jump (panel filling on
selection, crops and text of different sizes). Now the section reserves its final height before
anything loads or computes: crops sit in fixed-ratio frames, every recorded description and note has
an invisible copy in the same grid cell, the fields are a fixed two-column grid, and the idle panel
holds an invisible stand-in body with the display laid over it. At 900 px and up the readout moved
under the rig so both columns end together. New e2e test records `scrollHeight` and the `#experience`
offset after load, after the diff, after selecting a region and after the diagnosis completes, at
360, 390, 768 and 1440, and asserts they are identical. The keyboard-only test now runs with reduced
motion and the stage is scrolled into view first: the region buttons only render once the stage has
been seen, so a short viewport waited for buttons that never appeared (the CI stall).
Stills were re-shot. The video and the three contact sheets predate this change.

## Evidence

- `docs/reports/img/xray-frames-sweep.png`: 20 frames about 133 ms apart through the sweep (heat on
  the left of the divider, photo on the right, knob and lit rail following).
- `docs/reports/img/xray-frames-lockon.png`: 16 frames about 133 ms apart of the lock-on, flight and
  first field reveal.
- `docs/reports/img/xray-frames-select.png`: 16 frames about 200 ms apart of the readout filling.
- `docs/reports/video/xray.webm`: full flow (sweep, drag, select, readout bars, preset switch,
  second selection), recorded in Chromium with software GL.
- Frames were cut from that video with ffmpeg, so timing is as recorded, not synthetic. The machine
  was heavily loaded during recording, so timing in the video is slower than a normal run.
- Iterations on the frames: the first contact sheet showed the stage dropping about 12 px when a
  result landed (the bezel centred its content while the panel grew). Fixed with top alignment; the
  re-shot sheets show a steady stage.

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

- Unit (Vitest, 74 in `src/sections/projects/XRay`): `diff` (grayscale, absdiff, blur, threshold,
  components, merge, LUT, percentile, end to end regions), `clip`, `stream`, `readout`, `crop`,
  `data` (README numbers and fallback boxes), `XRayDemo` (slider clip, regions as buttons, streaming,
  reduced motion, fallback on rejected `analyze`, guess first, preset switch).
- Pure maths for the motion (`sweepPath`, `springStep`) has its own unit tests, written first.
- E2E (Playwright, 8 in `e2e/xray.spec.ts`; includes the knob and cursor contract and a no layout shift check): images load and heatmap canvas is non-blank with no
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

`docs/reports/img/xray-desktop-slider.png`, `xray-desktop-region.png` (1440x900 viewport, rig only, rebased onto main),
`xray-mobile-slider.png`, `xray-mobile-region.png` (390x844). Captured with reduced motion.

## Known limits

- `.tile` is defined in `Experience.css`, not `global.css`; the panel relies on that bundle being global.
  If it moves, the panel loses its surface.
- The PCB heat area is small because the real diff is small; the unmistakable heat versus photo
  reveal is clearest on Aerial and UI.
- The surrounding `ProjectFrame` still draws its own corner ticks and hairline frame; that is shared.
- Motion was judged from frame grabs and the recorded video, not on a real GPU or a phone. The lock-on
  brackets are small on the smallest boxes (about 20 px) so the convergence is subtle there.
- The scan line, rings and region pulses are finite (once, twice), not a continuous shimmer, to keep
  the "nothing loops" rule. A continuous scan was not built.

- Detection thresholds were tuned against the three bundled image pairs only. A webp quality of 88
  produced a false third PCB region, so images ship at q96; other inputs are untested.
- Diagnoses are recorded text. Aerial and UI diagnoses have no recorded severity or confidence in the
  README, shown as "not recorded".
- Fallback boxes are stored coordinates; the fallback path was exercised by unit tests and not by a
  real canvas failure in a browser.
- Timings were measured in the dev server, not the production build, and on one machine.
- Tested in Chromium only.

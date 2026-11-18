# Hero report (worker A, v3 by worker H)

Branch `feat/hero-objects`. Replaces the rejected inflated-letters hero with a playable 3D studio:
16 glossy rigid bodies (12 keycaps, dial, toggle, shield, lock) fall onto a dark stage and bounce
off the name "Ilay Fisher", which is solid, immovable 3D lettering.

## Stack decision (measured)

| Option                       | Cost                                        | Verdict                                |
| ---------------------------- | ------------------------------------------- | -------------------------------------- |
| three 0.180 + cannon-es 0.20 | lazy chunk 643 kB raw, **171.5 kB gzip**    | chosen                                 |
| three + Rapier (wasm)        | about 1.17 MB gzip for the wasm alone       | rejected, 4x over budget               |
| OGL (`GlStage`)              | small, but no PBR, no PMREM, no shadow maps | rejected, cannot make glossy clearcoat |

- Main bundle is unchanged by the hero apart from the host component; the 3D runtime is a dynamic
  `import('./scene/runtime')` fetched in an idle callback after first paint (single-flight, safe
  under StrictMode). Measured by `npm run build`: `runtime-*.js` 643.09 kB, gzip 171.47 kB.
- WebGL2 only. No third-party runtime requests: the environment map is a procedural softbox
  rendered through PMREM at start-up; the name outline is generated into `nameGlyphs.ts` by
  `src/sections/Hero/tools/build-name-glyphs.mjs`; fonts are the site's own.

## How it is built

- `logic/` is DOM-free and unit tested: catalogue, seeded rng, camera rig maths, name layout, spawn
  plan, grab spring, fixed-step accumulator, idle nudges, quality controller, mode selection,
  keyboard map, play region.
- `physics/world.ts`: cannon-es, fixed 1/120 s step with render interpolation, speed clamp 24,
  sleeping, 14 solver iterations, walls and ceiling, static name colliders (box per letter with a
  gap in the plinth so the `y` tail passes through), grab spring constraint, throw.
- `scene/`: three.js layer. Glyph meshes are extruded paths, bodies are bevelled boxes with legend
  canvas textures (map, bump, emissive). Key light at 135 degrees (top-left, same as the page),
  cool rim, procedural PMREM environment, ACES tone mapping, PCF-soft shadow map on a
  `ShadowMaterial` floor, plus per-object contact blobs and a warm light pool.
- Camera: lens shift via `setViewOffset` so the scene sits beside the copy on desktop and under it
  on mobile (break at 900 px). The play region is measured from the real text box.
- `index.tsx`: real HTML (h1, thesis, role, availability, two actions, scroll cue, invitation line,
  reset). Canvas is always in the DOM; in still mode the committed still overlays it.
- Input: pointer grab with spring, quick click gives an impulse, hover lifts. Touch: pointerdown
  sets a pending grab, a non-passive `touchstart` calls `preventDefault` only if a body is under the
  finger, and the canvas has `touch-action: pan-y`, so dragging empty space scrolls the page.
  Keyboard: N picks, arrows push, Space hops, S shuffles, R re-drops.
- Robustness: DPR capped at 2 with a 4-level adaptive quality controller (pixel ratio scale 1, 0.85,
  0.7, 0.55; shadow map 2048 or 1024; median over 30 frames; steps down only); loop paused off
  screen and when the tab is hidden; debounced resize; fonts awaited before legend textures; context
  loss keeps the canvas, shows the still, rebuilds the environment on restore.
- Fallback: `public/hero/still-{desktop,mobile}.webp` (57 kB, 20 kB, transparent, text hidden) are
  rendered from this very scene by `src/sections/Hero/tools/build-evidence.mjs`. They show without
  WebGL2, on context loss, on a failed chunk load and under reduced motion (no render loop).
- Test hooks: canvas `data-testid="hero-canvas"` with `data-ready`, `data-bodies`, `data-sleeping`,
  `data-seed`, `data-breakpoint`, `data-quality`; `window.__hero` only with `?heroSeed=N` or
  `?heroDebug`. Logging via `createLogger('hero')`, never per frame.
- Tokens: accents are read at runtime from `--paint`, `--paint-hi`, `--paint-deep`, plus `--stage`
  and `--text`; nothing is hard-coded to a hex that the design owns. Wrapper has
  `data-cursor="throw"`.

## Tuning values

|                                 | desktop    | mobile     |
| ------------------------------- | ---------- | ---------- |
| world width                     | 15.5       | 11.8       |
| camera elevation                | 42 degrees | 40 degrees |
| fov                             | 26         | 30         |
| target z                        | 1.7        | 1.5        |
| min floor in front of the name  | 4.4        | 4.4        |
| piece scale (of v2 linear size) | 0.6        | 0.6        |

Name share of the floor width 0.92 (`logic/stage.ts`, shared by the scene and the unit tests). Key light at (mid.x - 7, 13, mid.z - 5). Exposure 1.05.
Rim `#cfdcf2` at 0.9, ambient 0.12. Body tones `#2b333c` anodised, `#313a44` ceramic, `#4b535d`
alloy, legends in `--paint`. Name: metalness 0.8, roughness 0.26, clearcoat 0.6, colour paper x 0.9.
Quality budget about 20 ms median. Idle nudge, light drift and pointer parallax are small amplitude
and stop under reduced motion.

## Objects and skills

Importance order (owner's top skills first, then the rest of the real stack, then named tools):
Android Development, Java, Kotlin, Machine Learning, React, TensorFlow Lite, Firebase, C, Git, Python,
Jetpack Compose, TypeScript, Node.js, PyTorch, ONNX, C++, WebAssembly, Docker, PostgreSQL, FastAPI,
OpenCV, GitHub, VS Code, Google Cloud, Claude. Nothing else is printed on a key (unit-tested allow list).

- Importance drives size, weight and accent: tier A (top seven) is the biggest and heaviest with the
  mark in the accent ink; tier B (C, Git, Python) is mid-size; tier C is the smallest. Android, Java
  and Kotlin also carry an accent body.
- Pieces for the projects, same material family: phone slab (SafeSurf), shield and lock blocks
  (SafeGuard), quadcopter (drone), lens (X-Ray). Double-click or Enter scrolls to the section and the
  accessible description says so; a single click still nudges.
- Every object has an accessible name, announced on keyboard selection; hover or grab shows the name
  in a chip (aria-hidden, so it is not read twice).
- Counter: "Hits on the name: N. Damage: 0." next to the approved line. N counts real impacts on the
  name (speed threshold and per-body cooldown), including the intro drop, so it is not always 0 on load.
- The h1 is kept as a visually hidden heading; the small duplicate visible label is gone.

### v3 (owner feedback round)

- Pieces are 0.6 of the v2 linear size (decided by eye at 1440, 900, 768, 600 and 390). Longest side
  of a skill piece: tier A 0.90, B 0.72, C 0.60 world units; the name is about 14 units wide.
- The floor is deeper (at least 4.4 units in front of the name) and the drop is planned with dart
  throwing: every piece gets its own patch with a gap of 0.5 down to 0.12 units, biggest first.
  Friction 0.2 (piece-piece) and 0.3 (piece-floor), restitution 0.3 and 0.45 on the name: thrown pieces
  slide and tumble, then settle into a loose scatter again (unit-tested: nothing stacked, almost
  nothing touching, after the drop and after a hard throw into the crowd).
- Toggle switch and dial removed: every object is a technology he uses or one of his projects.
- Settling assist (`PhysicsWorld.topple`): a thin piece balanced on its edge, or a keycap, phone,
  drone or lens left upside down, gets a few seconds of torque so it ends lying flat, printed side up.
  Tokens are double sided (the mark is on both faces).
- Skill logos became die-cut tokens: the mark's silhouette plus a thin margin (traced by
  `tools/build-tokens.mjs`, holes filled, smoothed) extruded into a chunky rounded plate (cream
  enamel, bevel 0.3 of the thickness, thin steel rim) with the official mark raised on top in the
  brand's own colour. Collider: a convex prism of an enclosing hull of at most 10 vertices.
- Keycaps (6): Java, ML, C, TypeScript, GitHub, VS Code. Java, ML, C and VS Code have no usable
  official mark (see below), so they stay text keycaps. TypeScript and GitHub are square or dark marks
  that print well on a cap (brand-dark GitHub does not read as an enamel token on the dark stage), so
  they stay keycaps with the mark printed flat.
- Project pieces: phone (rounded body, lit screen: SafeSurf logo on navy, address bar with lock, three
  result cards), shield with a raised check and padlock (SafeGuard), quadcopter with four ringed rotors,
  skids and a camera pod (drone), magnifier with a brass ring over a tiny circuit board (X-Ray).
  Hover shows the project name; double-click or Enter jumps to the section.

### Body counts per breakpoint

| Set                                               | Desktop (>= 900 px)                                                       | Mobile                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| Full (GPU)                                        | 30 (25 skills: 19 tokens and 6 keycaps; shield, lock, phone, drone, lens) | 17 (13 skills + shield, phone, drone, lens) |
| Lite (software renderer, lowest quality at start) | 20 (15 skills + 5 project pieces)                                         | 14 (10 skills + shield, phone, drone, lens) |

Sizes (world units, longest side before the 0.6 scale in brackets): tier A 0.90 (1.5), B 0.72 (1.2),
C 0.60 (1.0); thickness of tokens 0.62 of a keycap's. Project pieces: shield 0.9, lock 0.84, phone
0.63 wide by 1.14 long, drone 1.14, magnifier 1.09. Same sizes at every breakpoint; only the camera
and floor change. Checked at 1440, 900, 768, 600 and 390 px.

The lite set is chosen at start only; a running scene steps its quality down (pixel ratio, shadows)
but does not rebuild the catalogue.

### Logo marks: source and licence

Marks are self-hosted path data (`src/sections/Hero/scene/marks.ts`, generated by
`tools/build-marks.mjs` from simple-icons 16.38.0). They are printed flat, unaltered, in either the
cream or accent ink (keycaps) or extruded unaltered into die-cut tokens and coloured with the brand's
own hex (tokens); none is redrawn or stretched. Exceptions recorded: the raised mark of a token is
darkened (lightness x 0.72) only when the brand hex is very light and would vanish on the cream
enamel (none triggers today); the token plate is the mark's silhouette grown by a margin, not part of the mark. No runtime third-party request is made.

| Mark            | simple-icons slug | Brand colour | Source (brand owner resource)                                                                                                        | Licence                 |
| --------------- | ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Android         | `android`         | #3DDC84      | https://partnermarketinghub.withgoogle.com/brands/android/visual-identity/visual-identity/logo-lock-ups                              | CC-BY-3.0               |
| Kotlin          | `kotlin`          | #7F52FF      | https://www.jetbrains.com/company/brand/logos/                                                                                       | CC0-1.0 data; trademark |
| TensorFlow      | `tensorflow`      | #FF6F00      | https://www.tensorflow.org                                                                                                           | CC0-1.0 data; trademark |
| React           | `react`           | #61DAFB      | https://github.com/facebook/create-react-app/blob/282c03f9525fdf8061ffa1ec50dce89296d916bd/test/fixtures/relative-paths/src/logo.svg | CC0-1.0 data; trademark |
| Firebase        | `firebase`        | #DD2C00      | https://firebase.google.com/brand-guidelines                                                                                         | CC0-1.0 data; trademark |
| Git             | `git`             | #F03C2E      | https://git-scm.com/community/logos                                                                                                  | CC-BY-3.0               |
| Python          | `python`          | #3776AB      | https://www.python.org/community/logos/                                                                                              | CC0-1.0 data; trademark |
| Jetpack Compose | `jetpackcompose`  | #4285F4      | https://developer.android.com/jetpack/compose/                                                                                       | CC0-1.0 data; trademark |
| TypeScript      | `typescript`      | #3178C6      | https://www.typescriptlang.org/branding                                                                                              | CC0-1.0 data; trademark |
| Node.js         | `nodedotjs`       | #5FA04E      | https://nodejs.org/en/about/branding                                                                                                 | CC0-1.0 data; trademark |
| PyTorch         | `pytorch`         | #EE4C2C      | https://github.com/pytorch/pytorch.github.io/blob/8f083bd12192ca12d5e1c1f3d236f4831d823d8f/assets/images/logo.svg                    | CC0-1.0 data; trademark |
| ONNX            | `onnx`            | #005CED      | https://github.com/onnx/onnx.github.io/blob/382e7036b616ce1555499ac41730245a2478513c/images/ONNX-ICON.svg                            | CC0-1.0 data; trademark |
| C++             | `cplusplus`       | #00599C      | https://github.com/isocpp/logos/tree/64ef037049f87ac74875dbe72695e59118b52186                                                        | CC0-1.0 data; trademark |
| WebAssembly     | `webassembly`     | #654FF0      | https://webassembly.org                                                                                                              | CC0-1.0 data; trademark |
| Docker          | `docker`          | #2496ED      | https://www.docker.com/company/newsroom/media-resources                                                                              | CC0-1.0 data; trademark |
| PostgreSQL      | `postgresql`      | #4169E1      | https://wiki.postgresql.org/wiki/Logo                                                                                                | CC0-1.0 data; trademark |
| FastAPI         | `fastapi`         | #009688      | https://github.com/tiangolo/fastapi/blob/ffb4f77a11f83132b521ba0aac6c95792c19e797/docs/en/docs/img/icon-white.svg                    | CC0-1.0 data; trademark |
| OpenCV          | `opencv`          | #5C3EE8      | https://opencv.org/resources/media-kit/                                                                                              | CC0-1.0 data; trademark |
| GitHub          | `github`          | #181717      | https://github.com/logos                                                                                                             | CC0-1.0 data; trademark |
| Google Cloud    | `googlecloud`     | #4285F4      | https://cloud.google.com                                                                                                             | CC0-1.0 data; trademark |
| Claude          | `claude`          | #D97757      | https://claude.ai                                                                                                                    | CC0-1.0 data; trademark |

Text legends (no usable mark): Java (simple-icons carries only the Duke mark, which is a separate
OpenJDK trademark, so the word is printed), VS Code (removed from simple-icons at the owner's request),
ML and C (no brand mark exists). TensorFlow Lite uses the TensorFlow mark (no separate Lite mark).
The Android robot is used under the Creative Commons 3.0 Attribution License and the Git logo by
Jason Long under CC BY 3.0; both attributions are in the README with the trademark line.

## Performance (1440x900, Apple M5, ANGLE Metal, Chromium headless, 30 bodies)

- Frame interval is vsync bound: median 16.7 ms, p95 16.7 ms, max 16.8 ms over 245 frames after
  settle and over 425 frames across a fresh drop (60 fps, no dropped frame).
- CPU work per frame (JS plus draw-call submission): median 1.3 ms, p95 2.8 ms settled; 1.6 / 2.9 ms
  during a drop.
- Sleeping bodies cost no solver time.
- The hero height is fixed by CSS from first paint (`max(100svh - nav, 40rem)`, 49rem on phones), so the lazy
  scene, still, fonts and counter never shift anything below it; an e2e test asserts `#about` does not move.
- The pre-settle ends with `restSlow()`: bodies still creeping after 10 s of simulated time (platform
  float differences, seen on CI) are put to sleep, so the fast path always ends fully asleep.
- Lazy chunk 207.6 kB gzip against the 300 kB target (was 189.2 kB; token outlines and SVG loader add about 18 kB). Main bundle 162.4 kB gzip.
- CI (software GL, about 10 fps) uses `?heroSeed=N&heroFast=1`: physics is pre-stepped to rest before
  the first frame, `__hero.step(n)` advances time by hand, and `__hero.pixels()` reads the buffer right
  after the first frame for the non-blank check. Every scene test runs in 7-15 s locally (budget 20 s).

## Iteration passes (against ART_DIRECTION gates)

1. Materials, orientation, composition. First pass looked like uniform dark slabs with unreadable
   legends and bodies that landed on their sides. Fixed: lighter anodised tones, white legend colour
   with bump and emissive maps, narrower spawn tilt, bodies bump-planned so none starts inside
   another, camera pulled to a 42 degree elevation, play region moved beside the text.
   Gates: no-rectangle passed (no panel, no frame; stage is the page); mass failed (bodies looked
   light).
2. Design v2 light. One light at 135 degrees, shadow map plus contact blobs and a warm pool so
   objects read as heavy and grounded; accents moved to `--paint*`; the mono invitation line is the
   approved wit line. Gates: mass and frame passed on desktop; mobile name was too small.
3. Name finish and mobile. Name became a warm metal with clearcoat so it reads as the thing worth
   hitting and still contrasts with the dark stage; mobile clearance padding made to follow the text
   box. Gates: ten-second (a visitor can grab, throw and see the name hold within 10 s) passed;
   serious (a hire-me hero, not a toy) passed on desktop, borderline on mobile where the scene is
   small; frame passed.

4. v3 (tokens and scatter). Pass 1: tokens had a coloured plate under a white mark, so most read as
   white blobs, and some thin tokens, keycaps and the drone rested on edge or upside down. Fixed:
   cream enamel plate with the mark in the brand colour, double-sided mark, settling assist, shorter
   keycaps, drone skids. Gates: mass, frame, no-rectangle passed; serious passed. Pass 2: re-checked
   five widths (1440, 900, 768, 600, 390): name never covered after the intro (e2e at 768 and 1440),
   pieces proportionate, 60 fps held.

## Evidence

- `docs/reports/img/hero-{desktop,tablet,mobile}-{settled,throw,fallback}.png` (1440x900, 768x1024, 390x844)
- `docs/reports/img/hero-frames-drop.png`, `hero-frames-throw.png` (8 frames, about 100 ms apart)
- `docs/reports/video/hero.webm` (about 8 s: drop, hover, drag, throw, second drag)
- Stills are rendered with `heroFast=1`; drop frames, stats and video use the live drop.
- Regenerate all of it with `node src/sections/Hero/tools/build-evidence.mjs` against a running dev
  server on port 5189 (`HERO_URL` overrides). The video is re-encoded with ffmpeg (VP9, crf 38) to stay under 3 MB.

## Limits and shortfalls

- No ambient occlusion pass or true area-light reflections; softbox reflections come from a static
  PMREM map, so glints do not move when a key tumbles the way they do in a top studio piece.
- Shadow map is one directional light; thrown objects cast a soft shadow only on the floor, not on
  each other's legends beyond what the map resolves.
- Legends are bump and emissive textures, not modelled geometry; at extreme close range keycaps look
  flat compared to real double-shot caps.
- The name is a plain extrusion with a bevel; no per-letter wobble or damage state.
- Touch behaviour (drag object versus scroll) is implemented but not covered by an e2e test; it was
  checked by reading the event path only, not on a real phone.
- Mobile scene is small (the clearance under the text is 320-430 px) and the name is much smaller than on desktop.
- The hit counter counts intro impacts too, and the cooldown means a pile resting on the name does not tick.
- The lite catalogue is not rebuilt when quality steps down mid-session.
- No sound, no haptics.
- Name lettering is unchanged in v3: a better finish (per-letter bevel work, engraved edge) risked the
  name collider and the 60 fps budget, so it is recorded as a shortfall rather than changed.
- Token marks are small at 0.6 scale; at 390 px a token is about 20 px wide and its mark is legible
  as a colour and silhouette, not as fine detail.
- Android and Git logos are CC BY 3.0 (attribution kept in the README).
- The settling assist is a nudge, not physics: a piece wedged against neighbours gets about 4 s of help
  and is then left to sleep, so an occasional piece rests slightly tilted on another.
- A phone can briefly show its back during a live drop before the assist turns it screen up.
- Deep links with a hash do not scroll to the section; that belongs to the shell, not the hero.

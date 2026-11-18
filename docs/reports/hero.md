# Hero report (worker A)

Branch `feat/hero-objects`. Replaces the rejected inflated-letters hero with a playable 3D studio:
16 glossy rigid bodies (12 keycaps, dial, toggle, shield, lock) fall onto a dark stage and bounce
off the name "Ilay Fisher", which is solid, immovable 3D lettering.

## Stack decision (measured)

| Option | Cost | Verdict |
| --- | --- | --- |
| three 0.180 + cannon-es 0.20 | lazy chunk 643 kB raw, **171.5 kB gzip** | chosen |
| three + Rapier (wasm) | about 1.17 MB gzip for the wasm alone | rejected, 4x over budget |
| OGL (`GlStage`) | small, but no PBR, no PMREM, no shadow maps | rejected, cannot make glossy clearcoat |

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

| | desktop | mobile |
| --- | --- | --- |
| world width | 15.5 | 9.4 |
| camera elevation | 42 degrees | 40 degrees |
| fov | 26 | 30 |
| target z | 1.7 | 1.5 |

Name share of the play region 0.86. Key light at (mid.x - 7, 13, mid.z - 5). Exposure 1.05.
Rim `#cfdcf2` at 0.9, ambient 0.12. Body tones `#2b333c` anodised, `#313a44` ceramic, `#4b535d`
alloy, legends in `--paint`. Name: metalness 0.8, roughness 0.26, clearcoat 0.6, colour paper x 0.9.
Quality budget about 20 ms median. Idle nudge, light drift and pointer parallax are small amplitude
and stop under reduced motion.

## Performance (1440x900, Apple M5, ANGLE Metal, Chromium headless)

- Frame interval is vsync bound: median 16.7 ms, p95 16.8 ms, max 16.8 ms over 223 frames after
  settle and over 403 frames across a fresh drop (so 60 fps, no dropped frame).
- CPU work per frame (JS plus draw-call submission): median 0.9 ms, p95 1.9 ms.
- 12 of 16 bodies asleep by 2 s, all asleep by about 5 s; sleeping bodies cost no solver time.
- The shared e2e config uses software GL (swiftshader): about 10 fps there, so the simulation runs
  in slow motion and e2e timeouts are generous (settle 90 s). That is a CI artefact, not the product.
- Lazy chunk 171.5 kB gzip against the 300 kB target.

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

## Evidence

- `docs/reports/img/hero-{desktop,mobile}-{settled,throw,fallback}.png`
- `docs/reports/img/hero-frames-drop.png`, `hero-frames-throw.png` (8 frames, about 100 ms apart)
- `docs/reports/video/hero.webm` (about 8 s: drop, hover, drag, throw, second drag)
- Regenerate all of it with `node src/sections/Hero/tools/build-evidence.mjs` against a running dev
  server on port 5187.

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
- The hit counter was not added; the invitation line is the only text near the scene.
- No sound, no haptics.
- Deep links with a hash do not scroll to the section; that belongs to the shell, not the hero.

# Design v2 report (worker G)

Branch `feat/design-soften`. Brief: `docs/ART_DIRECTION.md`. Full rationale: `docs/DESIGN.md` section 0.

## Decisions
1. Accent: `--paint #ff5a1f`, `--paint-hi #ffb347`, `--paint-deep #a8300f`, on-paint `#0c1014` (6.1:1 on stage, 5.7:1 on surface).
2. Type: Bricolage Grotesque 700, opsz axis, normal width, tracking -0.026em; Fredoka removed.
3. Radii: 10 / 16 / 24 / 36 / pill; old names aliased.
4. Bevel recipe: body gradient (padding-box) + rim gradient (border-box) + inset bevel + three-layer lower-right contact shadow + ember rim light.
5. Springs: SPRING_SOFT {90,12} 880 ms, SPRING_SNAPPY {520,30} 350 ms, as GSAP eases and CSS `linear()`.
6. Backgrounds: per-section light pools via `data-mood`, grain; blueprint grid removed.
7. Label-on-pill replaces caps eyebrows and the top rule.
8. Nav: floating pill, sliding spring indicator, progress inside the bar.
9. Cursor: opt-in `data-cursor`, hugs links and buttons, verb mode, off on touch / coarse / reduced motion, native cursor hidden only after first mouse move.
10. About: portrait in rounded lens bezel, sticky column fixes desktop dead space; Experience tiles and round timeline nodes; Contact stage panel. Approved wit lines added to Contact and Footer only.

## Evidence
- Screenshots: `docs/reports/img/design-{desktop,mobile}-{fold,about,safesurf,experience,contact}.png`
- Contact sheets: `docs/reports/img/design-frames-{button,headline,cursor}.png` (8 frames, 120 ms)
- Video: `docs/reports/video/design.webm`

## Tests
Unit 182 passing, e2e 35 passing (includes `e2e/design.spec.ts`), lint, typecheck, build clean.

## Below a top studio's level
- Hero and project demos are other workers' stubs here, so the fold is weak.
- No pointer-following specular on surfaces; sheen is static.
- Cursor ring writes width/height per frame (documented exception); not profiled on real low-end devices.
- Contact panel is sparse on the right at desktop.
- Nav progress line reads as an underline.
- No sound, no haptics, no true 3D on non-hero objects.

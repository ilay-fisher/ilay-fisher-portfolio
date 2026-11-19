# Hero: SafeGuard piece uses the real app icon

## What changed
The hero's `shield` piece (id, behaviour and `#safesurf` link unchanged) used to be an invented blue die-cut
shield with a raised check. It is now the real SafeGuard launcher icon, "Guarded Grid", light variant (the
one the app ships): a white face, three blue gradient tiles (#2E2A9E to #3D7BF0 along the diagonal) and a gold
shield (#FFD27A to #FFC14A, top to bottom). Source: the SafeGuard project's `design/launcher-icon/guarded_grid_light.svg`
and `ic_launcher_foreground.xml` (read only; only the drawing is used, no metadata is vendored).

Label "SafeGuard app icon", hover chip still "SafeGuard . double-click to open".

## Build choice: real geometry, not a texture
A bevelled ceramic tile (rounded square, metal rim, like the SafeSurf `logo` disc) carries the art as raised,
bevelled inlays: tiles 0.034 high, shield 15 percent higher. Colours are per-vertex gradients computed from the
artwork coordinates, so they are exact and independent of texture resolution (sharp at any size, no decal
look). The same art is on the back, so it never lands as a blank tile. The face is glazed ceramic at #F3F2EE
(artwork is #FFFFFF): checked in the real scene, it does not clip and does not read as a sticker.
The art maps onto a 72 unit face (the area a launcher shows of the 108 canvas), which reproduces the proportions of
the rendered `ic_launcher.webp`.

## Collider and size
Convex rounded-square prism (`roundedSquareOutline`, 12 points), matching the visual corner radius. Size 1.7 x 0.42 x 1.7
before the 0.6 piece scale (about 1.02 world units square), collision radius 1.05 against the logo's 0.97: same
footprint class, smaller than the logo disc across. `SHIELD_OUTLINE` is removed.

## Files
- `src/sections/Hero/logic/safeguardIcon.ts` (+ test): icon constants, gradients, artwork to face mapping.
- `src/sections/Hero/logic/token.ts` (+ test): `roundedSquareOutline`, `SHIELD_OUTLINE` removed.
- `src/sections/Hero/logic/catalogue.ts` (+ test): entry text, size, radius.
- `src/sections/Hero/physics/world.ts` (+ test): collider.
- `src/sections/Hero/scene/geometry.ts`, `materials.ts`, `runtime.ts`: build, materials (`iconBlue`, `iconGold`), disposal.
- `public/hero/still-desktop.webp` (68.9 kB), `still-mobile.webp` (20.2 kB): regenerated with `tools/build-evidence.mjs`
  (its other outputs, the older `hero-*` evidence images and video, were reverted and not changed).

## Screenshots
- `docs/reports/img/hero-safeguard-icon-1440.webp` and `-390.webp`: live scene, seed 11.
- `docs/reports/img/hero-safeguard-icon-compare.webp`: the piece next to the app's `ic_launcher.webp`.

## Tests
lint, typecheck, `npm test` (641 passed), build; `e2e/hero.spec.ts` on `gl-heavy`: 18 passed, 0 retries.
`e2e/hero.spec.ts` needed no change.

## Limits
- Under the scene's tone mapping the blue and gold read slightly darker and the gold a little muted compared to the flat
  artwork; the hues and proportions match.
- The gradients are linear in vertex colour on a few triangles per tile, so they are smooth but not dithered.
- Physics: with seed 5 on desktop the piece comes to rest leaning on a neighbour (asleep, stable); the flat-rest unit test uses free seeds.
- Not checked on real mobile hardware or on software GL beyond the CI e2e run.

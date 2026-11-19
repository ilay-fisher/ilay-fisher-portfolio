# Alive accent family and hero name treatment

Owner feedback: "didn't love the tired orange. try something more alive like blue/green kind of
stuff. also it should match the rest so if metalic isn't fit here use another headline (hero)".

## Choice

Three candidates were built on the real page and compared in
`docs/reports/img/palette-alive-options.png`: cyan `#1ED0F2`, azure `#3D9DFF`, mint-teal
`#19E3A8`. Cyan won. Azure read as a default link colour, mint-teal (hue 162) sat too close to the
status green. Cyan has the most contrast headroom and reads as emitted light on the graphite stage.

| Token          | Old       | New       |
| -------------- | --------- | --------- |
| `--paint`      | orange    | `#1ED0F2` |
| `--paint-hi`   | amber     | `#8CF1FF` |
| `--paint-deep` | rust      | `#0A6A87` |
| `--on-paint`   | dark      | `#0C1014` |
| `--pass`       | `#7BE0B0` | `#9AE06A` |

Token names are unchanged, so every consumer picks the new family up.

### Contrast (WCAG 2.x)

`--paint` on stage 10.33, on surface 9.57, on raised 8.58. `--on-paint` on `--paint` 10.33, on
`--paint-hi` 14.68. `--paint-hi` on stage 14.68. `--pass` on stage 12.04. `--paint-deep` 3.11 on
stage: fills and shadows only, never text. All text pairs pass AA and AAA. Full table in
`docs/DESIGN.md`.

### Status green

The old mint pass green (hue 151) was too close to a teal accent. Retuned to lime-leaning
`#9AE06A` (hue 96), 94 degrees from the accent. A unit test holds the gap at 60 degrees or more.

## Orange hunt

Hard-coded warm values removed from: CSS (Button, Experience), hero scene fallbacks and lights
(`runtime.ts`, `env.ts`, `materials.ts`, `screens.ts`), SafeSurf burn shader and ember defaults
(`dissolve.ts`, `BurnStage.ts`), the drone canvas fallback palette (`render.ts`), X-Ray palette
tests, PageFx moods (`amber` -> `signal`, `ember` -> `deep`), and `public/favicon.svg` (now a
rounded cyan mark). `src/styles/noOrange.test.ts` scans src, `index.html` and the favicon for warm
hex and rgb literals and fails on the old values and mood names.

Left on purpose: real brand marks (Java, TensorFlow, Acrobat, the gold SafeGuard shield) in
`scene/marks.ts` and `logic/safeguardIcon.ts`, and the warm sunset in the SafeSurf article
illustration (content art, not UI accent). Both are on the guard test's allowlist or out of its
scope.

## Hero name

Judged against the new palette, the brushed grey-bronze alloy no longer fit: it was warm metal on
a cool stage. The letters are now glossy white ceramic (clearcoat 0.85, metalness 0) on dark
plinths, with a thin rounded cyan inlay line on each plinth front. Bevel radius went 0.042 -> 0.06
with 12 segments, so edges are rounder. The inlay is visual only: colliders come from the layout
and are untouched. Stills (`public/hero/still-*.webp`) regenerated from the live scene.
Before and after: `docs/reports/img/palette-alive-name-before-after.png`.

## Tests

- New: `tokens.test.ts` (values, rgb triplets, hue range, contrast, status-green gap),
  `noOrange.test.ts` (guard), `nameMaterials.test.ts`. Red `test:` commit first for the first
  two; the name test was written after the code.
- Unit: 683 passing. Lint and typecheck clean. Build clean.
- E2E, `--workers=1`, production preview: hero, smoke, design, safesurf, drone, xray specs: 90 passed.

## Screenshots (all from the production build)

`docs/reports/img/palette-alive-*.png`: options, hero, safesurf-rest, safesurf-burn, drone, xray,
nav, contact at 1440 and 390 (burn at 1440 is a genuine mid-burn frame; the burn edge uses the
status green by design), plus name-before-after.

## Shared files touched

`src/styles/tokens.css`, `src/styles/global.css` (pool class names), `src/components/Button/Button.css`,
`src/sections/Experience/Experience.css` (colour literals), `src/components/PageFx/PageFx.tsx`,
`src/lib/pageFx.ts` (mood renames), `src/components/LinkKey/LinkKey.css` and
`src/sections/Contact/Contact.css` (comments only).

## Known limits

The 390 burn image is not mid-burn. The pre-existing "flip" chip and cursor ring appear in some
screenshots and are not part of this change. The `docs/DESIGN.md` diff includes Prettier table
realignment.
